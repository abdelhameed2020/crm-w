import { orderBy, type Unsubscribe } from 'firebase/firestore';
import { FirestoreService } from './firestore.service';
import { COLLECTIONS } from './collections';
import type { Deal, PipelineStage } from '../../types/pipeline.types';

export class PipelineService {
  static subscribeToStages(callback: (stages: PipelineStage[]) => void): Unsubscribe {
    return FirestoreService.subscribe<PipelineStage>(
      COLLECTIONS.PIPELINE_STAGES,
      [orderBy('order', 'asc')],
      callback
    );
  }

  static subscribeToDeals(callback: (deals: Deal[]) => void): Unsubscribe {
    return FirestoreService.subscribe<Deal>(
      COLLECTIONS.PIPELINES,
      [orderBy('createdAt', 'desc')],
      callback
    );
  }

  static async moveDealStage(dealId: string, stageId: string): Promise<void> {
    await FirestoreService.update<Deal>(COLLECTIONS.PIPELINES, dealId, {
      stageId,
      updatedAt: Date.now(),
    });
  }
}
