import React, { useState, useEffect, useMemo } from 'react';
import {
  GitBranch,
  Plus,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Calendar,
  User,
  Search,
  Filter,
  ArrowLeft,
  ArrowRight,
  Edit2,
  Trash2,
  Sparkles,
  Loader2,
  Layers,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { PipelineService } from '../../services/firebase/pipeline.service';
import { CustomersService } from '../../services/firebase/customers.service';
import { EmployeesService } from '../../services/firebase/employees.service';
import { DealModal } from '../../components/pipeline/DealModal';
import type { PipelineStage, Deal } from '../../types/pipeline.types';
import type { Customer } from '../../types/customer.types';
import type { Employee } from '../../types/employee.types';

export const PipelinePage: React.FC = () => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');

  // Modals
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [dealToEdit, setDealToEdit] = useState<Deal | null>(null);
  const [activeStageForNewDeal, setActiveStageForNewDeal] = useState<string | undefined>(undefined);

  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsubStages = PipelineService.subscribeToStages((data) => {
      setStages(data);
      setIsLoading(false);
    });

    const unsubDeals = PipelineService.subscribeToDeals((data) => {
      setDeals(data);
    });

    const unsubCustomers = CustomersService.subscribeToCustomers((data) => {
      setCustomers(data);
    });

    const unsubEmployees = EmployeesService.subscribeToEmployees((data) => {
      setEmployees(data);
    });

    return () => {
      unsubStages();
      unsubDeals();
      unsubCustomers();
      unsubEmployees();
    };
  }, []);

  // Initialize Default Stages handler
  const handleInitializeStages = async () => {
    setIsInitializing(true);
    try {
      await PipelineService.initializeDefaultStages();
      setNotification('تمت تهيئة مراحل مسار المبيعات الافتراضية بنجاح!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      alert(`فشل تهيئة المراحل: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  // Move deal to a different stage
  const handleMoveDeal = async (dealId: string, targetStageId: string) => {
    try {
      await PipelineService.moveDealStage(dealId, targetStageId);
    } catch (err: any) {
      alert(`فشل نقل الصفقة: ${err?.message || 'خطأ'}`);
    }
  };

  // Delete deal
  const handleDeleteDeal = async (deal: Deal) => {
    if (!window.confirm(`هل أنت متأكد من حذف الصفقة "${deal.title}"؟`)) return;
    try {
      await PipelineService.deleteDeal(deal.id);
    } catch (err: any) {
      alert(`فشل حذف الصفقة: ${err?.message || 'خطأ'}`);
    }
  };

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        (d.customerName && d.customerName.toLowerCase().includes(q)) ||
        (d.assignedEmployeeName && d.assignedEmployeeName.toLowerCase().includes(q));

      const matchesEmployee =
        selectedEmployeeFilter === 'all' || d.assignedEmployeeId === selectedEmployeeFilter;

      return matchesSearch && matchesEmployee;
    });
  }, [deals, searchQuery, selectedEmployeeFilter]);

  // Sales & Pipeline KPIs
  const metrics = useMemo(() => {
    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    // Won deals (stageId starts with stage_won or title includes رابحة/تم البيع/won)
    const wonStageIds = stages
      .filter((s) => s.id === 'stage_won' || s.title.includes('رابحة') || s.title.includes('تم البيع'))
      .map((s) => s.id);

    const wonDeals = deals.filter((d) => wonStageIds.includes(d.stageId));
    const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    const winRate = totalDeals > 0 ? Math.round((wonDeals.length / totalDeals) * 100) : 0;
    const avgDealValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

    return {
      totalDeals,
      totalValue,
      wonDealsCount: wonDeals.length,
      wonValue,
      winRate,
      avgDealValue,
    };
  }, [deals, stages]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span>مسار المبيعات والصفقات (Pipeline)</span>
            <span className="text-xs bg-brand-50 text-brand-700 font-bold px-2.5 py-0.5 rounded-full border border-brand-200/60">
              {deals.length} صفقة
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            متابعة مراحل الصفقات من العميل المتوقع إلى إتمام البيع، وتقييم أداء وقيمة المبيعات.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {stages.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={isInitializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              onClick={handleInitializeStages}
              disabled={isInitializing}
              className="text-xs font-bold"
            >
              {isInitializing ? 'جارٍ التهيئة...' : 'تهيئة مراحل المسار'}
            </Button>
          ) : (
            <button
              type="button"
              onClick={handleInitializeStages}
              title="إعادة ضبط المراحل القياسية"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
            >
              إعادة ضبط المراحل
            </button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setDealToEdit(null);
              setActiveStageForNewDeal(undefined);
              setIsDealModalOpen(true);
            }}
            className="text-xs font-bold shadow-sm"
          >
            إنشاء صفقة جديدة
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{notification}</span>
        </div>
      )}

      {/* Sales & Pipeline KPIs Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pipeline Value */}
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">إجمالي قيمة المسار</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.totalValue.toLocaleString('ar-EG')}
            </span>
            <span className="text-xs text-slate-500 font-bold">ج.م</span>
          </div>
        </Card>

        {/* Won Revenue */}
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">المبيعات المحققة (تم البيع)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
              {metrics.wonValue.toLocaleString('ar-EG')}
            </span>
            <span className="text-xs text-emerald-700 font-bold">ج.م</span>
          </div>
        </Card>

        {/* Active Deals & Win Rate */}
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">معدل نجاح الصفقات</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-purple-600 font-mono">
              {metrics.winRate}%
            </span>
            <span className="text-[11px] text-slate-400">
              ({metrics.wonDealsCount} من {metrics.totalDeals})
            </span>
          </div>
        </Card>

        {/* Average Deal Value */}
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">متوسط قيمة الصفقة</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {metrics.avgDealValue.toLocaleString('ar-EG')}
            </span>
            <span className="text-xs text-slate-500 font-bold">ج.م</span>
          </div>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث في الصفقات أو اسم العميل أو الموظف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Employee Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 text-[11px]">المسؤول:</span>
              <select
                value={selectedEmployeeFilter}
                onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">جميع مسؤولي المبيعات</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Board or Empty State */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          جاري تحميل مسار المبيعات والصفقات...
        </div>
      ) : stages.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-10 h-10 text-brand-600" />}
          title="مسار المبيعات غير مهيأ بعد"
          description="يمكنك بنقرة واحدة تهيئة مراحل مسار المبيعات القياسية (عميل محتمل، متابعة، تقديم عرض، تفاوض، وإغلاق الصفقة) للبدء في إدارة وتتبع صفقاتك فوراً."
          actionLabel={isInitializing ? 'جارٍ التهيئة...' : 'تهيئة مراحل المسار الافتراضية الآن'}
          onAction={handleInitializeStages}
        />
      ) : (
        /* Kanban Board Columns */
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start">
          {stages.map((stage, stageIndex) => {
            const stageDeals = filteredDeals.filter((d) => d.stageId === stage.id);
            const stageTotalValue = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

            return (
              <div
                key={stage.id}
                className="w-72 sm:w-80 shrink-0 bg-slate-50/80 rounded-2xl p-3 border border-slate-200/90 flex flex-col max-h-[75vh]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color || '#3b82f6' }}
                    />
                    <h3 className="font-bold text-xs text-slate-900 truncate">{stage.title}</h3>
                    <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-600">
                      {stageDeals.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    title="إضافة صفقة في هذه المرحلة"
                    onClick={() => {
                      setDealToEdit(null);
                      setActiveStageForNewDeal(stage.id);
                      setIsDealModalOpen(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Column Value Summary */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2.5 px-1 font-mono">
                  <span>إجمالي المرحلة:</span>
                  <span className="font-bold text-slate-800">
                    {stageTotalValue.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>

                {/* Deal Cards Container */}
                <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                  {stageDeals.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200/80 rounded-xl text-slate-400 text-xs">
                      <p>لا توجد صفقات في هذه المرحلة</p>
                      <button
                        type="button"
                        onClick={() => {
                          setDealToEdit(null);
                          setActiveStageForNewDeal(stage.id);
                          setIsDealModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-brand-600 hover:underline mt-1.5 inline-block"
                      >
                        + إضافة صفقة
                      </button>
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow group space-y-2.5 text-right"
                      >
                        {/* Title & Amount */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                            {deal.title}
                          </h4>
                          <span className="font-black text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
                            {(Number(deal.value) || 0).toLocaleString('ar-EG')} {deal.currency || 'ج.م'}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium truncate">{deal.customerName || 'عميل عام'}</span>
                        </div>

                        {/* Assigned Employee & Date */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span className="truncate">
                            {deal.assignedEmployeeName ? `المسؤول: ${deal.assignedEmployeeName}` : 'غير مسند'}
                          </span>
                          {deal.expectedCloseDate && (
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(deal.expectedCloseDate).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>

                        {/* Stage Mover & Card Actions */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          {/* Stage Shift Quick Selector */}
                          <select
                            value={deal.stageId}
                            onChange={(e) => handleMoveDeal(deal.id, e.target.value)}
                            className="text-[10px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 focus:outline-none cursor-pointer max-w-[140px] truncate"
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* Previous stage arrow */}
                            {stageIndex > 0 && (
                              <button
                                type="button"
                                title="نقل للمرحلة السابقة"
                                onClick={() => handleMoveDeal(deal.id, stages[stageIndex - 1].id)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Next stage arrow */}
                            {stageIndex < stages.length - 1 && (
                              <button
                                type="button"
                                title="نقل للمرحلة التالية"
                                onClick={() => handleMoveDeal(deal.id, stages[stageIndex + 1].id)}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              type="button"
                              title="تعديل الصفقة"
                              onClick={() => {
                                setDealToEdit(deal);
                                setIsDealModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              title="حذف الصفقة"
                              onClick={() => handleDeleteDeal(deal)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deal Modal for Create / Edit */}
      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => {
          setIsDealModalOpen(false);
          setDealToEdit(null);
          setActiveStageForNewDeal(undefined);
        }}
        dealToEdit={dealToEdit}
        defaultStageId={activeStageForNewDeal}
        stages={stages}
        customers={customers}
        employees={employees}
        onSuccess={() => {
          setNotification(dealToEdit ? 'تم تحديث بيانات الصفقة بنجاح!' : 'تم إنشاء الصفقة بنجاح!');
          setTimeout(() => setNotification(null), 3500);
        }}
      />
    </div>
  );
};
