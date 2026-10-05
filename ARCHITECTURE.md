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
   - لا يمكنه رؤية إعدادات القنوات الحساسة أو تعديل الصلاحيات.

---

## 5. معمارية القنوات المتعددة (Multi-Channel Architecture)

تم تطبيق نمط التصميم **Strategy Pattern** عبر:
- واجهة `IChannelProvider`: تحدد العقود المشتركة:
  - `initialize(account)`
  - `checkHealth(account)`
  - `sendMessage(account, payload)`
  - `parseWebhookPayload(rawPayload)`
- فئة `ChannelManager`: تدير تسجيل واختيار المزود المناسب بناءً على نوع القناة تلقائياً.
- مزودات مستقلة:
  - `WhatsAppProvider`
  - `MessengerProvider`
  - `InstagramProvider`
  - `WebsiteChatProvider`

---

## 6. استراتيجية الأمان (Security Strategy & Firestore Rules)

- تم إعداد ملف `firestore.rules` لحماية البيانات عند مستوى قاعدة البيانات مباشرة.
- الدوال المساعدة:
  - `isAuthenticated()`: التحقق من وجود تسجيل دخول نشط.
  - `getUserRole()`: استعلام آمن لدور المستخدم من سجل Firestore.
  - `isAdmin()`, `isManager()`, `isEmployee()`: التحقق الصارم من الرتبة.
- منع التعديل على الحقول الحساسة مثل `role` و `permissions` إلا بواسطة Admin حصراً.
- عزل المحادثات بحيث لا يملك الموظف العادي صلاحية قراءة أو تعديل محادثات لم تُعين له.

---

## 7. خارطة المراحل المستقبلية (Roadmap)

1. **المرحلة 2 (Channels & Webhooks Integration)**:
   - ربط WhatsApp Cloud API عبر Firebase Cloud Functions.
   - استقبال الـ Inbound Webhooks وتخزينها الفوري في Firestore.
   - إرسال الرسائل عبر Meta Graph API.
2. **المرحلة 3 (Automation & Auto-Assignment)**:
   - محرك التوزيع التلقائي (Round-Robin & Least Active).
   - الردود الجاهزة السريعة (Canned Responses).
3. **المرحلة 4 (AI Agent & Smart Assistance)**:
   - تلخيص المحادثات، اقتراح الردود الذكية، وروبوت المحادثة المبدئي.
