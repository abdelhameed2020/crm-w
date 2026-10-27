import { orderBy, type Unsubscribe } from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Deal, PipelineStage } from '../../types/pipeline.types';

export const DEFAULT_PIPELINE_STAGES: Omit<PipelineStage, 'dealsCount' | 'dealsValue'>[] = [
  { id: 'stage_lead', title: 'عميل محتمل جديد', order: 1, color: '#3b82f6' },
  { id: 'stage_contacted', title: 'تم التواصل والمتابعة', order: 2, color: '#8b5cf6' },
  { id: 'stage_proposal', title: 'تقديم عرض السعر', order: 3, color: '#f59e0b' },
  { id: 'stage_negotiation', title: 'التفاوض والمراجعة', order: 4, color: '#06b6d4' },
  { id: 'stage_won', title: 'صفقة رابحة (تم البيع)', order: 5, color: '#10b981' },
  { id: 'stage_lost', title: 'صفقة ملغية / خاسرة', order: 6, color: '#ef4444' },
];

export class PipelineService {
  /**
   * Subscribe to pipeline stages in realtime
   */
  static subscribeToStages(callback: (stages: PipelineStage[]) => void): Unsubscribe {
    return FirestoreService.subscribe<PipelineStage>(
      COLLECTIONS.PIPELINE_STAGES,
      [orderBy('order', 'asc')],
      callback
    );
  }

  /**
   * Subscribe to deals in realtime
   */
  static subscribeToDeals(callback: (deals: Deal[]) => void): Unsubscribe {
    return FirestoreService.subscribe<Deal>(
      COLLECTIONS.PIPELINES,
      [orderBy('createdAt', 'desc')],
      callback
    );
  }

  /**
   * Initialize default CRM pipeline stages
   */
  static async initializeDefaultStages(): Promise<void> {
    for (const stage of DEFAULT_PIPELINE_STAGES) {
      await FirestoreService.set<PipelineStage>(COLLECTIONS.PIPELINE_STAGES, stage.id, {
        ...stage,
        dealsCount: 0,
        dealsValue: 0,
      });
    }
  }

  /**
   * Create a new deal
   */
  static async createDeal(deal: Deal): Promise<void> {
    await FirestoreService.set<Deal>(COLLECTIONS.PIPELINES, deal.id, deal);
  }

  /**
   * Update deal fields partially
   */
  static async updateDeal(dealId: string, updates: Partial<Deal>): Promise<void> {
    await FirestoreService.update<Deal>(COLLECTIONS.PIPELINES, dealId, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  /**
   * Move a deal to a new stage
   */
  static async moveDealStage(dealId: string, stageId: string): Promise<void> {
    await FirestoreService.update<Deal>(COLLECTIONS.PIPELINES, dealId, {
      stageId,
      updatedAt: Date.now(),
    });
  }

  /**
   * Delete a deal
   */
  static async deleteDeal(dealId: string): Promise<void> {
    await FirestoreService.delete(COLLECTIONS.PIPELINES, dealId);
  }
}
