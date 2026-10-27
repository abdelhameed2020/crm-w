# دليل النشر والتشغيل الفعلي لنظام CRM مصنع أولاد يحيى (Online Production Deployment Guide)

يوثق هذا الدليل الخطوات الهندسية المعتمدة لنشر المنصة على الإنترنت وربط واجهة React المستضافة ببوابة الواتساب (WhatsApp Gateway) المشغلة لبروتوكول Baileys، بما يضمن الأمان، الاستقرار، وحفظ الجلسات من الانقطاع.

---

## 1. البنية المعمارية المعتمدة للإنتاج (Target Architecture)

```
[ متصفح المستخدم / هاتف الموظف ]
               │
               ▼ HTTPS (CDN عالمي)
 ┌──────────────────────────────┐
 │   Firebase Hosting           │  (استضافة واجهة React / Vite)
 │   crm-awlad-yahya.web.app    │  (شهادة SSL تلقائية مجانية)
 └──────────────┬───────────────┘
                │
                ├───► Firebase Firestore & Authentication (قواعد البيانات والمصادقة)
                │
                ▼ HTTPS / WSS (توكن JWT مشفر)
 ┌──────────────────────────────┐
 │   خادم البوابة (Gateway)     │  (خادم Linux VPS مع Nginx و SSL)
 │   wa-gateway.yourdomain.com  │  (Node.js + Baileys + Docker/PM2)
 └──────────────┬───────────────┘
                ├───► قرص تخزين دائم: /app/sessions (مفاتيح تشفير واتساب)
                └───► قرص تخزين دائم: /app/uploads (الوسائط والتسجيلات)
```

---

## 2. متطلبات ما قبل النشر (Prerequisites Checklist)

- [ ] حساب **Google Firebase** نشط يحتوي على مشروع `crm-awlad-yahya`.
- [ ] خادم **Linux VPS** صغير (موصى به: Ubuntu 22.04 / 24.04 LTS مع 1-2 vCPU و 2GB RAM، تكلفة: 4-6$ شهرياً مثل Hetzner أو DigitalOcean أو AWS Lightsail).
- [ ] نطاق (Domain / Subdomain) موجه إلى الـ VPS (مثال: `wa-gateway.awladyahya.com`).
- [ ] تثبيت **Docker & Docker Compose** أو **Node.js 20 & PM2** على الخادم.
- [ ] تثبيت **Firebase CLI** محلياً على جهاز التطوير: `npm install -g firebase-tools`.

---

## 3. خطوات نشر واجهة المستخدم (Frontend on Firebase Hosting)

### الخطوة 1: تسجيل الدخول لـ Firebase محلياً
```bash
firebase login
```

### الخطوة 2: ربط المشروع المحلي
```bash
firebase use crm-awlad-yahya
```

### الخطوة 3: إعداد متغيرات بيئة الإنتاج للواجهة
قبل بناء الواجهة للإنتاج، قم بإنشاء ملف `.env.production` (أو تعديل `.env`) ليحتوي على الرابط العام للبوابة:
```env
VITE_FIREBASE_API_KEY=AIzaSyBlc26xWhgmxwMeFxFhQ7w0PCDw0L8zgkc
VITE_FIREBASE_AUTH_DOMAIN=crm-awlad-yahya.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=crm-awlad-yahya
VITE_FIREBASE_STORAGE_BUCKET=crm-awlad-yahya.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=18481963471
VITE_FIREBASE_APP_ID=1:18481963471:web:90e47413eeddff58d3b2ba
VITE_FIREBASE_MEASUREMENT_ID=G-CLKFZ51QLZ
VITE_APP_NAME="OmniCRM - أولاد يحيى"
VITE_APP_DEFAULT_LANG=ar
VITE_WHATSAPP_PROVIDER=web

# الرابط الحقيقي للبوابة على الخادم المستضاف (HTTPS)
VITE_GATEWAY_URL=https://wa-gateway.awladyahya.com
VITE_GATEWAY_API_KEY=
```

### الخطوة 4: بناء وتصدير كود الواجهة
```bash
npm run build
```

### الخطوة 5: نشر القواعد والواجهة
```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```
فور اكتمال النشر، سيصبح الموقع متاحاً على:
`https://crm-awlad-yahya.web.app`

---

## 4. خطوات نشر بوابة الواتساب (Gateway on VPS)

### الخيار (أ) - النشر باستخدام Docker Compose (الموصى به):

1. **نسخ مجلد `gateway/` إلى الخادم:**
   ```bash
   scp -r ./gateway user@YOUR_SERVER_IP:/opt/omnicrm-gateway
   ```

2. **الدخول إلى الخادم وإعداد البيئة:**
   ```bash
   cd /opt/omnicrm-gateway
   cp .env.example .env
   nano .env
   ```
   اضبط القيم التالية في `.env`:
   ```env
   NODE_ENV=production
   GATEWAY_PORT=5001
   GATEWAY_API_KEY=ضع_هنا_كلمة_سر_عشوائية_قوية
   ALLOWED_ORIGINS=https://crm-awlad-yahya.web.app,https://crm-awlad-yahya.firebaseapp.com
   FIREBASE_PROJECT_ID=crm-awlad-yahya
   ```

3. **تشغيل الحاوية:**
   ```bash
   docker compose up -d --build
   ```

4. **التحقق من عمل البوابة:**
   ```bash
   curl http://localhost:5001/health
   ```

---

### الخيار (ب) - النشر المباشر عبر Node.js & PM2:

1. **تثبيت Node.js و PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

2. **بناء وتشغيل الخدمة:**
   ```bash
   cd /opt/omnicrm-gateway
   npm ci
   npm run build
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```

---

## 5. ضبط Nginx وتفعيل شهادة SSL (HTTPS)

1. **تثبيت Nginx و Certbot:**
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **إنشاء ملف تكوين Nginx:**
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/wa-gateway.conf
   sudo nano /etc/nginx/sites-available/wa-gateway.conf
   # قم بتعديل server_name إلى النطاق الخاص بك
   sudo ln -s /etc/nginx/sites-available/wa-gateway.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **إصدار شهادة SSL مجانية:**
   ```bash
   sudo certbot --nginx -d wa-gateway.awladyahya.com
   ```

---

## 6. حفظ واستعادة جلسة الواتساب (Session Persistence & Disaster Recovery)

> [!IMPORTANT]
> جلسة الواتساب ومفاتيح التشفير مخزنة داخل مجلد `sessions/`. في حال الحاجة لنقل الخادم دون إعادة مسح كود QR من الهاتف:

1. **النسخ الاحتياطي لجلسة العمل:**
   ```bash
   tar -czvf wa_session_backup_$(date +%F).tar.gz /opt/omnicrm-gateway/sessions
   ```
2. **استعادة الجلسة على خادم جديد:**
   ```bash
   tar -xzvf wa_session_backup_2026-xx-xx.tar.gz -C /opt/omnicrm-gateway/
   ```
3. في حال انفصال الجلسة، يقوم النظام تلقائياً بمحاولة إعادة الاتصال (Auto-reconnect)، وإذا انتهت صلاحية الجلسة، يظهر كود QR في صفحة إعدادات النظام داخل الـ CRM لمسحه مجدداً.

---

## 7. تنبيهات استقرار بروتوكول Baileys

1. **بروتوكول غير رسمي:** Baileys يحاكي WhatsApp Web. لتجنب الحظر:
   * لا تقم بإرسال رسائل ترويجية جماعية عشوائية (Bulk Spam).
   * حافظ على تشغيل الخدمة على عنوان IP ثابت (VPS) وتجنب تكرار تسجيل الدخول والخروج في فترات قصيرة.
2. **النسخ الاحتياطي الدوري:** احرص على أخذ نسخة أسبوعية من مجلد `sessions` ومجلد `uploads`.
