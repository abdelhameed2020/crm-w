export interface DashboardMetrics {
  totalConversations: number;
  newConversations: number;
  newCustomers: number;
  unassignedConversations: number;
  openConversations: number;
  salesTotal: number;
  averageResponseTimeMinutes?: number;
  resolutionRatePercentage?: number;
}

export interface MetricCardData {
  title: string;
  value: string | number;
  changePercentage?: number;
  isPositive?: boolean;
  subtitle?: string;
  iconName: string;
}
