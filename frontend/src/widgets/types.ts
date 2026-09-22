// Mirrors backend/widgets/schema.py — keep in sync when adding widget types.

export type WidgetType =
  | "cost_trend"
  | "cost_breakdown"
  | "savings_plan_coverage"
  | "utilization_table"
  | "anomaly_list"
  | "budget_vs_actual"
  | "top_n_resources"
  | "rightsizing_opportunities";

export interface WidgetSpec {
  widget_type: WidgetType;
  title: string;
  subtitle?: string | null;
  data: Record<string, unknown>;
  generated_at: string;
  source: string;
}

export interface CostTrendPoint {
  period: string;
  amount: number;
  unit: string;
}

export interface CostTrendData {
  granularity: "DAILY" | "MONTHLY";
  points: CostTrendPoint[];
  group_by?: string | null;
}

export interface CostBreakdownSlice {
  label: string;
  amount: number;
  percent_of_total: number;
}

export interface CostBreakdownData {
  dimension: string;
  total: number;
  slices: CostBreakdownSlice[];
}

export interface SavingsPlanCoverageData {
  coverage_percent: number;
  on_demand_cost: number;
  covered_cost: number;
  target_coverage_percent?: number | null;
}
