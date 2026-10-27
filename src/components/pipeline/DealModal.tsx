import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, User, Briefcase, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { PipelineService } from '../../services/firebase/pipeline.service';
import type { Deal, PipelineStage } from '../../types/pipeline.types';
import type { Customer } from '../../types/customer.types';
import type { Employee } from '../../types/employee.types';

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealToEdit?: Deal | null;
  defaultStageId?: string;
  stages: PipelineStage[];
  customers: Customer[];
  employees: Employee[];
  onSuccess?: () => void;
}

export const DealModal: React.FC<DealModalProps> = ({
  isOpen,
  onClose,
  dealToEdit,
  defaultStageId,
  stages,
  customers,
  employees,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('ج.م');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [stageId, setStageId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dealToEdit) {
      setTitle(dealToEdit.title || '');
      setValue(dealToEdit.value ? String(dealToEdit.value) : '');
      setCurrency(dealToEdit.currency || 'ج.م');
      setSelectedCustomerId(dealToEdit.customerId || '');
      setCustomCustomerName(dealToEdit.customerName || '');
      setStageId(dealToEdit.stageId || (stages[0]?.id || ''));
      setAssignedEmployeeId(dealToEdit.assignedEmployeeId || '');
      setExpectedCloseDate(
        dealToEdit.expectedCloseDate
          ? new Date(dealToEdit.expectedCloseDate).toISOString().split('T')[0]
          : ''
      );
      setNotes((dealToEdit as any).notes || '');
    } else {
      setTitle('');
      setValue('');
      setCurrency('ج.م');
      setSelectedCustomerId(customers[0]?.id || '');
      setCustomCustomerName('');
      setStageId(defaultStageId || stages[0]?.id || '');
      setAssignedEmployeeId(employees[0]?.id || '');
      setExpectedCloseDate('');
      setNotes('');
    }
    setError(null);
  }, [dealToEdit, defaultStageId, isOpen, stages, customers, employees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('يرجى إدخال عنوان الصفقة.');
      return;
    }
    if (!value || isNaN(Number(value)) || Number(value) < 0) {
      setError('يرجى إدخال قيمة صحيحة للصفقة.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const selectedCust = customers.find((c) => c.id === selectedCustomerId);
      const customerName = selectedCust ? selectedCust.name : (customCustomerName.trim() || 'عميل عام');
      const selectedEmp = employees.find((e) => e.id === assignedEmployeeId);

      const now = Date.now();
      const closeTimestamp = expectedCloseDate ? new Date(expectedCloseDate).getTime() : undefined;

      if (dealToEdit) {
        await PipelineService.updateDeal(dealToEdit.id, {
          title: title.trim(),
          value: Number(value),
          currency,
          customerId: selectedCustomerId || dealToEdit.customerId,
          customerName,
          stageId: stageId || dealToEdit.stageId,
          assignedEmployeeId: assignedEmployeeId || undefined,
          assignedEmployeeName: selectedEmp ? selectedEmp.name : undefined,
          expectedCloseDate: closeTimestamp,
          updatedAt: now,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
      } else {
        const dealId = `deal_${now}_${Math.random().toString(36).substring(2, 6)}`;
        const newDeal: Deal = {
          id: dealId,
          title: title.trim(),
          value: Number(value),
          currency,
          customerId: selectedCustomerId || `cust_${now}`,
          customerName,
          stageId: stageId || (stages[0]?.id || 'stage_lead'),
          assignedEmployeeId: assignedEmployeeId || undefined,
          assignedEmployeeName: selectedEmp ? selectedEmp.name : undefined,
          expectedCloseDate: closeTimestamp,
          createdAt: now,
          updatedAt: now,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        await PipelineService.createDeal(newDeal);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving deal:', err);
      setError(err?.message || 'حدث خطأ أثناء حفظ الصفقة.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {dealToEdit ? 'تعديل بيانات الصفقة' : 'إنشاء صفقة جديدة في المسار'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد القيمة المالية والمرحلة والعميل والموظف المسؤول
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
            <label className="block text-xs font-bold text-slate-800 mb-1">
              عنوان أو اسم الصفقة *
            </label>
            <input
              type="text"
              required
              placeholder="مثال: توريد 4 كراسي حلاقة هيدروليك فندقية"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Value & Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                قيمة الصفقة المالية *
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="مثال: 45000"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">العملة</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="ج.م">ج.م (EGP)</option>
                <option value="SAR">ر.س (SAR)</option>
                <option value="AED">د.إ (AED)</option>
                <option value="USD">$ (USD)</option>
              </select>
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">العميل المستهدف *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  if (e.target.value !== 'custom') {
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c) setCustomCustomerName(c.name);
                  }
                }}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">اختر عميلاً من القائمة...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
                <option value="custom">-- عميل جديد أو غير مسجل --</option>
              </select>
            </div>
            {selectedCustomerId === 'custom' && (
              <input
                type="text"
                placeholder="اكتب اسم العميل الجديد..."
                value={customCustomerName}
                onChange={(e) => setCustomCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none mt-2"
              />
            )}
          </div>

          {/* Stage & Assigned Employee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">مرحلة المسار *</label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {stages.map((stg) => (
                  <option key={stg.id} value={stg.id}>
                    {stg.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">الموظف المسؤول</label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">غير مسند (عام)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department || 'مبيعات'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              تاريخ الإغلاق أو البيع المتوقع
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظات الصفقة</label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <textarea
                rows={2}
                placeholder="تفاصيل المنتجات المطلوبة، شروط الدفع، أو متطلبات العميل..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

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
              {isSaving ? 'جارٍ الحفظ...' : dealToEdit ? 'تحديث الصفقة' : 'حفظ الصفقة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
