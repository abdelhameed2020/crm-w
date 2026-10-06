export interface PipelineStage {
  id: string;
  title: string;
  order: number;
  color: string;
  dealsCount: number;
  dealsValue: number;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  customerId: string;
  customerName: string;
  stageId: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  expectedCloseDate?: number;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface SalesPipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: number;
}
