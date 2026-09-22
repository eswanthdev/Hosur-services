"""
Common widget spec schema shared conceptually with the frontend (frontend/src/widgets).

A "widget spec" is the contract between the agent and the dashboard canvas:
the agent picks a widget type, fills its data payload, and the frontend
renders it with a matching React component (see WIDGET_TYPES below).
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class WidgetType(str, Enum):
    COST_TREND = "cost_trend"
    COST_BREAKDOWN = "cost_breakdown"
    SAVINGS_PLAN_COVERAGE = "savings_plan_coverage"
    UTILIZATION_TABLE = "utilization_table"
    ANOMALY_LIST = "anomaly_list"
    BUDGET_VS_ACTUAL = "budget_vs_actual"
    TOP_N_RESOURCES = "top_n_resources"
    RIGHTSIZING_OPPORTUNITIES = "rightsizing_opportunities"


class WidgetSpec(BaseModel):
    """The envelope returned to the frontend for rendering one dashboard widget."""

    widget_type: WidgetType
    title: str
    subtitle: str | None = None
    # Free-form per-widget payload; each widget type defines its own expected
    # shape (see the `*Data` models below) but we keep it as dict at the
    # envelope level so new widget types don't require touching this file.
    data: dict[str, Any]
    generated_at: str
    source: Literal["mcp:billing-cost-management"] = "mcp:billing-cost-management"


class CostTrendPoint(BaseModel):
    period: str  # e.g. "2026-08"
    amount: float
    unit: str = "USD"


class CostTrendData(BaseModel):
    granularity: Literal["DAILY", "MONTHLY"] = "MONTHLY"
    points: list[CostTrendPoint]
    group_by: str | None = None  # e.g. "SERVICE", "LINKED_ACCOUNT"


class CostBreakdownSlice(BaseModel):
    label: str
    amount: float
    percent_of_total: float


class CostBreakdownData(BaseModel):
    dimension: str  # SERVICE | LINKED_ACCOUNT | REGION | TAG
    total: float
    slices: list[CostBreakdownSlice]


class SavingsPlanCoverageData(BaseModel):
    coverage_percent: float
    on_demand_cost: float
    covered_cost: float
    target_coverage_percent: float | None = None
