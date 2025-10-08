#!/bin/bash

echo "🚀 بدء بناء تطبيق Android..."

# التحقق من المتطلبات
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm غير مثبت"
    exit 1
fi

# الانتقال إلى مجلد التطبيق
cd mobile-app

echo "📦 تثبيت المتطلبات..."
npm install

echo "🔧 تثبيت Capacitor CLI..."
npm install -g @capacitor/cli

echo "⚙️ إضافة منصة Android..."
npx cap add android

echo "🔄 مزامنة المشروع..."
npx cap sync

echo "📱 بناء تطبيق Android..."
npx cap build android

echo "✅ تم بناء تطبيق Android بنجاح!"
echo "📱 يمكنك الآن فتح المشروع في Android Studio:"
echo "   npx cap open android"

cd ..