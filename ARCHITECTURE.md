# وثيقة المعمارية الفنية لمنصة إدارة المحادثات الموحدة وCRM
## (Omnichannel CRM & Unified Inbox Architecture Specification)

---

## 1. نظرة عامة وفلسفة النظام (System Philosophy)

تم تصميم هذا النظام ليكون منصة مركزية مستقلة لإدارة محادثات العملاء والمبيعات (Omnichannel CRM & Unified Inbox) لخدمة قنوات متعددة تشمل:
- **WhatsApp Cloud API**
- **Facebook Messenger**
- **Instagram Direct** (جاهز للمراحل القادمة)
- **Website Live Chat Widget** (جاهز للمراحل القادمة)

### المبادئ المعمارية الأساسية:
1. **Channel-Agnostic Core**: فصل منطق الـ CRM وصندوق المحادثات تماماً عن تفاصيل واجهات Meta وواجهات القنوات الخارجية عبر طبقة تجريد موحدة (`IChannelProvider`).
2. **Strict Layering**: منع استدعاءات Firestore أو واجهات API الخارجية من التواجد مباشرة داخل مكونات واجهة المستخدم (UI Components).
3. **True Security via Firestore Rules**: عدم الاعتماد على حماية الـ Frontend فقط، بل إخضاع جميع العمليات لصلاحيات حقيقية مبنية على الأدوار (RBAC) في `firestore.rules`.
4. **Arabic-First & RTL Responsive**: واجهة عربية كاملة وسريعة ومتجاوبة مع الهواتف الذكية والأجهزة اللوحية وأجهزة سطح المكتب.
5. **No Mock Databases**: ربط حقيقي مباشر مع Firebase مع دعم وضع المعاينة الذاتي في حال عدم إدخال مفاتيح `.env`.

---

## 2. هيكل المجلدات (Folder Structure)

```text
CRM/
├── .env.example                  # نموذج متغيرات البيئة لإعدادات Firebase
├── .gitignore                    # الملفات والمجلدات المستثناة من Git
├── ARCHITECTURE.md               # الوثيقة المعمارية الشاملة
├── README.md                     # دليل تشغيل وتثبيت المشروع محلياً
├── firebase.json                 # إعدادات خدمات Firebase والـ Hosting
├── firestore.rules               # قواعد الأمان الصارمة لقاعدة البيانات (RBAC)
├── index.html                    # ملف HTML الرئيسي (dir="rtl" مع خط Cairo)
├── package.json                  # حزم المشروع والاعتمادات
├── postcss.config.js             # إعدادات معالجة CSS
├── tailwind.config.js            # ثيم Tailwind وتدرجات الألوان والقنوات
├── tsconfig.json                 # إعدادات TypeScript الصارمة
├── tsconfig.node.json            # إعدادات TypeScript لبيئة Node/Vite
├── vite.config.ts                # إعدادات Vite مع Path Aliases (@/)
│
├── functions/                    # طبقة Firebase Cloud Functions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts              # نقطة استقبال Webhooks المستقبلية
│
└── src/
    ├── main.tsx                  # نقطة الانطلاق الرئيسية لتطبيق React
    ├── App.tsx                   # محرك التوجيه (React Router) وحاوية الـ Auth
    ├── index.css                 # توجيهات Tailwind والتنسيقات العامة
    ├── vite-env.d.ts             # تعريفات بيئة Vite والمتغيرات
    │
    ├── types/                    # تعريفات TypeScript العامة والصارمة
    │   ├── index.ts              # تصدير مجمّع لكافة الـ Types
    │   ├── auth.types.ts         # أدوار المستخدمين وصلاحياتهم (Admin/Manager/Employee)
    │   ├── channel.types.ts      # أنواع القنوات وحالاتها (WhatsApp/Messenger/...)
    │   ├── customer.types.ts     # العملاء والـ Leads والأنشطة والوسوم
    │   ├── conversation.types.ts # المحادثات وحالاتها وتعيينات الموظفين
    │   ├── message.types.ts      # الرسائل وأنواع الوسائط وحالات التسليم
    │   ├── employee.types.ts     # بيانات الموظفين وسعة المحادثات
    │   ├── pipeline.types.ts     # مسارات المبيعات والصفقات والمراحل
    │   ├── report.types.ts       # مقاييس لوحة التحكم والتقارير
    │   └── settings.types.ts     # إعدادات المنشأة والنظام
    │
    ├── services/                 # طبقة الخدمات الخارجية
    │   ├── firebase/             # خدمات Firebase المستقلة
    │   │   ├── config.ts         # تهيئة Firebase App و Auth و Firestore
    │   │   ├── collections.ts    # ثوابت أسماء الـ Collections
    │   │   ├── firestore.service.ts # خدمة Firestore العامة القوية
    │   │   ├── auth.service.ts   # خدمة المصادقة وجلب البروفايل
    │   │   ├── conversations.service.ts # إدارة المحادثات وتعيين الموظفين
    │   │   ├── messages.service.ts      # إرسال واستقبال الرسائل
    │   │   ├── customers.service.ts     # إدارة العملاء والملاحظات والأنشطة
    │   │   ├── employees.service.ts     # إدارة الموظفين
    │   │   ├── pipeline.service.ts      # مسار المبيعات
    │   │   └── reports.service.ts       # إحصائيات لوحة التحكم
    │   │
    │   └── channels/             # طبقة تجريد قنوات التواصل
    │       ├── ChannelProvider.interface.ts # واجهة العقد الموحدة (IChannelProvider)
    │       ├── ChannelManager.ts            # سجل وإدارة المزودين (Strategy Pattern)
    │       └── providers/
    │           ├── WhatsAppProvider.ts      # مزود WhatsApp Cloud API
    │           ├── MessengerProvider.ts     # مزود Facebook Messenger
    │           ├── InstagramProvider.ts     # مزود Instagram Direct
    │           └── WebsiteChatProvider.ts   # مزود ودجت شات الموقع
    │
    ├── layouts/                  # تخطيط الواجهة الأساسي
    │   ├── AppLayout.tsx         # الحاوية الرئيسية (Sidebar + Topbar + Outlet)
    │   ├── Sidebar.tsx           # القائمة الجانبية RTL مع مبدل الأدوار للمعاينة
    │   └── Topbar.tsx            # الشريط العلوي مع البحث وحالة القنوات وFirebase
    │
    ├── features/                 # وحدات الميزات المشتركة
    │   └── auth/
    │       └── AuthContext.tsx   # سياق المصادقة مع دعم الحالات التجريبية
    │
    ├── hooks/                    # خطافات React المخصصة
    │   └── useAuth.ts            # خطاف الوصول السريع لبيانات المستخدم والصلاحيات
    │
    ├── components/               # المكونات المشتركة القابلة لإعادة الاستخدام
    │   └── common/
    │       ├── Button.tsx        # زر مخصص يدعم الحالات المختلفة والتحميل
    │       ├── Badge.tsx         # شارات الحالات والقنوات
    │       ├── Card.tsx          # بطاقات المحتوى ولوحة التحكم
    │       ├── EmptyState.tsx    # حالات الفراغ الاحترافية
    │       └── ChannelIcon.tsx   # أيقونة وهوية القنوات الموحدة
    │
    └── pages/                    # صفحات النظام الرئيسية
        ├── auth/
        │   └── LoginPage.tsx     # شاشة تسجيل الدخول
        ├── dashboard/
        │   └── DashboardPage.tsx # لوحة التحكم والمؤشرات الإحصائية
        ├── inbox/
        │   └── InboxPage.tsx     # صندوق المحادثات الموحد (3 أعمدة)
        ├── customers/
        │   └── CustomersPage.tsx # إدارة العملاء والـ Leads
        ├── pipeline/
        │   └── PipelinePage.tsx  # مسار المبيعات والصفقات
        ├── employees/
        │   └── EmployeesPage.tsx # فريق العمل والصلاحيات
        ├── reports/
        │   └── ReportsPage.tsx   # التقارير وتحليلات الأداء
        └── settings/
            └── SettingsPage.tsx  # إعدادات النظام والقنوات
```

---

## 3. معمارية قاعدة البيانات Firestore (Database Schema & Relations)

صُممت المجموعات (Collections) بطريقة تضمن الأداء العالي والارتباط المرن:

### 3.1 هيكل المجموعات الرئيسية:
1. `users`:
   - حسابات النظام والمصادقة (`id`, `email`, `displayName`, `role`: admin|manager|employee, `department`, `isActive`, `createdAt`).
2. `employees`:
   - الملف الوظيفي لفريق العمل (`id`, `name`, `email`, `role`, `department`, `isOnline`, `activeConversationsCount`, `maxActiveChats`).
3. `customers`:
   - العملاء والـ Leads (`id`, `name`, `phone`, `email`, `leadStatus`: new|contacted|qualified|proposal|won|lost, `tags`, `assignedEmployeeId`, `sourceChannel`, `dealsCount`, `dealsTotalValue`).
4. `conversations`:
   - المحادثات (`id`, `customerId`, `customerName`, `customerPhone`, `channel`: whatsapp|messenger|instagram|website, `channelAccountId`, `status`: open|pending|resolved|closed, `priority`, `assignedEmployeeId`, `assignedEmployeeName`, `lastMessageSnippet`, `lastMessageTimestamp`, `unreadCount`, `tags`).
5. `messages`:
   - الرسائل (`id`, `conversationId`, `customerId`, `channel`, `senderType`: customer|employee|system|bot, `senderId`, `content`, `messageType`: text|image|video|audio|document|location|sticker|template|system, `media`, `status`: sending|sent|delivered|read|failed, `timestamp`, `externalMessageId`).
6. `channels`:
   - بيانات الحسابات والقنوات المتصلة (`id`, `type`, `name`, `identifier`, `status`, `isActive`).
7. `tags`:
   - وسوم تصنيف العملاء والمحادثات (`id`, `name`, `color`).
8. `activities`:
   - سجل الأنشطة والتدقيق لكل عميل (`id`, `customerId`, `type`, `description`, `performedBy`, `timestamp`).
9. `notes`:
   - الملاحظات الداخلية لفريق العمل (`id`, `customerId`, `authorId`, `authorName`, `content`, `createdAt`).
10. `pipelines` & `pipelineStages`:
    - صفقات المبيعات والمراحل في مسار البيع.
11. `settings`:
    - إعدادات المنشأة وساعات العمل والتوزيع التلقائي.

### 3.2 العلاقات الهندسية (Relationships):
- **عميل واحد (Customer)** ← يملك عدة محادثات (**1-to-Many Conversations**)
- **محادثة واحدة (Conversation)** ← تحتوي على عدة رسائل (**1-to-Many Messages**)
- **محادثة واحدة (Conversation)** ← ترتبط بقناة تواصل واحدة (**Bound to Channel**)
- **محادثة واحدة (Conversation)** ← تعين لموظف مسؤول (**Assigned to Employee**)
- **عميل واحد (Customer)** ← يملك وسوم وملاحظات وسجل أنشطة (**Tags, Notes, Activities**)

---

## 4. نموذج المصادقة والأدوار والصلاحيات (RBAC Model)

النظام مهيأ بثلاث مستويات صلاحية واضحة:
1. **Admin (مدير النظام)**:
   - الوصول الكامل لجميع البيانات والتقارير.
   - إدارة قنوات الاتصال وإدخال مفاتيح الربط والـ Webhooks.
   - تعديل وتعيين أدوار الموظفين.
2. **Manager (مدير الفريق)**:
   - متابعة جميع المحادثات وإعادة توزيعها وتعيينها للموظفين.
   - الاطلاع على مؤشرات الأداء والتقارير ومسار المبيعات.
   - إدارة الوسوم وتعديل حالات المحادثات.
3. **Employee (موظف خدمة العملاء / المبيعات)**:
   - الوصول للمحادثات المعينة له أو المحادثات المفتوحة غير المعينة التي يمكن استلامها.
   - إرسال الردود، إضافة الملاحظات والأنشطة للعملاء، وتحديث حالة الصفقات المعنية.
### 4.1 مصفوفة الصلاحيات المفصلة (RBAC Permission Matrix):

| الوحدة / الخاصية | Admin (مدير النظام) | Manager (مدير الفريق) | Employee (الموظف) | آلية الحماية وقواعد الأمان |
| :--- | :--- | :--- | :--- | :--- |
| **المستخدمون (`users`)** | تحكم كامل (Full) | قراءة فقط (Read) | تعديل الملف الشخصي (دون الدور) | منع تصعيد الرتب الذاتي في Firestore Rules |
| **فريق العمل (`employees`)** | إضافة، تعديل، حذف | تعديل الجاهزية والورديات | قراءة الدليل العام | حذف الموظفين محصور بالـ Admin |
| **المحادثات (`conversations`)** | وصول لجميع المحادثات | مراقبة وتعيين للجميع | محادثاته المعينة + غير المعينة | يمنع الموظف من سرقة محادثة زميله |
| **الرسائل (`messages`)** | وصول وحذف كامل | قراءة وإرسال ومراقبة | قراءة وإرسال لمحادثاته المصرح بها | معزولة بدالة `canAccessConversation` |
| **العملاء والـ Leads (`customers`)** | تحكم كامل وحذف | متابعة وتعديل كامل | قراءة وتحديث بيانات والوسوم | حذف العميل محصور بالـ Admin |
| **مسار المبيعات (`pipelines`)** | كشف مالي وأرقام كاملة | متابعة صفقات الفريق | صفقات الموظف المعينة له فقط | حماية المبالغ والأرباح من اطلاع عامة الموظفين |
| **التقارير (`reports`)** | تقارير شاملة للمنظمة | تقارير أداء الفريق | مؤشرات إنجاز الموظف الخاصة فقط | استعلامات مخصصة حسب الدور بدون تجاوز |
| **إعدادات القنوات (`channels`)** | ربط وتعديل وتعيين المفاتيح | قراءة حالة النشاط | استخدام القناة للرد فقط | أسرار Meta معزولة في `channel_secrets` |
| **إعدادات المنشأة (`settings`)** | تحكم كامل بالنظام | قراءة فقط | محجوب كلياً | حماية كاملة على مستوى Routing و Rules |
| **حسابات واتساب (`whatsappAccounts`)** | إضافة وحذف وتوليد QR | قراءة الحسابات المصرحة | استخدام الخطوط المصرح بها | قراءة للموظف وكتابة حصراً للـ Admin |

---

## 5. معمارية القنوات المتعددة واستراتيجية التبديل (Multi-Channel & Swappable Provider Architecture)

تم تطبيق نمط التصميم **Strategy Pattern** لتجريد جميع قنوات المحادثة:
- واجهة `IChannelProvider`: تحدد العقود المشتركة:
  - `initialize(account)`
  - `checkHealth(account)`
  - `sendMessage(account, payload)`
  - `parseWebhookPayload(rawPayload)`
- فئة `ChannelManager`: تدير تسجيل واختيار المزود المناسب بناءً على نوع القناة وعلم البيئة (`Feature Flag`):
  - `VITE_WHATSAPP_PROVIDER=web`: يفعل `WhatsAppWebProvider` المرتبط بالبوابة التجريبية المستقلة (Gateway).
  - `VITE_WHATSAPP_PROVIDER=cloud`: يفعل `WhatsAppCloudProvider` المخصص لـ WhatsApp Cloud API الرسمي لاحقاً دون تعديل سطر واحد في واجهة الـ CRM أو الـ Unified Inbox.
- مزودات مستقلة:
  - `WhatsAppWebProvider` (تجريبي - Phase 3)
  - `WhatsAppCloudProvider` (رسمي - Meta Cloud API)
  - `MessengerProvider`
  - `InstagramProvider`
  - `WebsiteChatProvider`

---

## 6. معمارية بوابة واتساب التجريبية (WhatsApp Web Gateway Architecture)

### 6.1 اختيار المكتبة (Library Selection Rationale)
تم اختيار مكتبة **`@whiskeysockets/baileys`** بدلاً من `whatsapp-web.js`:
1. **استهلاك الذاكرة والأداء**: تتواصل Baileys مباشرة مع خوادم واتساب عبر بروتوكول WebSocket والـ Multi-Device Binary Protobuf، مما يستهلك أقل من 35 ميجابايت من الذاكرة لكل خط، مقارنة بـ `whatsapp-web.js` التي تتطلب متصفح Chromium/Puppeteer ضخم (أكثر من 450 ميجابايت لكل جلسة ومشاكل استقرار على خوادم السحاب).
2. **استقرار البيئة ونظام التشغيل**: تدعم Baileys بيئة Node.js 22 الحديثة ونظام Windows بدون الحاجة إلى تثبيت binary drivers لمتصفح Chrome.
3. **توليد QR Code نقي**: تُصدر Baileys بيانات الرمز كنص خام يُحول فورياً عبر `qrcode` إلى صورة Base64 Data URL لتُعرض داخل واجهة الـ CRM بسلاسة.

### 6.2 إدارة الجلسات والأمان (Session Isolation & Security)
- **عزل المفاتيح والرموز**: تُخزن مفاتيح التشفير وجلسات Baileys حصراً داخل مسار محلي مشفر ومحمي `gateway/sessions/<accountId>/`.
- **ممنوع تخزين التوكن في Firestore**: لا تُخزن أية رموز جلسة أو مفاتيح تشفير في Firestore أو Git (مدرجة في `.gitignore`).
- **بيانات Firestore المسموحة (`whatsappAccounts`)**:
  - `id`, `displayName`, `phoneNumber`, `status`, `assignedEmployees`, `lastConnectedAt`, `createdAt`, `updatedAt`.
- **حماية خادم البوابة**: خادم الـ Gateway محمي عبر Header سري `x-gateway-key` يمنع أي وصول غير مصرح به.

### 6.3 المزامنة التلقائية مع الـ CRM (Inbound Sync Service)
عند وصول أي رسالة جديدة عبر واتساب:
1. التحقق من العميل في `customers`: في حال عدم وجوده، يتم إنشاؤه تلقائياً بالاسم ورقم الهاتف والوسم `whatsapp`.
2. التحقق من المحادثة في `conversations`: في حال وجود محادثة مفتوحة، يتم تحديث آخر رسالة وتوقيتها وزيادة `unreadCount`، أو إنشاء محادثة جديدة تلقائياً.
3. إنشاء سجل الرسالة في `messages`: تسجيل نص الرسالة ونوعها وتنزيل الوسائط المرفقة (صور، مستندات، مقاطع صوتية) وتخزينها في مجلد `gateway/uploads/` برابط مباشر.

### 6.4 استراتيجية إعادة الاتصال (Exponential Backoff Reconnection)
- عند انقطاع الاتصال العرضي بسبب الشبكة، يعيد الخادم المحاولة تلقائياً بعد فترات تزايدية: 2s -> 3s -> 4.5s -> 6.75s -> 10s (بحد أقصى 5 محاولات).
- في حال تسجيل الخروج الصريح من الهاتف (`DisconnectReason.loggedOut` أو كود 401)، تُلغى الجلسة تلقائياً وتتحول الحالة إلى `disconnected` وتُحذف ملفات الجلسة المنتهية لتمكين المستخدم من مسح رمز جديد.

---

## 7. استراتيجية الأمان (Security Strategy & Firestore Rules)

- تم إعداد ملف `firestore.rules` لحماية البيانات عند مستوى قاعدة البيانات مباشرة.
- الدوال المساعدة:
  - `isAuthenticated()`: التحقق من وجود تسجيل دخول نشط.
  - `getUserRole()`: استعلام آمن لدور المستخدم من سجل Firestore.
  - `isAdmin()`, `isManager()`, `isEmployee()`: التحقق الصارم من الرتبة.
- منع التعديل على الحقول الحساسة مثل `role` و `permissions` إلا بواسطة Admin حصراً.
- عزل المحادثات بحيث لا يملك الموظف العادي صلاحية قراءة أو تعديل محادثات لم تُعين له.
- تخصيص `whatsappAccounts` بحيث يُسمح للموظف بالقراءة فقط، وتقتصر الإضافة والتعديل والحذف على الـ Admin.

---

## 8. خارطة المراحل المستقبلية (Roadmap)

1. **المرحلة الحالية (Phase 3 - Experimental WhatsApp Web Gateway)**:
   - تشغيل البوابة التجريبية المستقلة وإدارة أرقام واتساب برمز الاستجابة السريعة (QR Code).
   - اختبار المحادثات الواردة والصادرة عبر الـ Unified Inbox.
2. **المرحلة القادمة (Phase 4 - Official Meta Cloud API Integration)**:
   - دعم التبديل السلس إلى `WhatsAppCloudProvider` و `MessengerProvider`.
   - إدارة قوالب Meta المعتمدة (Approved Templates) و الـ Webhooks عبر Firebase Cloud Functions.
3. **المرحلة 5 (AI Agent & Smart Automation)**:
   - التوزيع الذكي، الردود التلقائية، وتلخيص المحادثات بالذكاء الاصطناعي.

