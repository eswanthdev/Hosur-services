import pytest

from agent.supervisor import run_agent
from widgets.schema import WidgetType


@pytest.mark.asyncio
async def test_cost_trend_question_returns_cost_trend_widget():
    widget = await run_agent("How has my spend changed over time?")
    assert widget["widget_type"] == WidgetType.COST_TREND.value
    assert len(widget["data"]["points"]) == 6
    assert widget["data"]["points"][0]["period"] == "2026-03"


@pytest.mark.asyncio
async def test_breakdown_question_returns_cost_breakdown_widget():
    widget = await run_agent("What's driving my cost this month?")
    assert widget["widget_type"] == WidgetType.COST_BREAKDOWN.value
    slices = widget["data"]["slices"]
    assert slices[0]["label"] == "Amazon EC2"  # sorted by amount desc
    assert slices[0]["amount"] > slices[-1]["amount"]


@pytest.mark.asyncio
async def test_savings_plan_coverage_question_returns_coverage_widget():
    widget = await run_agent("What is my savings plan coverage?")
    assert widget["widget_type"] == WidgetType.SAVINGS_PLAN_COVERAGE.value
    assert 0 <= widget["data"]["coverage_percent"] <= 100
