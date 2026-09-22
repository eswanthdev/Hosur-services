"""
LangGraph supervisor agent: classifies user intent -> selects a widget type
-> calls the appropriate MCP tool -> shapes the result into a WidgetSpec.

Kept deliberately simple (rule-based intent classification) for the Phase 1
skeleton; swap `classify_intent` for an LLM call once wired to Bedrock.
"""
from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from mcp_client.client import BillingCostMgmtMCPClient
from widgets.builders import (
    build_cost_breakdown_widget,
    build_cost_trend_widget,
    build_savings_plan_coverage_widget,
)
from widgets.schema import WidgetType


class AgentState(TypedDict, total=False):
    question: str
    widget_type: WidgetType
    mcp_tool: str
    mcp_args: dict[str, Any]
    mcp_result: dict[str, Any]
    widget_spec: dict[str, Any]


# --- Node: intent classification -------------------------------------------------

_KEYWORDS: list[tuple[tuple[str, ...], WidgetType, str]] = [
    (("savings plan", "sp coverage", "coverage"), WidgetType.SAVINGS_PLAN_COVERAGE, "get_savings_plans_coverage"),
    (("breakdown", "driving my cost", "by service", "top spenders"), WidgetType.COST_BREAKDOWN, "get_cost_and_usage_grouped"),
    (
        (
            "trend", "how has my spend", "over time", "changed",
            "last month", "this month", "current spend", "current cost",
            "how much did i spend", "total cost", "my cost",
        ),
        WidgetType.COST_TREND,
        "get_cost_and_usage",
    ),
]


def classify_intent(state: AgentState) -> AgentState:
    q = state["question"].lower()
    for keywords, widget_type, tool in _KEYWORDS:
        if any(k in q for k in keywords):
            return {**state, "widget_type": widget_type, "mcp_tool": tool}
    # Default fallback widget
    return {**state, "widget_type": WidgetType.COST_TREND, "mcp_tool": "get_cost_and_usage"}


# --- Node: build MCP tool arguments -----------------------------------------------

def prepare_tool_args(state: AgentState) -> AgentState:
    widget_type = state["widget_type"]
    if widget_type == WidgetType.COST_BREAKDOWN:
        args = {"granularity": "MONTHLY", "group_by": "SERVICE"}
    elif widget_type == WidgetType.SAVINGS_PLAN_COVERAGE:
        args = {"granularity": "MONTHLY"}
    else:
        args = {"granularity": "MONTHLY"}
    return {**state, "mcp_args": args}


# --- Node: call MCP tool ----------------------------------------------------------

async def call_mcp_tool(state: AgentState) -> AgentState:
    async with BillingCostMgmtMCPClient() as client:
        result = await client.call_tool(state["mcp_tool"], state["mcp_args"])
    return {**state, "mcp_result": result}


# --- Node: shape result into widget spec ------------------------------------------

_LAST_PERIOD_KEYWORDS = ("last month", "this month", "current spend", "current cost", "how much did i spend")


def build_widget(state: AgentState) -> AgentState:
    widget_type = state["widget_type"]
    if widget_type == WidgetType.COST_BREAKDOWN:
        spec = build_cost_breakdown_widget(state["mcp_result"], dimension="SERVICE")
    elif widget_type == WidgetType.SAVINGS_PLAN_COVERAGE:
        spec = build_savings_plan_coverage_widget(state["mcp_result"])
    else:
        highlight_last_period = any(k in state["question"].lower() for k in _LAST_PERIOD_KEYWORDS)
        spec = build_cost_trend_widget(state["mcp_result"], highlight_last_period=highlight_last_period)
    return {**state, "widget_spec": spec.model_dump(mode="json")}


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("classify_intent", classify_intent)
    graph.add_node("prepare_tool_args", prepare_tool_args)
    graph.add_node("call_mcp_tool", call_mcp_tool)
    graph.add_node("build_widget", build_widget)

    graph.set_entry_point("classify_intent")
    graph.add_edge("classify_intent", "prepare_tool_args")
    graph.add_edge("prepare_tool_args", "call_mcp_tool")
    graph.add_edge("call_mcp_tool", "build_widget")
    graph.add_edge("build_widget", END)
    return graph.compile()


async def run_agent(question: str) -> dict[str, Any]:
    graph = build_graph()
    final_state = await graph.ainvoke({"question": question})
    return final_state["widget_spec"]
