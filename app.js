const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');

// إنشاء تطبيق Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// إعدادات Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إعداد قاعدة البيانات
const dbPath = path.join(__dirname, 'database', 'n8n.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('خطأ في فتح قاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات بنجاح');
        initializeDatabase();
    }
});

// تهيئة قاعدة البيانات
function initializeDatabase() {
    db.serialize(() => {
        // جدول سير العمل
        db.run(`CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            nodes TEXT NOT NULL,
            connections TEXT NOT NULL,
            is_active BOOLEAN DEFAULT false,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // جدول تنفيذات سير العمل
        db.run(`CREATE TABLE IF NOT EXISTS workflow_executions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            error_message TEXT,
            data TEXT,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`);

        // جدول العقد
        db.run(`CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            position_x INTEGER,
            position_y INTEGER,
            parameters TEXT,
            FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`);

        // جدول الاتصالات
        db.run(`CREATE TABLE IF NOT EXISTS connections (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            source_node_id TEXT NOT NULL,
            target_node_id TEXT NOT NULL,
            source_output TEXT DEFAULT 'main',
            target_input TEXT DEFAULT 'main',
            FOREIGN KEY (workflow_id) REFERENCES workflows(id)
        )`);

        console.log('تم تهيئة جداول قاعدة البيانات بنجاح');
    });
}

// محرك سير العمل المبسط
class WorkflowEngine {
    constructor(db) {
        this.db = db;
        this.activeWorkflows = new Map();
        this.initializeActiveWorkflows();
    }

    async initializeActiveWorkflows() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM workflows WHERE is_active = true', (err, workflows) => {
                if (err) {
                    console.error('خطأ في تحميل سير العمل النشطة:', err);
                    reject(err);
                    return;
                }
                
                workflows.forEach(workflow => {
                    this.activeWorkflows.set(workflow.id, workflow);
                    console.log(`تم تحميل سير العمل النشطة: ${workflow.name}`);
                });
                
                resolve();
            });
        });
    }

    async createWorkflow(workflowData) {
        const id = uuidv4();
        const { name, description, nodes, connections } = workflowData;

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO workflows (id, name, description, nodes, connections)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(id, name, description, JSON.stringify(nodes), JSON.stringify(connections), function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                const workflow = {
                    id,
                    name,
                    description,
                    nodes: JSON.parse(nodes),
                    connections: JSON.parse(connections),
                    is_active: false,
                    created_at: new Date().toISOString()
                };
                
                resolve(workflow);
            });
            
            stmt.finalize();
        });
    }

    async getWorkflow(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM workflows WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row) {
                    row.nodes = JSON.parse(row.nodes);
                    row.connections = JSON.parse(row.connections);
                }
                
                resolve(row);
            });
        });
    }

    async getAllWorkflows() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM workflows ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const workflows = rows.map(row => ({
                    ...row,
                    nodes: JSON.parse(row.nodes),
                    connections: JSON.parse(row.connections)
                }));
                
                resolve(workflows);
            });
        });
    }

    async updateWorkflow(id, workflowData) {
        const { name, description, nodes, connections, is_active } = workflowData;

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE workflows 
                SET name = ?, description = ?, nodes = ?, connections = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            stmt.run(name, description, JSON.stringify(nodes), JSON.stringify(connections), is_active, id, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (is_active) {
                    const workflow = {
                        id,
                        name,
                        description,
                        nodes: JSON.parse(nodes),
                        connections: JSON.parse(connections),
                        is_active
                    };
                    this.activeWorkflows.set(id, workflow);
                } else {
                    this.activeWorkflows.delete(id);
                }
                
                resolve({ id, ...workflowData });
            }.bind(this));
            
            stmt.finalize();
        });
    }

    async deleteWorkflow(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM workflows WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                this.activeWorkflows.delete(id);
                resolve({ deleted: this.changes > 0 });
            }.bind(this));
        });
    }

    async executeWorkflow(workflowId, triggerData = {}) {
        try {
            const workflow = await this.getWorkflow(workflowId);
            if (!workflow) {
                throw new Error('سير العمل غير موجود');
            }

            // إنشاء سجل تنفيذ
            const executionId = uuidv4();
            await this.createExecution(executionId, workflowId, 'running');

            console.log(`بدء تنفيذ سير العمل: ${workflow.name} (${executionId})`);

            // محاكاة تنفيذ سير العمل
            let executionData = { ...triggerData };
            const nodes = workflow.nodes;
            const connections = workflow.connections;

            // بناء ترتيب التنفيذ بناءً على الاتصالات
            const executionOrder = this.buildExecutionOrder(nodes, connections);

            for (const nodeId of executionOrder) {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    console.log(`تنفيذ العقدة: ${node.name} (${node.type})`);
                    executionData = await this.executeNode(node, executionData);
                    
                    // إرسال تحديث عبر Socket.io
                    io.emit('nodeExecuted', {
                        executionId,
                        nodeId: node.id,
                        nodeName: node.name,
                        data: executionData
                    });
                }
            }

            // إكمال التنفيذ
            await this.completeExecution(executionId, executionData);
            
            console.log(`اكتمل تنفيذ سير العمل: ${workflow.name}`);
            
            return {
                executionId,
                workflowId,
                status: 'completed',
                data: executionData
            };

        } catch (error) {
            console.error('خطأ في تنفيذ سير العمل:', error);
            throw error;
        }
    }

    buildExecutionOrder(nodes, connections) {
        // خوارزمية بسيطة لبناء ترتيب التنفيذ
        const order = [];
        const visited = new Set();
        
        // نبدأ من العقد المُشغلة
        const triggerNodes = nodes.filter(n => n.type === 'trigger');
        
        function visit(nodeId) {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            order.push(nodeId);
            
            // نجد العقد التالية
            const nextConnections = connections.filter(c => c.source === nodeId);
            for (const conn of nextConnections) {
                visit(conn.target);
            }
        }
        
        triggerNodes.forEach(node => visit(node.id));
        
        return order;
    }

    async executeNode(node, inputData) {
        // محاكاة تنفيذ العقدة
        console.log(`تنفيذ العقدة ${node.name} من نوع ${node.type}`);
        
        switch (node.type) {
            case 'trigger':
                return { ...inputData, triggered: true, timestamp: new Date().toISOString() };
                
            case 'action':
                return { ...inputData, action: node.name, processed: true };
                
            case 'logic':
                return { ...inputData, logic: node.name, decision: 'approved' };
                
            case 'integration':
                return { ...inputData, integration: node.name, status: 'connected' };
                
            default:
                return { ...inputData, unknown: true };
        }
    }

    async createExecution(executionId, workflowId, status) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO workflow_executions (id, workflow_id, status)
                VALUES (?, ?, ?)
            `);
            
            stmt.run(executionId, workflowId, status, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
            
            stmt.finalize();
        });
    }

    async completeExecution(executionId, data) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE workflow_executions 
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP, data = ?
                WHERE id = ?
            `);
            
            stmt.run(JSON.stringify(data), executionId, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
            
            stmt.finalize();
        });
    }

    async getExecutionHistory(workflowId) {
        return new Promise((resolve, reject) => {
            const query = workflowId 
                ? 'SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY started_at DESC'
                : 'SELECT * FROM workflow_executions ORDER BY started_at DESC';
                
            const params = workflowId ? [workflowId] : [];
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const executions = rows.map(row => ({
                    ...row,
                    data: row.data ? JSON.parse(row.data) : null
                }));
                
                resolve(executions);
            });
        });
    }
}

// إنشاء محرك سير العمل
const workflowEngine = new WorkflowEngine(db);

// مسارات API
app.get('/api/workflows', async (req, res) => {
    try {
        const workflows = await workflowEngine.getAllWorkflows();
        res.json({ success: true, workflows });
    } catch (error) {
        console.error('خطأ في الحصول على سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/workflows/:id', async (req, res) => {
    try {
        const workflow = await workflowEngine.getWorkflow(req.params.id);
        if (!workflow) {
            return res.status(404).json({ success: false, error: 'سير العمل غير موجود' });
        }
        res.json({ success: true, workflow });
    } catch (error) {
        console.error('خطأ في الحصول على سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows', async (req, res) => {
    try {
        const workflow = await workflowEngine.createWorkflow(req.body);
        res.status(201).json({ success: true, workflow });
    } catch (error) {
        console.error('خطأ في إنشاء سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/workflows/:id', async (req, res) => {
    try {
        const workflow = await workflowEngine.updateWorkflow(req.params.id, req.body);
        res.json({ success: true, workflow });
    } catch (error) {
        console.error('خطأ في تحديث سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/workflows/:id', async (req, res) => {
    try {
        const result = await workflowEngine.deleteWorkflow(req.params.id);
        res.json({ success: true, result });
    } catch (error) {
        console.error('خطأ في حذف سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/workflows/:id/run', async (req, res) => {
    try {
        const result = await workflowEngine.executeWorkflow(req.params.id, req.body);
        res.json({ success: true, result });
    } catch (error) {
        console.error('خطأ في تنفيذ سير العمل:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/executions', async (req, res) => {
    try {
        const workflowId = req.query.workflow_id;
        const executions = await workflowEngine.getExecutionHistory(workflowId);
        res.json({ success: true, executions });
    } catch (error) {
        console.error('خطأ في الحصول على سجلات التنفيذ:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// مسارات HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

app.get('/workflows', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'workflows.html'));
});

app.get('/executions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'executions.html'));
});

// Socket.io للاتصال اللحظي
io.on('connection', (socket) => {
    console.log('تم الاتصال:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('تم فصل الاتصال:', socket.id);
    });
});

// بدء الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 خادم n8n العربي يعمل على المنفذ ${PORT}`);
    console.log(`📱 فتح http://localhost:${PORT} في المتصفح`);
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (err) => {
    console.error('خطأ غير متوقع:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('وعد مرفوض غير معالج:', reason);
});

// تصدير محرك سير العمل للاستخدام في其他地方
module.exports = { app, workflowEngine, db };