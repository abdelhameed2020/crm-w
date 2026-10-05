import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  MessageCircleQuestion,
  Users,
  UserX,
  Clock,
  TrendingUp,
  Shield,
  Layers
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { ReportsService } from '../../services/firebase/reports.service';
import type { DashboardMetrics } from '../../types/report.types';
import { useAuth } from '../../hooks/useAuth';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalConversations: 0,
    newConversations: 0,
    newCustomers: 0,
    unassignedConversations: 0,
    openConversations: 0,
    salesTotal: 0,
    averageResponseTimeMinutes: 4,
    resolutionRatePercentage: 92,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await ReportsService.getDashboardMetrics();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMetrics();
  }, []);

  const cards = [
    {
      title: 'إجمالي المحادثات',
      value: metrics.totalConversations,
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      description: 'عبر جميع القنوات النشطة',
    },
    {
      title: 'المحادثات الجديدة',
      value: metrics.newConversations,
      icon: MessageCircleQuestion,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      description: 'خلال الـ 24 ساعة الماضية',
    },
    {
      title: 'العملاء الجدد',
      value: metrics.newCustomers,
      icon: Users,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      description: 'مسجلون في قاعدة بيانات CRM',
    },
    {
      title: 'المحادثات غير المعينة',
      value: metrics.unassignedConversations,
      icon: UserX,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      description: 'بانتظار تخصيص موظف مسؤول',
    },
    {
      title: 'المحادثات المفتوحة',
      value: metrics.openConversations,
      icon: Clock,
      color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
      description: 'محادثات قيد المتابعة حاليًا',
    },
    {
      title: 'إجمالي المبيعات',
      value: `${metrics.salesTotal.toLocaleString()} ر.س`,
      icon: TrendingUp,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      description: 'الصفقات المكتملة في مسار المبيعات',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm border border-slate-700/50">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-brand-300 text-xs font-semibold mb-3 border border-slate-700">
            <Shield className="w-3.5 h-3.5" />
            <span>نظام إدارة العملاء والمحادثات الموحد | الإصدار 1.0</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold">
            مرحباً بك، {user?.displayName || 'المستخدم'}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            نظرة عامة حية على أداء المحادثات، الـ Leads، والقنوات المتصلة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300">
            الدور الحالي: <strong className="text-brand-300">{user?.role}</strong>
          </span>
        </div>
      </div>

      {/* Required Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">{card.title}</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {isLoading ? (
                      <span className="inline-block w-12 h-6 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-2">{card.description}</p>
                </div>
                <div className={`p-3 rounded-xl border ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Architecture Highlights & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="معمارية القنوات المتصلة (Multi-Channel Foundation)"
          subtitle="طبقة مجردة Channel-Agnostic جاهزة للربط"
        >
          <div className="space-y-3">
            {[
              { name: 'WhatsApp Cloud API', type: 'whatsapp', status: 'جاهز للهندسة والربط' },
              { name: 'Facebook Messenger', type: 'messenger', status: 'جاهز للهندسة والربط' },
              { name: 'Instagram Direct', type: 'instagram', status: 'جاهز للمراحل القادمة' },
              { name: 'Website Live Chat', type: 'website', status: 'جاهز للمراحل القادمة' },
            ].map((ch) => (
              <div
                key={ch.type}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></div>
                  <span className="text-xs font-bold text-slate-800">{ch.name}</span>
                </div>
                <span className="text-[11px] text-slate-500">{ch.status}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="حالة الهيكل المعماري (Core Foundation)"
          subtitle="فصل الطبقات واستقلالية المنطق عن واجهات Meta"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50/50 border border-brand-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                طبقة مزودي القنوات (Channel Provider Abstraction)
              </span>
              <span className="text-emerald-700 font-bold">مكتملة ومستقلة</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50/50 border border-brand-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                هيكل Firestore Collections وقواعد الأمان Rules
              </span>
              <span className="text-emerald-700 font-bold">مهيأة بالكامل</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50/50 border border-brand-100 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                الصلاحيات والأدوار (Admin / Manager / Employee)
              </span>
              <span className="text-emerald-700 font-bold">مفعلة مع حماية Rules</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
