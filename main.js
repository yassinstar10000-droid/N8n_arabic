// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeTypedText();
    initializeWorkflowBuilder();
    initializeCounters();
    initializeAnimations();
});

// Typed text animation
function initializeTypedText() {
    const typed = new Typed('#typed-text', {
        strings: [
            'أتمتة المهام المعقدة بضع نقرات',
            'ربط أكثر من 400 تطبيق مختلف',
            'بناء سير عمل ذكية باستخدام AI',
            'توفير وقتك لما هو مهم'
        ],
        typeSpeed: 50,
        backSpeed: 30,
        backDelay: 2000,
        loop: true,
        showCursor: true,
        cursorChar: '|'
    });
}

// Workflow builder functionality
function initializeWorkflowBuilder() {
    const canvas = document.getElementById('workflow-canvas');
    const placeholder = document.getElementById('canvas-placeholder');
    const svg = document.getElementById('connection-svg');
    let draggedElement = null;
    let workflowNodes = [];
    let connections = [];

    // Make nodes draggable
    document.querySelectorAll('.workflow-node').forEach(node => {
        node.addEventListener('dragstart', handleDragStart);
        node.addEventListener('dragend', handleDragEnd);
        node.draggable = true;
    });

    // Canvas drop functionality
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    function handleDragStart(e) {
        draggedElement = e.target.closest('.workflow-node');
        e.dataTransfer.effectAllowed = 'copy';
    }

    function handleDragEnd(e) {
        draggedElement = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    function handleDrop(e) {
        e.preventDefault();
        if (!draggedElement) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        createWorkflowNode(draggedElement, x, y);
        hidePlaceholder();
    }

    function createWorkflowNode(template, x, y) {
        const nodeType = template.dataset.type;
        const nodeId = 'node-' + Date.now();
        
        const node = document.createElement('div');
        node.className = 'absolute bg-gray-700 rounded-lg p-3 border-2 border-blue-500 cursor-move transform hover:scale-105 transition-all';
        node.style.left = (x - 60) + 'px';
        node.style.top = (y - 30) + 'px';
        node.style.width = '120px';
        node.id = nodeId;
        
        const icon = template.querySelector('i').cloneNode(true);
        const title = template.querySelector('.font-semibold').textContent;
        
        node.innerHTML = `
            <div class="text-center">
                <div class="text-blue-400 text-lg mb-1">${icon.outerHTML}</div>
                <div class="text-xs font-semibold">${title}</div>
            </div>
            <div class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity" onclick="removeNode('${nodeId}')">
                <i class="fas fa-times text-xs"></i>
            </div>
        `;
        
        // Make the node draggable within canvas
        let isDragging = false;
        let startX, startY, initialX, initialY;
        
        node.addEventListener('mousedown', (e) => {
            if (e.target.closest('.fa-times')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = node.offsetLeft;
            initialY = node.offsetTop;
            node.style.zIndex = '1000';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            node.style.left = (initialX + deltaX) + 'px';
            node.style.top = (initialY + deltaY) + 'px';
            
            updateConnections();
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                node.style.zIndex = 'auto';
            }
        });
        
        canvas.appendChild(node);
        workflowNodes.push({
            id: nodeId,
            type: nodeType,
            element: node,
            x: x - 60,
            y: y - 30
        });
        
        // Auto-connect nodes if there are multiple nodes
        if (workflowNodes.length > 1) {
            const prevNode = workflowNodes[workflowNodes.length - 2];
            createConnection(prevNode.id, nodeId);
        }
        
        // Animate node appearance
        anime({
            targets: node,
            scale: [0, 1],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutBack'
        });
    }

    function createConnection(fromId, toId) {
        const connectionId = 'conn-' + Date.now();
        connections.push({
            id: connectionId,
            from: fromId,
            to: toId
        });
        updateConnections();
    }

    function updateConnections() {
        svg.innerHTML = '';
        
        connections.forEach(conn => {
            const fromNode = workflowNodes.find(n => n.id === conn.from);
            const toNode = workflowNodes.find(n => n.id === conn.to);
            
            if (fromNode && toNode) {
                const fromRect = fromNode.element.getBoundingClientRect();
                const toRect = toNode.element.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const x1 = fromNode.element.offsetLeft + 60;
                const y1 = fromNode.element.offsetTop + 30;
                const x2 = toNode.element.offsetLeft + 60;
                const y2 = toNode.element.offsetTop + 30;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const midX = (x1 + x2) / 2;
                const d = `M ${x1} ${y1} Q ${midX} ${y1 - 20} ${x2} ${y2}`;
                
                line.setAttribute('d', d);
                line.setAttribute('class', 'connection-line');
                
                svg.appendChild(line);
            }
        });
    }

    function hidePlaceholder() {
        if (workflowNodes.length > 0 && placeholder) {
            placeholder.style.display = 'none';
        }
    }

    // Global functions for buttons
    window.removeNode = function(nodeId) {
        const nodeIndex = workflowNodes.findIndex(n => n.id === nodeId);
        if (nodeIndex > -1) {
            const node = workflowNodes[nodeIndex];
            
            // Remove connections
            connections = connections.filter(conn => 
                conn.from !== nodeId && conn.to !== nodeId
            );
            
            // Remove node element
            node.element.remove();
            
            // Remove from array
            workflowNodes.splice(nodeIndex, 1);
            
            updateConnections();
            
            if (workflowNodes.length === 0) {
                placeholder.style.display = 'flex';
            }
        }
    };

    window.clearCanvas = function() {
        workflowNodes.forEach(node => node.element.remove());
        workflowNodes = [];
        connections = [];
        svg.innerHTML = '';
        placeholder.style.display = 'flex';
    };

    window.runWorkflow = function() {
        if (workflowNodes.length === 0) {
            alert('يرجى إضافة عناصر إلى سير العمل أولاً!');
            return;
        }
        
        // Animate workflow execution
        let delay = 0;
        workflowNodes.forEach((node, index) => {
            setTimeout(() => {
                // Highlight current node
                anime({
                    targets: node.element,
                    scale: [1, 1.1, 1],
                    backgroundColor: ['#374151', '#10b981', '#374151'],
                    duration: 500,
                    easing: 'easeInOutQuad'
                });
                
                // Show execution message
                showExecutionMessage(node.type, index + 1);
            }, delay);
            delay += 800;
        });
        
        setTimeout(() => {
            showSuccessMessage();
        }, delay + 500);
    };

    function showExecutionMessage(nodeType, step) {
        const messages = {
            'trigger': 'تم تشغيل سير العمل...',
            'action': `تنفيذ الخطوة ${step}...`,
            'logic': 'اتخاذ القرار...',
            'integration': 'الاتصال بالتطبيق...'
        };
        
        // Create temporary message
        const message = document.createElement('div');
        message.className = 'fixed top-20 right-4 bg-green-600 text-white px-4 py-2 rounded-lg z-50';
        message.textContent = messages[nodeType] || `تنفيذ الخطوة ${step}...`;
        document.body.appendChild(message);
        
        // Animate message
        anime({
            targets: message,
            translateX: [300, 0],
            opacity: [0, 1],
            duration: 300,
            complete: () => {
                setTimeout(() => {
                    anime({
                        targets: message,
                        translateX: [0, 300],
                        opacity: [1, 0],
                        duration: 300,
                        complete: () => message.remove()
                    });
                }, 1500);
            }
        });
    }

    function showSuccessMessage() {
        const message = document.createElement('div');
        message.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white px-8 py-4 rounded-xl z-50 text-center';
        message.innerHTML = `
            <i class="fas fa-check-circle text-3xl mb-2"></i>
            <div class="text-lg font-semibold">تم تنفيذ سير العمل بنجاح!</div>
        `;
        document.body.appendChild(message);
        
        anime({
            targets: message,
            scale: [0, 1],
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutBack',
            complete: () => {
                setTimeout(() => {
                    anime({
                        targets: message,
                        scale: [1, 0],
                        opacity: [1, 0],
                        duration: 300,
                        complete: () => message.remove()
                    });
                }, 2000);
            }
        });
    }
}

// Counter animation
function initializeCounters() {
    const counters = document.querySelectorAll('[data-count]');
    
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.dataset.count);
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

// General animations
function initializeAnimations() {
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                anime({
                    targets: entry.target,
                    translateY: [50, 0],
                    opacity: [0, 1],
                    duration: 800,
                    easing: 'easeOutQuad',
                    delay: anime.stagger(100)
                });
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all feature cards and use case cards
    document.querySelectorAll('.bg-gray-800\\/50, .bg-gradient-to-br').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(50px)';
        observer.observe(el);
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile menu toggle (if needed)
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Add click handlers for buttons that don't have specific functionality
document.addEventListener('click', function(e) {
    const button = e.target.closest('button');
    if (button && !button.onclick && !button.getAttribute('onclick')) {
        const buttonText = button.textContent.trim();
        if (buttonText.includes('ابدأ') || buttonText.includes('شاهد')) {
            e.preventDefault();
            showComingSoonMessage();
        }
    }
});

// PWA Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful');
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    const installButton = document.createElement('div');
    installButton.className = 'fixed bottom-20 left-4 bg-green-600 text-white px-4 py-2 rounded-lg z-50 cursor-pointer';
    installButton.innerHTML = '<i class="fas fa-download mr-2"></i>تثبيت التطبيق';
    installButton.onclick = installApp;
    document.body.appendChild(installButton);
    
    setTimeout(() => {
        installButton.remove();
    }, 10000);
}

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    }
}

function showComingSoonMessage() {
    const message = document.createElement('div');
    message.className = 'fixed top-20 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg z-50';
    message.innerHTML = '<i class="fas fa-info-circle mr-2"></i>قريباً! هذه الميزة قيد التطوير';
    document.body.appendChild(message);
    
    anime({
        targets: message,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        complete: () => {
            setTimeout(() => {
                anime({
                    targets: message,
                    translateX: [0, 300],
                    opacity: [1, 0],
                    duration: 300,
                    complete: () => message.remove()
                });
            }, 2000);
        }
    });
}

function openEditor() {
    window.open('/editor', '_blank');
}