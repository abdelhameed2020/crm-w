# منصة OmniCRM - صندوق المحادثات الموحد وإدارة علاقات العملاء
## (Omnichannel CRM & Unified Inbox Platform)

منصة احترافية وقابلة للتوسع لإدارة محادثات العملاء عبر القنوات المتعددة (WhatsApp Cloud API, Facebook Messenger, Instagram Direct, Website Live Chat) والـ Leads ومسار المبيعات وصلاحيات فريق العمل.

---

## 🚀 التقنيات المستخدمة (Tech Stack)

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (RTL & Arabic-first، متجاوب بالكامل مع Desktop, Tablet, Mobile)
- **Backend & Database**: Firebase Authentication + Cloud Firestore
- **Serverless**: Firebase Cloud Functions
- **Icons**: Lucide React
- **Architecture**: Modular Domain-Driven Design مع Strategy Pattern للقنوات المتعددة

---

## 📁 الهيكل المعماري (Architecture Highlights)

- **Channel-Agnostic Abstraction**: طبقة موحدة `IChannelProvider` لعزل واجهات Meta وواجهات القنوات عن منطق التطبيق.
- **Strict Role-Based Access Control (RBAC)**: ثلاثة أدوار رئيسية (Admin / Manager / Employee) محمية عبر `firestore.rules`.
- **Unified Inbox Layout**: تصميم 3 أعمدة (قائمة المحادثات ← الرسائل الحالية ← لوحة بيانات العميل والملاحظات والوسوم).
- **Graceful Offline/Dev Mode**: التطبيق يعمل فورياً للاستعراض والتطوير دون توقف حتى قبل إدخال مفاتيح Firebase.

---

## 🛠️ متطلبات التشغيل (Prerequisites)

- **Node.js**: الإصدار 18 أو 20 أو 22 (LTS)
- **npm**: الإصدار 9 أو أحدث
- **Git**

---

## 💻 طريقة التثبيت والتشغيل محلياً (Local Setup)

### 1. استنساخ المستودع والدخول للمجلد:
```bash
git clone <repository-url>
cd CRM
```

### 2. تثبيت الحزم:
```bash
npm install
```

### 3. إعداد متغيرات البيئة (Environment Variables):
انسخ ملف `.env.example` إلى `.env`:
```bash
cp .env.example .env
```
ثم قم بملء إعدادات مشروع Firebase الخاص بك من لوحة تحكم [Firebase Console](https://console.firebase.google.com):
```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-app-id"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
```

> **ملاحظة**: في حال عدم وجود مفاتيح Firebase بعد، سيعمل المشروع تلقائياً في وضع المعاينة الهندسية لتجربة الواجهة وصندوق المحادثات ومبدل الصلاحيات.

### 4. تشغيل خادم التطوير المحلي:
```bash
npm run dev
```
سيفتح التطبيق افتراضياً على: `http://localhost:3000`

### 5. فحص الـ TypeScript وبناء المشروع للإنتاج:
```bash
npm run build
```

### 6. معاينة نسخة الإنتاج:
```bash
npm run preview
```

---

## 🛡️ قواعد الأمان (Firebase Security Rules)

ملف `firestore.rules` موجود في جذر المشروع. لنشره على Firebase:
```bash
firebase deploy --only firestore:rules
```

---

## 📑 الوثائق الفنية المفصلة

للاطلاع على تفاصيل هيكل قاعدة البيانات، نمط تصميم القنوات، وعلاقات الجداول:
راجع ملف [ARCHITECTURE.md](ARCHITECTURE.md).
