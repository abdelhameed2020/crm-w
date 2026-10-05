import React from 'react';
import { MessageSquare, Shield, Globe, Bell } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ChannelIcon } from '../../components/common/ChannelIcon';
import { useAuth } from '../../hooks/useAuth';

export const SettingsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">إعدادات النظام والقنوات</h1>
        <p className="text-xs text-slate-500 mt-1">
          تهيئة قنوات التواصل الموحدة، إعدادات المنشأة، والصلاحيات الأمنية.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Tabs */}
        <div className="space-y-1">
          {[
            { label: 'قنوات التواصل الموحدة', icon: MessageSquare, active: true },
            { label: 'بيانات المنشأة وساعات العمل', icon: Globe, active: false },
            { label: 'الأدوار والصلاحيات (RBAC)', icon: Shield, active: false },
            { label: 'التنبيهات والإشعارات', icon: Bell, active: false },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  item.active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Channels Configuration Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="القنوات المتاحة للربط"
            subtitle="الطبقة المعمارية مجهزة للربط مع مزودي الخدمة دون تعديل في الكود الأساسي"
          >
            <div className="divide-y divide-slate-100 space-y-3">
              {[
                {
                  type: 'whatsapp' as const,
                  name: 'واتساب (WhatsApp Cloud API)',
                  desc: 'ربط رقم أعمال رسمي مع Meta Cloud API',
                  status: 'جاهز للهندسة والربط',
                },
                {
                  type: 'messenger' as const,
                  name: 'فيسبوك ماسنجر (Facebook Messenger)',
                  desc: 'استقبال رسائل صفحات فيسبوك مباشرة في الصندوق',
                  status: 'جاهز للهندسة والربط',
                },
                {
                  type: 'instagram' as const,
                  name: 'إنستغرام (Instagram Direct)',
                  desc: 'محادثات حساب الأعمال في إنستغرام',
                  status: 'متاح في المراحل اللاحقة',
                },
                {
                  type: 'website' as const,
                  name: 'ودجت شات الموقع (Live Chat)',
                  desc: 'ودجت ويب سريع للدردشة المباشرة مع زوار الموقع',
                  status: 'متاح في المراحل اللاحقة',
                },
              ].map((ch) => (
                <div key={ch.type} className="pt-3 first:pt-0 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <ChannelIcon channel={ch.type} className="w-5 h-5 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{ch.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ch.desc}</p>
                    </div>
                  </div>
                  <div>
                    <Button variant="outline" size="sm" disabled={!isAdmin}>
                      إعداد القناة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
