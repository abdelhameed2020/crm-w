import React, { useState, useEffect } from 'react';
import { X, UserPlus, Phone, Mail, MapPin, Tag, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { CustomersService } from '../../services/firebase/customers.service';
import { SUPPORTED_COUNTRIES, normalizePhoneNumber } from '../../utils/phoneUtils';
import type { Customer, LeadStatus } from '../../types/customer.types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
  onSuccess: () => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  customerToEdit,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+20');
  const [email, setEmail] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('new');
  const [sourceChannel, setSourceChannel] = useState('whatsapp');
  const [city, setCity] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [initialNote, setInitialNote] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name || '');
      setPhoneRaw(customerToEdit.phone || '');
      setEmail(customerToEdit.email || '');
      setLeadStatus(customerToEdit.leadStatus || 'new');
      setSourceChannel(customerToEdit.sourceChannel || 'whatsapp');
      setCity(customerToEdit.city || '');
      setTagsInput((customerToEdit.tags || []).join('، '));
      setInitialNote('');
    } else {
      setName('');
      setPhoneRaw('');
      setSelectedCountryCode('+20');
      setEmail('');
      setLeadStatus('new');
      setSourceChannel('whatsapp');
      setCity('');
      setTagsInput('');
      setInitialNote('');
    }
    setError(null);
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  // Live normalized phone calculation
  const phoneNormalized = normalizePhoneNumber(phoneRaw, selectedCountryCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم العميل.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const now = Date.now();
      const tags = tagsInput
        .split(/[,،;|]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const customerId = customerToEdit?.id
        ? customerToEdit.id
        : phoneNormalized.cleanDigits
        ? `cust_${phoneNormalized.cleanDigits}`
        : `cust_${now}`;

      const customerData: Customer = {
        id: customerId,
        name: name.trim(),
        phone: phoneNormalized.formatted || undefined,
        email: email.trim().toLowerCase() || undefined,
        leadStatus,
        sourceChannel,
        city: city.trim() || undefined,
        tags,
        notesCount: customerToEdit?.notesCount || (initialNote.trim() ? 1 : 0),
        dealsCount: customerToEdit?.dealsCount || 0,
        dealsTotalValue: customerToEdit?.dealsTotalValue || 0,
        createdAt: customerToEdit?.createdAt || now,
        updatedAt: now,
      };

      await CustomersService.saveCustomer(customerData);

      if (initialNote.trim() && !customerToEdit) {
        await CustomersService.addNote({
          id: `note_${now}`,
          customerId,
          authorId: 'system',
          authorName: 'مسؤول النظام',
          content: initialNote.trim(),
          createdAt: now,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات العميل.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {customerToEdit ? 'تعديل بيانات العميل' : 'إضافة عميل / Lead جديد'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تنسيق الهاتف بكود الدولة تلقائياً وإضافته لقاعدة البيانات
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">اسم العميل *</label>
            <input
              type="text"
              required
              placeholder="مثال: أحمد محمود"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Phone with Country Code */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              رقم الهاتف وكود الدولة *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="مثال: 01012345678"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Live Normalized Preview */}
            {phoneNormalized.formatted && (
              <div className="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center justify-between text-[11px] text-emerald-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>الصيغة الدولية المعتمدة:</span>
                </span>
                <span className="font-mono font-bold text-xs" dir="ltr">
                  {phoneNormalized.formatted}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">حالة الـ Lead</label>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="new">جديد (New)</option>
                <option value="contacted">تم التواصل (Contacted)</option>
                <option value="qualified">مهتم / مؤهل (Qualified)</option>
                <option value="proposal">تم تقديم عرض (Proposal)</option>
                <option value="won">صفقة ناجحة (Won)</option>
                <option value="lost">خاسر / ملغي (Lost)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">القناة / المصدر</label>
              <select
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="whatsapp">واتساب (WhatsApp)</option>
                <option value="phone">مكالمة هاتفية</option>
                <option value="facebook">فيسبوك ماسنجر</option>
                <option value="instagram">انستجرام</option>
                <option value="website">الموقع الإلكتروني</option>
                <option value="campaign">حملة إعلانية</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">المدينة / المحافظة</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="القاهرة، الجيزة..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">الوسوم (مفصولة بفاصلة)</label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="عميل_VIP، استفسار_شحن، أكتوبر"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {!customerToEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظة أولية عن العميل</label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <textarea
                  rows={2}
                  placeholder="اكتب أي تفاصيل إضافية عن العميل أو متطلباته..."
                  value={initialNote}
                  onChange={(e) => setInitialNote(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSaving}
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            >
              {isSaving ? 'جارٍ الحفظ...' : customerToEdit ? 'حفظ التعديلات' : 'إضافة العميل'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
