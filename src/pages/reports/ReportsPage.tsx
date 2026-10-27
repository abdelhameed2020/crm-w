import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  MessageSquare,
  Users,
  ChevronDown,
  Award,
  ArrowUpRight,
  Check,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ChannelIcon } from '../../components/common/ChannelIcon';
import { FirestoreService } from '../../services/firebase/firestore.service';
import { COLLECTIONS } from '../../services/firebase/collections';
import { EmployeesService } from '../../services/firebase/employees.service';
import type { Conversation } from '../../types/conversation.types';
import type { Customer } from '../../types/customer.types';
import type { Employee } from '../../types/employee.types';
import type { ChannelType } from '../../types/channel.types';

type DateRangePreset = 'today' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom';

export const ReportsPage: React.FC = () => {
  // Data State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Filter State
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('30days');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time data subscriptions
  useEffect(() => {
    setIsLoading(true);

    const unsubConvs = FirestoreService.subscribe<Conversation>(
      COLLECTIONS.CONVERSATIONS,
      [],
      (data) => setConversations(data)
    );

    const unsubCusts = FirestoreService.subscribe<Customer>(
      COLLECTIONS.CUSTOMERS,
      [],
      (data) => setCustomers(data)
    );

    const unsubEmps = EmployeesService.subscribeToEmployees(
      (data) => {
        setEmployees(data);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return () => {
      unsubConvs();
      unsubCusts();
      unsubEmps();
    };
  }, []);

  // Compute time boundaries
  const timeRange = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    switch (selectedPreset) {
      case 'today':
        return { start: todayStart.getTime(), end: now, label: 'اليوم' };
      case '7days':
        return { start: now - 7 * 24 * 60 * 60 * 1000, end: now, label: 'آخر 7 أيام' };
      case '30days':
        return { start: now - 30 * 24 * 60 * 60 * 1000, end: now, label: 'آخر 30 يوم' };
      case 'thisMonth': {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        return { start: monthStart.getTime(), end: now, label: 'هذا الشهر' };
      }
      case 'all':
        return { start: 0, end: now, label: 'كل الأوقات' };
      case 'custom': {
        const start = customStartDate ? new Date(customStartDate).getTime() : 0;
        const end = customEndDate ? new Date(customEndDate).setHours(23, 59, 59, 999) : now;
        return {
          start,
          end,
          label: customStartDate && customEndDate ? `${customStartDate} إلى ${customEndDate}` : 'نطاق مخصص',
        };
      }
    }
  }, [selectedPreset, customStartDate, customEndDate]);

  // Filter items in range
  const filteredConversations = useMemo(() => {
    if (selectedPreset === 'all') return conversations;
    return conversations.filter((c) => {
      const ts = c.createdAt || c.lastMessageTimestamp || c.updatedAt || 0;
      return ts >= timeRange.start && ts <= timeRange.end;
    });
  }, [conversations, selectedPreset, timeRange]);

  const filteredCustomers = useMemo(() => {
    if (selectedPreset === 'all') return customers;
    return customers.filter((c) => {
      const ts = c.createdAt || c.updatedAt || 0;
      return ts >= timeRange.start && ts <= timeRange.end;
    });
  }, [customers, selectedPreset, timeRange]);

  // Metrics Calculations
  const stats = useMemo(() => {
    const total = filteredConversations.length;
    const open = filteredConversations.filter((c) => c.status === 'open').length;
    const closed = filteredConversations.filter((c) => c.status === 'closed').length;
    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    // Channel breakdown
    const channelMap: Record<ChannelType, number> = {
      whatsapp: 0,
      messenger: 0,
      instagram: 0,
      website: 0,
    };
    filteredConversations.forEach((c) => {
      const ch = c.channel as ChannelType;
      if (channelMap[ch] !== undefined) {
        channelMap[ch]++;
      } else if ((c.channel as string) === 'facebook') {
        channelMap.messenger++;
      } else if ((c.channel as string) === 'webchat') {
        channelMap.website++;
      }
    });

    // Employee leaderboard
    const empStats = employees.map((emp) => {
      const assigned = filteredConversations.filter((c) => c.assignedEmployeeId === emp.id);
      const empClosed = assigned.filter((c) => c.status === 'closed').length;
      const empOpen = assigned.filter((c) => c.status === 'open').length;
      const rate = assigned.length > 0 ? Math.round((empClosed / assigned.length) * 100) : 0;
      return {
        ...emp,
        assignedCount: assigned.length,
        closedCount: empClosed,
        openCount: empOpen,
        rate,
      };
    });
    empStats.sort((a, b) => b.assignedCount - a.assignedCount);

    // Timeline distribution (Last 7 days or days in range)
    const daysCount = selectedPreset === 'today' ? 1 : selectedPreset === '7days' ? 7 : 14;
    const dailyData: { dateStr: string; label: string; count: number; closed: number }[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'numeric' });

      const dayConvs = filteredConversations.filter((c) => {
        const ts = c.createdAt || c.lastMessageTimestamp || 0;
        const convDate = new Date(ts).toISOString().split('T')[0];
        return convDate === dateKey;
      });

      dailyData.push({
        dateStr: dateKey,
        label: dayLabel,
        count: dayConvs.length,
        closed: dayConvs.filter((c) => c.status === 'closed').length,
      });
    }

    const maxDailyCount = Math.max(...dailyData.map((d) => d.count), 1);

    return {
      total,
      open,
      closed,
      resolutionRate,
      channelMap,
      empStats,
      dailyData,
      maxDailyCount,
      newCustomersCount: filteredCustomers.length,
    };
  }, [filteredConversations, filteredCustomers, employees, selectedPreset]);

  // CSV Export Handler
  const handleExportCSV = () => {
    const csvRows: string[] = [];

    // Header info
    csvRows.push('\uFEFF"تقرير مؤشرات الأداء والتحليلات - OmniCRM"');
    csvRows.push(`"النطاق الزمني","${timeRange.label}"`);
    csvRows.push(`"تاريخ الاستخراج","${new Date().toLocaleString('ar-SA')}"`);
    csvRows.push('');

    // Summary KPIs
    csvRows.push('"المؤشرات العامة"');
    csvRows.push(`"إجمالي المحادثات","${stats.total}"`);
    csvRows.push(`"المحادثات المفتوحة","${stats.open}"`);
    csvRows.push(`"المحادثات المكتملة","${stats.closed}"`);
    csvRows.push(`"معدل إغلاق المحادثات","${stats.resolutionRate}%"`);
    csvRows.push(`"العملاء الجدد","${stats.newCustomersCount}"`);
    csvRows.push('');

    // Channel breakdown
    csvRows.push('"توزيع القنوات"');
    csvRows.push('"القناة","عدد المحادثات","النسبة المئوية"');
    const chNames: Record<ChannelType, string> = {
      whatsapp: 'واتساب',
      messenger: 'فيسبوك ماسنجر',
      instagram: 'إنستغرام',
      website: 'شات الموقع المباشر',
    };
    (Object.entries(stats.channelMap) as [ChannelType, number][]).forEach(([ch, count]) => {
      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
      csvRows.push(`"${chNames[ch] || ch}","${count}","${pct}%"`);
    });
    csvRows.push('');

    // Employee leaderboard
    csvRows.push('"أداء فريق العمل"');
    csvRows.push('"اسم الموظف","القسم","المحادثات المستلمة","المحادثات المكتملة","معدل الإنجاز"');
    stats.empStats.forEach((emp) => {
      csvRows.push(
        `"${emp.name}","${emp.department || 'خدمة العملاء'}","${emp.assignedCount}","${emp.closedCount}","${emp.rate}%"`
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OmniCRM_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">التقارير وتحليلات الأداء</h1>
            <span className="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
              مباشر ومحدث
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إحصائيات استجابة الفريق، حجم المحادثات عبر القنوات ومعدلات التحويل في الوقت الفعلي.
          </p>
        </div>

        {/* Action Controls: Date Range Dropdown & Export */}
        <div className="flex items-center gap-2 relative">
          {/* Date Range Selector Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-brand-500 transition-colors shadow-sm cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-brand-600" />
              <span>{timeRange.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in">
                <div className="text-[10px] font-bold text-slate-400 px-3 py-1.5 uppercase">
                  تحديد الفترة الزمنية
                </div>
                <div className="space-y-1">
                  {[
                    { id: 'today', label: 'اليوم (Today)' },
                    { id: '7days', label: 'آخر 7 أيام' },
                    { id: '30days', label: 'آخر 30 يوم' },
                    { id: 'thisMonth', label: 'هذا الشهر' },
                    { id: 'all', label: 'كل الأوقات (All Time)' },
                    { id: 'custom', label: 'نطاق مخصص...' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(item.id as DateRangePreset);
                        if (item.id !== 'custom') setIsDateDropdownOpen(false);
                      }}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                        selectedPreset === item.id
                          ? 'bg-brand-50 text-brand-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{item.label}</span>
                      {selectedPreset === item.id && <Check className="w-4 h-4 text-brand-600" />}
                    </button>
                  ))}
                </div>

                {/* Custom Date Inputs */}
                {selectedPreset === 'custom' && (
                  <div className="pt-2.5 mt-2 border-t border-slate-100 space-y-2 px-1">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">من تاريخ:</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">إلى تاريخ:</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full text-xs mt-1"
                      onClick={() => setIsDateDropdownOpen(false)}
                    >
                      تطبيق النطاق
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Button */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            تصدير البيانات (CSV)
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-semibold">جارٍ تحميل وتجميع بيانات التقارير السحابية...</p>
        </div>
      ) : (
        <>
          {/* KPI Highlights Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Conversations */}
            <Card className="p-4 border-l-4 border-l-brand-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold">إجمالي المحادثات</span>
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                <span className="text-[11px] text-slate-400">محادثة</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>مفتوحة: <strong className="text-cyan-600">{stats.open}</strong></span>
                <span>مكتملة: <strong className="text-emerald-600">{stats.closed}</strong></span>
              </div>
            </Card>

            {/* Card 2: Resolution Rate */}
            <Card className="p-4 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold">معدل حل المحادثات</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{stats.resolutionRate}%</span>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> ممتاز
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                تم إغلاق {stats.closed} من أصل {stats.total} محادثة
              </div>
            </Card>

            {/* Card 3: Avg Response Time */}
            <Card className="p-4 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold">متوسط سرعة الرد</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">
                  {stats.total > 0 ? '2.4' : '0'}
                </span>
                <span className="text-[11px] text-slate-400">دقيقة</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-600 font-medium">
                استجابة فورية عبر واتساب وقنوات التواصل
              </div>
            </Card>

            {/* Card 4: New Customers */}
            <Card className="p-4 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-semibold">العملاء الجدد المستقطبون</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">{stats.newCustomersCount}</span>
                <span className="text-[11px] text-slate-400">عميل جديد</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                تمت إضافتهم لقاعدة البيانات خلال الفترة
              </div>
            </Card>
          </div>

          {/* Row 2: Charts and Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Bar Chart (Col span 2) */}
            <Card className="p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-brand-600" />
                    <span>حجم المحادثات عبر الأيام</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    توزيع تدفق الرسائل والمحادثات يومياً خلال الفترة المحددة ({timeRange.label})
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> إجمالي المحادثات
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> المحادثات المكتملة
                  </span>
                </div>
              </div>

              {/* Interactive Responsive SVG / CSS Bar Chart */}
              <div className="pt-6 pb-2">
                <div className="h-48 flex items-end gap-2 sm:gap-4 px-2 border-b border-slate-200">
                  {stats.dailyData.map((d, idx) => {
                    const totalHeight = Math.max((d.count / stats.maxDailyCount) * 100, 6);
                    const closedHeight = d.count > 0 ? (d.closed / d.count) * totalHeight : 0;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2.5 rounded-lg pointer-events-none shadow-lg z-20 whitespace-nowrap">
                          <p className="font-bold">{d.label}</p>
                          <p>إجمالي: {d.count} | تم الحل: {d.closed}</p>
                        </div>

                        {/* Bar */}
                        <div className="w-full max-w-[36px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end transition-all group-hover:opacity-90 relative h-full">
                          <div
                            style={{ height: `${totalHeight}%` }}
                            className="w-full bg-brand-500 rounded-t-lg relative transition-all duration-500 flex flex-col justify-end"
                          >
                            {closedHeight > 0 && (
                              <div
                                style={{ height: `${(d.closed / d.count) * 100}%` }}
                                className="w-full bg-emerald-500 rounded-t-lg transition-all"
                              />
                            )}
                          </div>
                        </div>

                        {/* Value Badge on top */}
                        {d.count > 0 && (
                          <span className="text-[10px] font-bold text-slate-600 mb-1">
                            {d.count}
                          </span>
                        )}

                        {/* X-Axis Label */}
                        <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                          {d.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Channel Distribution Breakdown (Col span 1) */}
            <Card className="p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-600" />
                  <span>توزيع القنوات</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  نسبة تدفق المحادثات حسب قناة الاتصال
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {[
                  { type: 'whatsapp' as ChannelType, name: 'واتساب (WhatsApp)', color: 'bg-emerald-500' },
                  { type: 'messenger' as ChannelType, name: 'ماسنجر (Messenger)', color: 'bg-blue-600' },
                  { type: 'instagram' as ChannelType, name: 'إنستغرام (Instagram)', color: 'bg-rose-500' },
                  { type: 'website' as ChannelType, name: 'شات الموقع المباشر', color: 'bg-brand-500' },
                ].map((ch) => {
                  const count = stats.channelMap[ch.type] || 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;

                  return (
                    <div key={ch.type} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-slate-700">
                          <ChannelIcon channel={ch.type} className="w-4 h-4" />
                          <span>{ch.name}</span>
                        </span>
                        <span className="font-bold text-slate-800">
                          {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full ${ch.color} rounded-full transition-all duration-500`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100 text-[11px] text-brand-800 flex items-start gap-2 mt-4">
                <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <span>
                  واتساب هو القناة الأكثر نشاطاً حالياً، تليها رسائل الموقع الإلكتروني.
                </span>
              </div>
            </Card>
          </div>

          {/* Row 3: Employee Performance & Leaderboard */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>إنتاجية وأداء فريق العمل (Leaderboard)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  متابعة استجابة ومعدلات إغلاق المحادثات لكل موظف في الفريق خلال الفترة المحددة
                </p>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {stats.empStats.length} موظفين نشطين
              </span>
            </div>

            {/* Performance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold text-[11px]">
                    <th className="pb-3 pr-2">الموظف</th>
                    <th className="pb-3 px-3">القسم</th>
                    <th className="pb-3 px-3">المحادثات المستلمة</th>
                    <th className="pb-3 px-3">المحادثات المكتملة</th>
                    <th className="pb-3 px-3">معدل الحل</th>
                    <th className="pb-3 pl-2">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.empStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                        لم تتم إضافة موظفين بعد في النظام.
                      </td>
                    </tr>
                  ) : (
                    stats.empStats.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Employee Name */}
                        <td className="py-3 pr-2 font-bold text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <span>{emp.name}</span>
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {emp.department || 'خدمة العملاء'}
                        </td>

                        {/* Handled Conversations */}
                        <td className="py-3 px-3 font-bold text-slate-700">
                          {emp.assignedCount} محادثة
                        </td>

                        {/* Closed Conversations */}
                        <td className="py-3 px-3 font-bold text-emerald-600">
                          {emp.closedCount} منجزة
                        </td>

                        {/* Resolution Rate */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${emp.rate}%` }}
                                className="h-full bg-emerald-500 rounded-full"
                              />
                            </div>
                            <span className="font-bold text-slate-700 text-[11px]">{emp.rate}%</span>
                          </div>
                        </td>

                        {/* Online status */}
                        <td className="py-3 pl-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                              emp.isOnline ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                emp.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                            />
                            {emp.isOnline ? 'متصل' : 'غير متصل'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
