# هندسة تطبيق n8n العربي

## 🏗️ نظرة عامة على الهندسة

سنقوم ببناء نسخة مبسطة ولكن فعالة من n8n تعمل بالكامل، مع:
- **محرك سير عمل** يقوم بتنفيذ العقد المترابطة
- **نظام عقد** قابل للتوسع مع عقد أساسية
- **واجهة ويب** تفاعلية لبناء سير العمل
- **قاعدة بيانات** لتخزين سير العمل والسجلات
- **API** للتحكم في سير العمل

## 🔧 التقنيات المستخدمة

### الواجهة الأمامية (Frontend)
- **HTML5/CSS3**: البنية والتصميم
- **JavaScript ES6+**: التفاعلية
- **Tailwind CSS**: التنسيق
- **Anime.js**: الرسوم المتحركة

### الواجهة الخلفية (Backend)
- **Node.js**: خادم التطبيق
- **Express.js**: إطار عمل API
- **SQLite**: قاعدة البيانات
- **Socket.io**: الاتصال اللحظي

### المكتبات الإضافية
- **uuid**: إنشاء معرفات فريدة
- **node-cron**: جدولة المهام
- **axios**: طلبات HTTP

## 📋 بنية التطبيق

```
/mnt/okcomputer/output/
├── app.js                 # خادم Node.js الرئيسي
├── database/              # قاعدة البيانات
│   ├── schema.sql        # مخطط قاعدة البيانات
│   ├── connection.js     # اتصال قاعدة البيانات
│   └── migrations/       # تحديثات قاعدة البيانات
├── engine/               # محرك سير العمل
│   ├── workflow-engine.js # محرك التنفيذ الرئيسي
│   ├── node-registry.js  # سجل العقد
│   └── nodes/            # العقد المدمجة
│       ├── trigger.js    # عقد المُشغلات
│       ├── action.js     # عقد الإجراءات
│       ├── logic.js      # عقد المنطق
│       └── integration.js # عقد التكامل
├── api/                  # واجهة API
│   ├── routes/           # مسارات API
│   │   ├── workflows.js  # إدارة سير العمل
│   │   ├── nodes.js      # معلومات العقد
│   │   └── executions.js # سجلات التنفيذ
│   └── middleware.js     # وسطاء API
├── public/               # الملفات العامة
│   ├── index.html        # واجهة المستخدم
│   ├── main.js          # JavaScript التفاعلي
│   └── style.css        # أنماط CSS الإضافية
└── config/              # الإعدادات
    ├── database.js      # إعدادات قاعدة البيانات
    └── server.js        # إعدادات الخادم
```

## 🗄️ مخطط قاعدة البيانات

### جدول سير العمل (workflows)
```sql
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    nodes TEXT NOT NULL, -- JSON string of nodes
    connections TEXT NOT NULL, -- JSON string of connections
    is_active BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### جدول تنفيذات سير العمل (workflow_executions)
```sql
CREATE TABLE workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'running', 'completed', 'failed'
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    data TEXT, -- JSON string of execution data
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### جدول العقد (nodes)
```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'trigger', 'action', 'logic', 'integration'
    name TEXT NOT NULL,
    position_x INTEGER,
    position_y INTEGER,
    parameters TEXT, -- JSON string of node parameters
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);
```

### جدول الاتصالات (connections)
```sql
CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    source_output TEXT DEFAULT 'main',
    target_input TEXT DEFAULT 'main',
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (source_node_id) REFERENCES nodes(id),
    FOREIGN KEY (target_node_id) REFERENCES nodes(id)
);
```

## 🔄 محرك سير العمل

### كيفية عمل المحرك

1. **تحميل سير العمل**: يقوم بتحميل تعريف سير العمل من قاعدة البيانات
2. **تحليل العقد**: يحلل العقد ويبني شجرة التنفيذ
3. **تنفيذ العقد**: ينفذ العقد واحدة تلو الأخرى
4. **نقل البيانات**: ينقل البيانات من عقدة إلى أخرى
5. **تسجيل السجلات**: يسجل كل خطوة في قاعدة البيانات

### دورة حياة التنفيذ

```javascript
// 1. بدء التنفيذ
const execution = await engine.startWorkflow(workflowId, triggerData);

// 2. تنفيذ العقد
for (const node of execution.nodes) {
    const result = await engine.executeNode(node, execution.data);
    execution.data = result;
    await engine.logExecution(node, result);
}

// 3. إكمال التنفيذ
await engine.completeWorkflow(execution.id, execution.data);
```

## 🎯 أنواع العقد

### 1. عقد المُشغلات (Trigger Nodes)
- **الويب هوك**: يستقبل طلبات HTTP
- **الجدولة**: ينفذ حسب جدولة زمنية
- **الملف**: يراقب تغييرات الملفات
- **البريد**: يراقب البريد الإلكتروني

### 2. عقد الإجراءات (Action Nodes)
- **إرسال بريد**: يرسل رسائل بريد إلكتروني
- **HTTP طلب**: يرسل طلبات API
- **قاعدة بيانات**: ينفذ عمليات قاعدة البيانات
- **ملف**: يقرأ/يكتب ملفات

### 3. عقد المنطق (Logic Nodes)
- **IF**: شروط منطقية
- **Switch**: تحديد مسار متعدد
- **Merge**: دمج البيانات
- **Split**: تقسيم البيانات

### 4. عقد التكامل (Integration Nodes)
- **Slack**: إرسال رسائل إلى Slack
- **Discord**: إرسال رسائل إلى Discord
- **Telegram**: إرسال رسائل إلى Telegram
- **Webhook**: استقبال/إرسال webhooks

## 🌐 واجهة API

### مسارات API الرئيسية

```javascript
// إدارة سير العمل
GET    /api/workflows          # الحصول على قائمة سير العمل
POST   /api/workflows          # إنشاء سير عمل جديد
GET    /api/workflows/:id      # الحصول على سير عمل محدد
PUT    /api/workflows/:id      # تحديث سير العمل
DELETE /api/workflows/:id      # حذف سير العمل
POST   /api/workflows/:id/run  # تشغيل سير العمل

// معلومات العقد
GET    /api/nodes              # الحصول على قائمة العقد المتاحة
GET    /api/nodes/:type        # الحصول على معلومات عقدة محددة

// سجلات التنفيذ
GET    /api/executions         # الحصول على سجلات التنفيذ
GET    /api/executions/:id     # الحصول على سجل تنفيذ محدد
```

## 🎨 واجهة المستخدم

### المكونات الرئيسية

1. **شريط الأدوات**: حفظ، تشغيل، إيقاف سير العمل
2. **لوحة العقد**: قائمة العقد المتاحة للسحب
3. **لوحة الرسم**: منطقة بناء سير العمل
4. **لوحة الإعدادات**: إعدادات العقدة المختارة
5. **لوحة السجلات**: عرض سجلات التنفيذ

### التفاعلية

- **سحب وإفلات**: إضافة عقد جديدة
- **ربط العقد**: ربط العقد بخطوط
- **تحريك العقد**: تغيير موقع العقد
- **تكوين العقد**: فتح لوحة الإعدادات
- **تشغيل سير العمل**: بدء التنفيذ

## 🔒 الأمان والخصوصية

### تدابير الأمان

- **تشفير البيانات الحساسة**: تشفير المفاتيح والبيانات الحساسة
- **التحقق من الصلاحيات**: التحقق من صلاحية المستخدم
- **حماية API**: حماية واجهات API
- **سجلات الأمان**: تسجيل جميع العمليات

### الخصوصية

- **البيانات محلية**: جميع البيانات محفوظة محلياً
- **لا تتبع**: لا يوجد تتبع أو تحليلات
- **خصوصية كاملة**: المستخدم يتحكم الكامل في بياناته

## 🚀 التنفيذ والنشر

### التشغيل المحلي

```bash
# تثبيت المتطلبات
npm install

# تشغيل الخادم
npm start

# أو باستخدام Docker
docker-compose up
```

### النشر على الخادم

```bash
# بناء التطبيق
npm run build

# نشر على Heroku
git push heroku main

# نشر على Railway
railway up
```

## 📈 الأداء والقابلية للتوسع

### تحسين الأداء

- **تخزين مؤقت**: تخزين العقد والبيانات مؤقتاً
- **معالجة دفعية**: معالجة البيانات على دفعات
- **تنفيذ متوازي**: تنفيذ العقد المتفرعة بشكل متوازي
- **تحميل متدرج**: تحميل الموارد حسب الحاجة

### القابلية للتوسع

- **وضع الطابور**: استخدام Redis للتوسع الأفقي
- **متوازي**: تشغيل عدة نسخ من التطبيق
- **قاعدة بيانات موزعة**: استخدام قاعدة بيانات متعددة
- **تخزين موزع**: تخزين البيانات في مواقع متعددة

## 🎯 الخطوات التالية

### الميزات المستقبلية

- **AI Integration**: دمج نماذج AI في سير العمل
- **Real-time Collaboration**: التعاون المباشر في الوقت الفعلي
- **Advanced Analytics**: تحليلات متقدمة لسير العمل
- **Mobile App**: تطبيق جوال للموبايل
- **Plugin System**: نظام إضافات للعقد الجديدة

### التحسينات

- **تحسين الأداء**: تحسين أداء المحرك
- **توسيع التكاملات**: إضافة المزيد من التكاملات
- **تحسين واجهة المستخدم**: تحسين تجربة المستخدم
- **توطين إضافي**: إضافة المزيد من اللغات

---

**هذه الهندسة مصممة لبناء نسخة كاملة وفعالة من n8n تعمل بالكامل مع جميع الميزات الأساسية.**