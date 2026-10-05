import React from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">التقارير وتحليلات الأداء</h1>
          <p className="text-xs text-slate-500 mt-1">
            إحصائيات استجابة الفريق، حجم المحادثات عبر القنوات ومعدلات التحويل.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Calendar className="w-4 h-4" />}>
            آخر 30 يوم
          </Button>
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
            تصدير البيانات
          </Button>
        </div>
      </div>

      <EmptyState
        icon={<BarChart3 className="w-7 h-7" />}
        title="لا توجد بيانات كافية لإصدار التقارير"
        description="ستظهر مؤشرات الأداء (KPIs) مثل متوسط زمن الرد الأول، ومعدل إغلاق التذاكر، وإنتاجية الموظفين فور تدفق المحادثات."
      />
    </div>
  );
};
