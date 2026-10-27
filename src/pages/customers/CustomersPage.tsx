import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  FileSpreadsheet,
  Download,
  Phone,
  MapPin,
  MessageSquare,
  Edit2,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Card } from '../../components/common/Card';
import { CustomersService } from '../../services/firebase/customers.service';
import { ImportCustomersModal } from '../../components/customers/ImportCustomersModal';
import { AddCustomerModal } from '../../components/customers/AddCustomerModal';
import { exportCustomersToExcel, downloadSampleExcelTemplate } from '../../utils/excelCustomerUtils';
import { SUPPORTED_COUNTRIES } from '../../utils/phoneUtils';
import type { Customer, LeadStatus } from '../../types/customer.types';

const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  new: { label: 'جديد', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  contacted: { label: 'تم التواصل', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  qualified: { label: 'مهتم / مؤهل', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  proposal: { label: 'تم تقديم عرض', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  won: { label: 'صفقة ناجحة', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  lost: { label: 'ملغي / خاسر', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  // Banner notification for recent import
  const [importNotification, setImportNotification] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribe = CustomersService.subscribeToCustomers(
      (data) => {
        setCustomers(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching customers:', err);
        setError('تعذر تحميل سجل العملاء من قاعدة البيانات.');
        setIsLoading(false);
      },
      500
    );
    return () => unsubscribe();
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)));

      const matchesStatus =
        selectedStatusFilter === 'all' || c.leadStatus === selectedStatusFilter;

      const matchesChannel =
        selectedChannelFilter === 'all' ||
        (c.sourceChannel || '').toLowerCase() === selectedChannelFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesChannel;
    });
  }, [customers, search, selectedStatusFilter, selectedChannelFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = customers.length;
    const newCount = customers.filter((c) => c.leadStatus === 'new').length;
    const qualifiedCount = customers.filter((c) => ['qualified', 'won', 'proposal'].includes(c.leadStatus)).length;
    const withPhoneCount = customers.filter((c) => Boolean(c.phone)).length;
    return { total, newCount, qualifiedCount, withPhoneCount };
  }, [customers]);

  // Delete customer handler
  const handleDeleteCustomer = async (cust: Customer) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${cust.name}" نهائياً من سجل الـ CRM؟`)) {
      return;
    }
    try {
      await CustomersService.deleteCustomer(cust.id);
    } catch (err: any) {
      alert(`فشل حذف العميل: ${err.message}`);
    }
  };

  // Helper to get country flag from phone
  const getCountryFlag = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/[^\d]/g, '');
    for (const c of SUPPORTED_COUNTRIES) {
      if (clean.startsWith(c.dialCode)) {
        return c.flag;
      }
    }
    return '🌐';
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span>إدارة العملاء والـ Leads</span>
            <span className="text-xs bg-brand-50 text-brand-700 font-bold px-2.5 py-0.5 rounded-full border border-brand-200/60">
              {customers.length} عميل
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            سجل شامل ببيانات العملاء، وتنسيق أرقام الهواتف بأكواد الدول، وسجل المحادثات والأنشطة والوسوم.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Excel */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Download className="w-3.5 h-3.5 text-slate-600" />}
            onClick={() => exportCustomersToExcel(filteredCustomers)}
            disabled={customers.length === 0}
            className="text-xs font-bold"
          >
            تصدير Excel
          </Button>

          {/* Import from Excel / CSV */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-100" />}
            onClick={() => setIsImportModalOpen(true)}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            استيراد من Excel
          </Button>

          {/* Add Customer Single */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setCustomerToEdit(null);
              setIsAddModalOpen(true);
            }}
            className="text-xs font-bold"
          >
            إضافة عميل جديد
          </Button>
        </div>
      </div>

      {/* Success Banner if just imported */}
      {importNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{importNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setImportNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">إجمالي العملاء والـ Leads</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[11px] text-slate-400">سجل مسجل</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">عملاء جدد (New)</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-600">{stats.newCount}</span>
            <span className="text-[11px] text-slate-400">بحاجة لتواصل</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">مؤهلين وصفقات ناجحة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.qualifiedCount}</span>
            <span className="text-[11px] text-slate-400">فرصة مؤكدة</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">أرقام هواتف دولية معتمدة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{stats.withPhoneCount}</span>
            <span className="text-[11px] text-slate-400">جاهز للواتساب</span>
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم، رقم الهاتف الدولي، البريد، المدينة أو الوسوم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-3 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Filters & Template Download */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 text-[11px]">الحالة:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">الكل ({customers.length})</option>
                <option value="new">جديد</option>
                <option value="contacted">تم التواصل</option>
                <option value="qualified">مهتم / مؤهل</option>
                <option value="proposal">عرض سعر</option>
                <option value="won">صفقة ناجحة</option>
                <option value="lost">ملغي</option>
              </select>
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <span className="text-slate-500 text-[11px]">القناة:</span>
              <select
                value={selectedChannelFilter}
                onChange={(e) => setSelectedChannelFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع القنوات</option>
                <option value="whatsapp">واتساب (WhatsApp)</option>
                <option value="facebook">فيسبوك</option>
                <option value="instagram">انستجرام</option>
                <option value="website">الموقع</option>
                <option value="excel_import">استيراد إكسل</option>
              </select>
            </div>

            {/* Template Download Shortcut */}
            <button
              type="button"
              onClick={downloadSampleExcelTemplate}
              className="text-[11px] font-bold text-brand-600 hover:text-brand-800 underline flex items-center gap-1 py-1.5 px-2"
            >
              <Download className="w-3 h-3" />
              <span>تحميل شيت إكسل تجريبي</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Customers List or Empty State */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          جاري تحميل بيانات العملاء...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 text-slate-400" />}
          title={search ? 'لم يتم العثور على عملاء مطابقين للبحث' : 'لا يوجد عملاء مسجلين بعد'}
          description={
            search
              ? 'جرّب البحث بكلمات أخرى أو مسح حقول الفلترة الحالية.'
              : 'يمكنك استيراد شيت إكسل يحتوي على أرقام وبيانات عملائك دفعة واحدة، أو إضافة عميل يدوياً للبدء.'
          }
          actionLabel={search ? 'مسح البحث' : 'استيراد شيت إكسل الآن'}
          onAction={() => (search ? setSearch('') : setIsImportModalOpen(true))}
        />
      ) : (
        <Card className="p-0 overflow-hidden bg-white border border-slate-200 shadow-sm rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3.5 pr-5">العميل</th>
                  <th className="p-3.5">الهاتف الدولي</th>
                  <th className="p-3.5">البريد الإلكتروني</th>
                  <th className="p-3.5">حالة الـ Lead</th>
                  <th className="p-3.5">القناة الأولى</th>
                  <th className="p-3.5">الوسوم</th>
                  <th className="p-3.5">تاريخ الإضافة</th>
                  <th className="p-3.5 pl-5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => {
                  const statusConf =
                    LEAD_STATUS_CONFIG[c.leadStatus] || LEAD_STATUS_CONFIG.new;
                  const flag = getCountryFlag(c.phone);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name & City */}
                      <td className="p-3.5 pr-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-xs">
                              {c.name}
                            </span>
                            {c.city && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {c.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone with Country Code Badge */}
                      <td className="p-3.5">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <span className="text-sm">{flag}</span>
                            <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                              {c.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="p-3.5 text-slate-600">
                        {c.email ? (
                          <span className="truncate block max-w-[150px]">{c.email}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Lead Status */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Channel */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                          {c.sourceChannel === 'whatsapp' ? (
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                              واتساب
                            </span>
                          ) : (
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                              {c.sourceChannel || 'أخرى'}
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(c.tags || []).slice(0, 2).map((tag, ti) => (
                            <span
                              key={ti}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600"
                            >
                              #{tag}
                            </span>
                          ))}
                          {(c.tags || []).length > 2 && (
                            <span className="text-[10px] text-slate-400">
                              +{(c.tags || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                            })
                          : '-'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pl-5 text-center">
                        <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100">
                          {/* Direct WhatsApp Chat Action */}
                          {c.phone && (
                            <a
                              href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="مراسلة عبر واتساب"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          )}

                          {/* Edit Customer */}
                          <button
                            type="button"
                            title="تعديل بيانات العميل"
                            onClick={() => {
                              setCustomerToEdit(c);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Customer */}
                          <button
                            type="button"
                            title="حذف العميل"
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              عرض <strong className="text-slate-800">{filteredCustomers.length}</strong> من أصل{' '}
              <strong className="text-slate-800">{customers.length}</strong> عميل
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => exportCustomersToExcel(filteredCustomers)}
                className="font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير النتائج المعروضة إلى شيت Excel</span>
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Import Modal */}
      <ImportCustomersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(count) => {
          setImportNotification(`تم استيراد ومعالجة ${count} عميل بنجاح في نظام CRM!`);
        }}
      />

      {/* Add / Edit Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setCustomerToEdit(null);
        }}
        customerToEdit={customerToEdit}
        onSuccess={() => {
          // Handled by realtime snapshot
        }}
      />
    </div>
  );
};
