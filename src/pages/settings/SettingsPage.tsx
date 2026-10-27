import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Shield,
  Globe,
  Bell,
  Check,
  Copy,
  ExternalLink,
  Save,
  Clock,
  Volume2,
  UserCheck,
  Smartphone,
  Code,
  X,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ChannelIcon } from '../../components/common/ChannelIcon';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { AutoAssignmentService, DEFAULT_ASSIGNMENT_SETTINGS } from '../../services/assignment/AutoAssignmentService';
import type { AutoAssignmentSettings } from '../../types/settings.types';
import { InstallPwaButton } from '../../components/pwa/InstallPwaButton';

type SettingsTab = 'channels' | 'company' | 'roles' | 'notifications' | 'auto_assignment';

export const SettingsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('channels');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Auto-hide alert
  useEffect(() => {
    if (saveSuccessMessage) {
      const timer = setTimeout(() => setSaveSuccessMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMessage]);

  // Tab 1: Channel Modal Config
  const [activeConfigChannel, setActiveConfigChannel] = useState<string | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [channelConfigs, setChannelConfigs] = useState({
    cloudWaPhoneId: '',
    cloudWaWabaId: '',
    cloudWaToken: '',
    messengerPageId: '',
    messengerToken: '',
    instagramId: '',
    instagramToken: '',
    webChatTitle: 'محادثة مباشرة مع أولاد يحيى',
    webChatColor: '#0284c7',
    webChatWelcome: 'أهلاً بك! كيف يمكننا مساعدتك في تجهيزات كراسي وصالونات الحلاقة؟',
  });

  // Tab 2: Company Profile
  const [companyData, setCompanyData] = useState({
    name: 'أولاد يحيى لتجارة وتصنيع كراسي الحلاقة',
    crNumber: '10482910',
    taxNumber: '300948210',
    email: 'contact@awlad-yahya.com',
    phone: '+201129161770',
    address: 'القاهرة - جمهورية مصر العربية',
    website: 'https://awlad-yahya.com',
    workStart: '09:00',
    workEnd: '18:00',
    days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'],
    autoReply: 'شكراً لتواصلك مع أولاد يحيى. نحن خارج ساعات العمل الرسمية حالياً. سيقوم فريق المبيعات بالرد على استفسارك فور بدء يوم العمل القادم.',
  });

  // Tab 4: Notifications
  const [notificationSettings, setNotificationSettings] = useState({
    soundEnabled: true,
    browserPush: true,
    assignedAlert: true,
    delayedAlert: true,
    delayedMinutes: '15',
  });

  // Tab 5: Auto-Assignment & SLA Rules
  const [autoAssignmentSettings, setAutoAssignmentSettings] = useState<AutoAssignmentSettings>(DEFAULT_ASSIGNMENT_SETTINGS);

  useEffect(() => {
    AutoAssignmentService.getSettings().then((s) => setAutoAssignmentSettings(s));
  }, []);

  const handleSaveAutoAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    await AutoAssignmentService.saveSettings(autoAssignmentSettings);
    setSaveSuccessMessage('تم حفظ إعدادات التوزيع التلقائي ومهلات SLA بنجاح!');
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('omnicrm_company_settings', JSON.stringify(companyData));
    setSaveSuccessMessage('تم حفظ بيانات المنشأة ومواعيد العمل بنجاح!');
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('omnicrm_notification_settings', JSON.stringify(notificationSettings));
    setSaveSuccessMessage('تم حفظ تفضيلات التنبيهات والإشعارات بنجاح!');
  };

  const handleSaveChannelConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('omnicrm_channel_configs', JSON.stringify(channelConfigs));
    setActiveConfigChannel(null);
    setSaveSuccessMessage('تم حفظ إعدادات القناة بنجاح!');
  };

  const testNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio fallback
    }
  };

  const copyWidgetCode = () => {
    const code = `<script>
  window.OmniChatConfig = {
    appId: "crm_awlad_yahya",
    title: "${channelConfigs.webChatTitle}",
    color: "${channelConfigs.webChatColor}",
    welcomeMessage: "${channelConfigs.webChatWelcome}"
  };
</script>
<script src="https://cdn.omnicrm.app/widget.js" async></script>`;
    navigator.clipboard.writeText(code);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">إعدادات النظام والقنوات</h1>
          <p className="text-xs text-slate-500 mt-1">
            تهيئة قنوات التواصل الموحدة، إعدادات المنشأة، الصلاحيات الأمنية، والتنبيهات.
          </p>
        </div>
        {saveSuccessMessage && (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* PWA App Install Banner */}
      <InstallPwaButton variant="banner" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Tabs List */}
        <div className="space-y-1.5 lg:col-span-1">
          {[
            { id: 'channels' as const, label: 'قنوات التواصل الموحدة', icon: MessageSquare, badge: 'نشطة' },
            { id: 'auto_assignment' as const, label: 'التوزيع التلقائي وSLA', icon: Sliders, badge: 'Round Robin' },
            { id: 'company' as const, label: 'بيانات المنشأة وساعات العمل', icon: Globe },
            { id: 'roles' as const, label: 'الأدوار والصلاحيات (RBAC)', icon: Shield },
            { id: 'notifications' as const, label: 'التنبيهات والإشعارات', icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            const isCurrent = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/70 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isCurrent ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="p-4 bg-brand-50/60 border border-brand-100 rounded-2xl mt-4">
            <div className="flex items-center gap-2 text-brand-800 font-bold text-xs mb-1">
              <Shield className="w-4 h-4 text-brand-600" />
              <span>مستوى صلاحيتك</span>
            </div>
            <p className="text-[11px] text-brand-700 leading-relaxed">
              أنت مسجل كـ <strong>{isAdmin ? 'مدير نظام (Admin)' : user?.role === 'manager' ? 'مشرف' : 'موظف'}</strong>.
              {isAdmin ? ' لديك كامل الصلاحيات لتعديل الإعدادات والربط.' : ' التعديلات مقصورة على مديري النظام.'}
            </p>
          </div>
        </div>

        {/* Content Panels */}
        <div className="lg:col-span-3 space-y-5">
          {/* TAB 1: Channels Configuration */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              <Card
                title="القنوات المتاحة للربط الموحد"
                subtitle="قم بربط قنوات التواصل لاستقبال جميع الرسائل في صندوق محادثات مركزي واحد"
              >
                <div className="divide-y divide-slate-100 space-y-4">
                  {/* WhatsApp Web Gateway (Active) */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">بوابة واتساب ويب (WhatsApp Web Gateway)</h4>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            متصل ونشط
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          ربط مباشر عبر مسح QR Code بدون الحاجة لتراخيص ميتا السحابية الرسمية.
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                          الرقم المتصل: <span className="text-slate-700 font-bold" dir="ltr">+201129161770</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <Link to="/whatsapp">
                        <Button variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                          إدارة جلسة الواتساب
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Meta WhatsApp Cloud API */}
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ChannelIcon channel="whatsapp" className="w-10 h-10 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">واتساب الرسمي (Meta WhatsApp Cloud API)</h4>
                          <Badge variant="neutral">جاهز للربط</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          الربط السحابي الرسمي للأعمال المعتمد عبر Meta Developer Portal وقوالب الرسائل المعتمدة.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isAdmin}
                        onClick={() => setActiveConfigChannel('cloud_wa')}
                      >
                        إعداد القناة
                      </Button>
                    </div>
                  </div>

                  {/* Facebook Messenger */}
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ChannelIcon channel="messenger" className="w-10 h-10 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">فيسبوك ماسنجر (Facebook Messenger)</h4>
                          <Badge variant="neutral">جاهز للربط</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          استقبال محادثات صفحة أولاد يحيى على فيسبوك مباشرة في الصندوق الموحد.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isAdmin}
                        onClick={() => setActiveConfigChannel('messenger')}
                      >
                        إعداد القناة
                      </Button>
                    </div>
                  </div>

                  {/* Instagram Direct */}
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ChannelIcon channel="instagram" className="w-10 h-10 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">إنستغرام (Instagram Direct)</h4>
                          <Badge variant="neutral">جاهز للربط</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          استقبال رسائل حساب إنستغرام للأعمال والرد عليها من نفس الشاشة.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!isAdmin}
                        onClick={() => setActiveConfigChannel('instagram')}
                      >
                        إعداد القناة
                      </Button>
                    </div>
                  </div>

                  {/* Website Live Chat Widget */}
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <ChannelIcon channel="website" className="w-10 h-10 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">ودجت شات الموقع المباشر (Website Live Chat)</h4>
                          <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                            كود التضمين جاهز
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          زر دردشة يوضع في متجر أو موقع أولاد يحيى للدردشة المباشرة مع الزوار الفوريين.
                        </p>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Code className="w-3.5 h-3.5" />}
                        onClick={() => setActiveConfigChannel('webchat')}
                      >
                        تخصيص ونسخ الكود
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: Company Profile & Hours */}
          {activeTab === 'company' && (
            <Card
              title="بيانات المنشأة وساعات العمل"
              subtitle="تُستخدم هذه البيانات في الفواتير، عروض الأسعار، والردود التلقائية خارج أوقات العمل"
            >
              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المنشأة التجاري</label>
                    <input
                      type="text"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف الرسمي للدعم</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={companyData.phone}
                      onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني للشركة</label>
                    <input
                      type="email"
                      value={companyData.email}
                      onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">رقم السجل التجاري / الضريبي</label>
                    <input
                      type="text"
                      value={companyData.crNumber}
                      onChange={(e) => setCompanyData({ ...companyData, crNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-600" />
                    <span>مواعيد وساعات العمل الرسمية</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">بداية دوام العمل</label>
                      <input
                        type="time"
                        value={companyData.workStart}
                        onChange={(e) => setCompanyData({ ...companyData, workStart: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">نهاية دوام العمل</label>
                      <input
                        type="time"
                        value={companyData.workEnd}
                        onChange={(e) => setCompanyData({ ...companyData, workEnd: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      رسالة الرد التلقائي خارج أوقات العمل
                    </label>
                    <textarea
                      rows={3}
                      value={companyData.autoReply}
                      onChange={(e) => setCompanyData({ ...companyData, autoReply: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button type="submit" variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />}>
                    حفظ بيانات المنشأة
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 3: Roles & Permissions (RBAC) */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <Card
                title="مستويات الأدوار والصلاحيات (Role-Based Access Control)"
                subtitle="تحديد الصلاحيات الممنوحة لكل رتبة لضمان أمان البيانات وتنظيم العمل"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900">مدير النظام (Admin)</span>
                      <Shield className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      صلاحيات مطلقة: إدارة الموظفين وحذفهم، الربط مع القنوات والـ API، وحذف البيانات.
                    </p>
                  </div>
                  <div className="p-3.5 bg-brand-50/50 border border-brand-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-brand-900">مشرف الفريق (Manager)</span>
                      <UserCheck className="w-4 h-4 text-brand-600" />
                    </div>
                    <p className="text-[11px] text-brand-700 leading-relaxed">
                      إشراف وتوزيع: تعيين المحادثات لأي موظف، مراجعة تقارير المبيعات، ومراقبة الردود.
                    </p>
                  </div>
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-emerald-900">موظف خدمة العملاء</span>
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      تنفيذ وتواصل: استلام المحادثات غير المعينة، الرد على العملاء، وتحديث حالة الصفقات.
                    </p>
                  </div>
                </div>

                {/* Permissions Matrix */}
                <h4 className="text-xs font-bold text-slate-800 mb-2">مصفوفة الصلاحيات المطبقة حالياً في النظام:</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3">الصلاحية / الوظيفة</th>
                        <th className="p-3 text-center">المدير (Admin)</th>
                        <th className="p-3 text-center">المشرف (Manager)</th>
                        <th className="p-3 text-center">الموظف (Employee)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      <tr>
                        <td className="p-3">إضافة موظفين جدد وتعديل بياناتهم وحذفهم</td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                        <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      </tr>
                      <tr>
                        <td className="p-3">تعيين المحادثات وإعادة توجيهها بين أعضاء الفريق</td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center text-[10px] text-slate-500">استلام لنفسه فقط</td>
                      </tr>
                      <tr>
                        <td className="p-3">الرد على محادثات العملاء وإرسال الوسائط والصور</td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      </tr>
                      <tr>
                        <td className="p-3">تعديل بيانات العميل ومرحلة الشراء (Lead Status)</td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      </tr>
                      <tr>
                        <td className="p-3">الربط مع قنوات التواصل ومفاتيح الـ API</td>
                        <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                        <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                        <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                  <span className="text-xs text-slate-500">
                    هل ترغب في تغيير رتبة أحد الموظفين أو إضافة عضو جديد؟
                  </span>
                  <Link to="/team">
                    <Button variant="primary" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                      الانتقال لإدارة فريق العمل
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: Notifications & Alerts */}
          {activeTab === 'notifications' && (
            <Card
              title="التنبيهات والإشعارات الفورية"
              subtitle="ضبط أصوات التنبيه وإشعارات المتصفح لضمان سرعة الاستجابة لرسائل العملاء"
            >
              <form onSubmit={handleSaveNotifications} className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">تشغيل نغمة تنبيه صوتية عند وصول رسالة جديدة</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يتم تشغيل رنين مميز في المتصفح فور إرسال أي عميل رسالة جديدة.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={testNotificationSound}
                        className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 text-slate-700 cursor-pointer"
                        title="تجربة النغمة الآن"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-brand-600" />
                        <span>تجربة الرنين</span>
                      </button>
                      <input
                        type="checkbox"
                        checked={notificationSettings.soundEnabled}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, soundEnabled: e.target.checked })
                        }
                        className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">إشعارات المتصفح المنبثقة (Desktop Notifications)</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إشعار يظهر في زاوية الشاشة حتى وإن كان المتصفح مصغراً.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.browserPush}
                      onChange={(e) =>
                        setNotificationSettings({ ...notificationSettings, browserPush: e.target.checked })
                      }
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">تنبيه عند تعيين محادثة جديدة لي</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إشعار الموظف فور قيام المشرف بتوجيه محادثة عميل إليه.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.assignedAlert}
                      onChange={(e) =>
                        setNotificationSettings({ ...notificationSettings, assignedAlert: e.target.checked })
                      }
                      className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">تنبيه تأخر الرد على العميل</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        إرسال إنذار إذا بقيت رسالة عميل جديدة بدون رد لفترة محددة.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={notificationSettings.delayedMinutes}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, delayedMinutes: e.target.value })
                        }
                        className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700"
                      >
                        <option value="5">بعد 5 دقائق</option>
                        <option value="15">بعد 15 دقيقة</option>
                        <option value="30">بعد 30 دقيقة</option>
                      </select>
                      <input
                        type="checkbox"
                        checked={notificationSettings.delayedAlert}
                        onChange={(e) =>
                          setNotificationSettings({ ...notificationSettings, delayedAlert: e.target.checked })
                        }
                        className="w-4 h-4 text-brand-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button type="submit" variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />}>
                    حفظ خيارات التنبيهات
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 5: Auto-Assignment & SLA Rules */}
          {activeTab === 'auto_assignment' && (
            <div className="space-y-4">
              <Card
                title="التوزيع التلقائي للمحادثات واتفاقية مستوى الخدمة (SLA)"
                subtitle="إدارة وتوجيه المحادثات الجديدة تلقائياً على الموظفين المتاحين بنظام الدور العادل (Round Robin) ومراقبة سرعة الاستجابة"
              >
                <form onSubmit={handleSaveAutoAssignment} className="space-y-5 text-xs">
                  {/* Master Toggle */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">نظام التوزيع التلقائي الذكي</h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        عند تفعيله، يتم إسناد أي رسالة واردة جديدة لموظف متاح فوراً وفق القواعد المحددة أدناه.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAssignmentSettings.enabled}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Distribution Method */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-bold text-slate-800">
                        خوارزمية توزيع المحادثات
                      </label>
                      <select
                        value={autoAssignmentSettings.method}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            method: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-brand-500 font-semibold text-slate-700"
                      >
                        <option value="round_robin">الدور العادل المتناوب (Round Robin) - الموصى به</option>
                        <option value="least_active">الأقل عبئاً (الأقل في عدد المحادثات النشطة)</option>
                      </select>
                      <p className="text-[10px] text-slate-500">
                        يمنح الأولوية للموظف المتاح الذي مضت أطول مدة منذ آخر محادثة أُسندت إليه.
                      </p>
                    </div>

                    {/* First Response SLA */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-slate-800">
                          مهلة الرد الأول (First Response SLA)
                        </label>
                        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                          {autoAssignmentSettings.firstResponseTimeoutMinutes} دقائق
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={autoAssignmentSettings.firstResponseTimeoutMinutes}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            firstResponseTimeoutMinutes: Math.max(1, parseInt(e.target.value) || 2),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-brand-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        إذا لم يرد الموظف خلال هذه المهلة، يتم سحب المحادثة تلقائياً وتحويلها للموظف التالي في الدور.
                      </p>
                    </div>

                    {/* Max Unresponded Chats */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-slate-800">
                          حد المحادثات غير المردود عليها لكل موظف
                        </label>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          {autoAssignmentSettings.maxUnrespondedChatsPerAgent} محادثات
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={autoAssignmentSettings.maxUnrespondedChatsPerAgent}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            maxUnrespondedChatsPerAgent: Math.max(1, parseInt(e.target.value) || 3),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-brand-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        عند بلوغ الموظف هذا الحد، يتحول تلقائياً إلى حالة "مشغول (Busy)" ويتوقف استقبال محادثات جديدة حتى يرد.
                      </p>
                    </div>

                    {/* Heartbeat Timeout */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-slate-800">
                          صلاحية نبض الاتصال الفعلي (Heartbeat)
                        </label>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {autoAssignmentSettings.heartbeatTimeoutSeconds} ثانية
                        </span>
                      </div>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={autoAssignmentSettings.heartbeatTimeoutSeconds}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            heartbeatTimeoutSeconds: Math.max(30, parseInt(e.target.value) || 90),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:border-brand-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        يتم استبعاد أي موظف من التوزيع إذا انقطع نبض اتصاله لأكثر من هذه المدة (يُعتبر Offline).
                      </p>
                    </div>
                  </div>

                  {/* Advanced Behavior Checkboxes */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <h5 className="font-bold text-slate-800">قواعد السلوك والاستمرارية</h5>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAssignmentSettings.stickyAgentEnabled}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            stickyAgentEnabled: e.target.checked,
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-brand-600 rounded"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">
                          الاحتفاظ بالمسؤول المخصص للعميل (Sticky Agent)
                        </span>
                        <p className="text-[11px] text-slate-500">
                          إذا كان العميل قد تواصل سابقاً، يتم توجيه رسالته الجديدة إلى نفس الموظف المسؤول عنه إذا كان متاحاً؛ وإذا كان غير متاح يتم إسنادها لموظف بديل.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAssignmentSettings.allowManagerAutoAssign}
                        onChange={(e) =>
                          setAutoAssignmentSettings({
                            ...autoAssignmentSettings,
                            allowManagerAutoAssign: e.target.checked,
                          })
                        }
                        className="mt-0.5 w-4 h-4 text-brand-600 rounded"
                      />
                      <div>
                        <span className="font-semibold text-slate-800">
                          تضمين حسابات المشرفين والمديرين في التوزيع التلقائي
                        </span>
                        <p className="text-[11px] text-slate-500">
                          افتراضياً، يتم التوزيع على موظفي خدمة العملاء والمبيعات فقط لحماية حسابات الإدارة من تلقي التذاكر المباشرة.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <Button type="submit" variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />}>
                      حفظ إعدادات التوزيع وSLA
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Channel Configuration Details */}
      {activeConfigChannel && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ChannelIcon
                  channel={
                    activeConfigChannel === 'cloud_wa'
                      ? 'whatsapp'
                      : activeConfigChannel === 'messenger'
                      ? 'messenger'
                      : activeConfigChannel === 'instagram'
                      ? 'instagram'
                      : 'website'
                  }
                  className="w-4 h-4"
                />
                <span>
                  {activeConfigChannel === 'cloud_wa'
                    ? 'إعداد WhatsApp Cloud API الرسمي'
                    : activeConfigChannel === 'messenger'
                    ? 'إعداد فيسبوك ماسنجر'
                    : activeConfigChannel === 'instagram'
                    ? 'إعداد إنستغرام للأعمال'
                    : 'تخصيص ودجت شات الموقع المباشر'}
                </span>
              </h3>
              <button
                onClick={() => setActiveConfigChannel(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChannelConfig} className="p-5 space-y-3.5 text-xs">
              {activeConfigChannel === 'cloud_wa' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number ID</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="e.g. 104829104819"
                      value={channelConfigs.cloudWaPhoneId}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, cloudWaPhoneId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">WhatsApp Business Account ID (WABA)</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="e.g. 293810481029"
                      value={channelConfigs.cloudWaWabaId}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, cloudWaWabaId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Permanent Access Token</label>
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="EAAG...."
                      value={channelConfigs.cloudWaToken}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, cloudWaToken: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                </>
              )}

              {activeConfigChannel === 'messenger' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Facebook Page ID</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="معرف الصفحة على فيسبوك"
                      value={channelConfigs.messengerPageId}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, messengerPageId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Page Access Token</label>
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="رمز الوصول الدائم للصفحة"
                      value={channelConfigs.messengerToken}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, messengerToken: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                </>
              )}

              {activeConfigChannel === 'instagram' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Instagram Business Account ID</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="معرف حساب إنستغرام"
                      value={channelConfigs.instagramId}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, instagramId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Graph API Access Token</label>
                    <input
                      type="password"
                      dir="ltr"
                      value={channelConfigs.instagramToken}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, instagramToken: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                    />
                  </div>
                </>
              )}

              {activeConfigChannel === 'webchat' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">عنوان نافذة الشات</label>
                    <input
                      type="text"
                      value={channelConfigs.webChatTitle}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, webChatTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">رسالة الترحيب التلقائية</label>
                    <input
                      type="text"
                      value={channelConfigs.webChatWelcome}
                      onChange={(e) => setChannelConfigs({ ...channelConfigs, webChatWelcome: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">لون الودجت الرئيسي</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={channelConfigs.webChatColor}
                        onChange={(e) => setChannelConfigs({ ...channelConfigs, webChatColor: e.target.value })}
                        className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        value={channelConfigs.webChatColor}
                        onChange={(e) => setChannelConfigs({ ...channelConfigs, webChatColor: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-mono text-left"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 text-slate-100 rounded-xl mt-3">
                    <div className="flex items-center justify-between mb-1.5 text-[11px] text-slate-400">
                      <span>كود التضمين في موقعك (قبل إغلاق body):</span>
                      <button
                        type="button"
                        onClick={copyWidgetCode}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedEmbed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedEmbed ? 'تم النسخ!' : 'نسخ الكود'}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono overflow-x-auto text-emerald-400" dir="ltr">
{`<script src="https://cdn.omnicrm.app/widget.js" data-app="crm_awlad_yahya" async></script>`}
                    </pre>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveConfigChannel(null)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" />}>
                  حفظ الإعدادات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
