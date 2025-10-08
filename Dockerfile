FROM node:18-alpine

WORKDIR /app

# نسخ ملف package.json وnpm install
COPY package*.json ./
RUN npm ci --only=production

# نسخ باقي الملفات
COPY . .

# إنشاء مجلدات ضرورية
RUN mkdir -p database logs

# فتح المنفذ
EXPOSE 3000

# تشغيل التطبيق
CMD ["npm", "start"]