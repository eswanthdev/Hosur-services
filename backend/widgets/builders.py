"""
Data-shaping functions: take a raw MCP tool response and produce a WidgetSpec.

Each function here corresponds to one WidgetType and knows how to map the
Billing & Cost Management MCP server's tool output into the widget's data
schema. Kept separate from the agent so they're independently testable.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from widgets.schema import (
    CostBreakdownData,
    CostBreakdownSlice,
    CostTrendData,
    CostTrendPoint,
    SavingsPlanCoverageData,
    WidgetSpec,
    WidgetType,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_cost_trend_widget(
    mcp_result: dict[str, Any], group_by: str | None = None, highlight_last_period: bool = False
) -> WidgetSpec:
    """
    Expects mcp_result shaped like the Cost Explorer `get_cost_and_usage`
    tool response: a list of {"period": "...", "amount": ..., "unit": "..."}.
    """
    raw_points = mcp_result.get("results_by_time", [])
    points = [
        CostTrendPoint(
            period=p["time_period"]["start"],
            amount=float(p["total"]["unblended_cost"]["amount"]),
            unit=p["total"]["unblended_cost"].get("unit", "USD"),
        )
        for p in raw_points
    ]
    data = CostTrendData(points=points, group_by=group_by)

    subtitle = f"Grouped by {group_by}" if group_by else None
    title = "Cost Trend"
    if highlight_last_period and points:
        last = points[-1]
        title = f"Last Month's Cost: ${last.amount:,.2f}"
        subtitle = f"For {last.period}"

    return WidgetSpec(
        widget_type=WidgetType.COST_TREND,
        title=title,
        subtitle=subtitle,
        data=data.model_dump(),
        generated_at=_now_iso(),
    )


def build_cost_breakdown_widget(mcp_result: dict[str, Any], dimension: str) -> WidgetSpec:
    groups = mcp_result.get("groups", [])
    total = sum(float(g["metrics"]["unblended_cost"]["amount"]) for g in groups) or 1.0
    slices = [
        CostBreakdownSlice(
            label=g["keys"][0],
            amount=float(g["metrics"]["unblended_cost"]["amount"]),
            percent_of_total=round(100 * float(g["metrics"]["unblended_cost"]["amount"]) / total, 2),
        )
        for g in groups
    ]
    slices.sort(key=lambda s: s.amount, reverse=True)
    data = CostBreakdownData(dimension=dimension, total=total, slices=slices)
    return WidgetSpec(
        widget_type=WidgetType.COST_BREAKDOWN,
        title=f"Cost Breakdown by {dimension.title()}",
        data=data.model_dump(),
        generated_at=_now_iso(),
    )


def build_savings_plan_coverage_widget(mcp_result: dict[str, Any]) -> WidgetSpec:
    """
    Expects mcp_result shaped like Cost Explorer `get_savings_plans_coverage`.
    """
    coverage = mcp_result.get("savings_plans_coverages", [{}])[0]
    cov = coverage.get("coverage", {})
    on_demand = float(cov.get("on_demand_cost", 0))
    covered = float(cov.get("spend_covered_by_savings_plans", 0))
    total = on_demand + covered or 1.0
    data = SavingsPlanCoverageData(
        coverage_percent=round(100 * covered / total, 2),
        on_demand_cost=on_demand,
        covered_cost=covered,
    )
    return WidgetSpec(
        widget_type=WidgetType.SAVINGS_PLAN_COVERAGE,
        title="Savings Plan Coverage",
        data=data.model_dump(),
        generated_at=_now_iso(),
    )


# Registry so the agent can dispatch by WidgetType without a big if/elif chain.
BUILDERS = {
    WidgetType.COST_TREND: build_cost_trend_widget,
    WidgetType.COST_BREAKDOWN: build_cost_breakdown_widget,
    WidgetType.SAVINGS_PLAN_COVERAGE: build_savings_plan_coverage_widget,
}
