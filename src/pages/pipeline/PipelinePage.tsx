import React, { useState, useEffect } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { PipelineService } from '../../services/firebase/pipeline.service';
import type { PipelineStage, Deal } from '../../types/pipeline.types';

export const PipelinePage: React.FC = () => {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    const unsubStages = PipelineService.subscribeToStages((data) => setStages(data));
    const unsubDeals = PipelineService.subscribeToDeals((data) => setDeals(data));
    return () => {
      unsubStages();
      unsubDeals();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">مسار المبيعات والصفقات (Pipeline)</h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة مراحل الصفقات من العميل المتوقع إلى إتمام البيع.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            إنشاء صفقة جديدة
          </Button>
        </div>
      </div>

      {/* Pipeline Board or Empty State */}
      {deals.length === 0 && stages.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-7 h-7" />}
          title="مسار المبيعات فارغ حالياً"
          description="يمكنك تتبع الصفقات وربطها بالمحادثات والعملاء تلقائيًا. مراحل المسار الافتراضية تشمل: عميل جديد، تقديم العرض، التفاوض، وإغلاق الصفقة."
          actionLabel="تهيئة مراحل المسار الافتراضية"
          onAction={() => alert('هيكل Pipeline جاهز في Firestore')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="bg-slate-100/70 rounded-xl p-3 border border-slate-200 min-w-[260px]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-slate-800">{stage.title}</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">
                  {stage.dealsCount}
                </span>
              </div>
              <div className="space-y-2">
                {/* Stage Deals */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
