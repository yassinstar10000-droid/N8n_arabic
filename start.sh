#!/bin/bash

echo "🚀 بدء تشغيل تطبيق n8n العربي..."

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت. يرجى تثبيت Node.js أولاً."
    exit 1
fi

# التحقق من وجود npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm غير مثبت. يرجى تثبيت npm أولاً."
    exit 1
fi

# إنشاء مجلد قاعدة البيانات إذا لم يكن موجوداً
mkdir -p database

# تثبيت المتطلبات
echo "📦 تثبيت المتطلبات..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ تم تثبيت المتطلبات بنجاح"
    
    # تشغيل التطبيق
    echo "🎯 تشغيل التطبيق..."
    npm start
else
    echo "❌ خطأ في تثبيت المتطلبات"
    exit 1
fi