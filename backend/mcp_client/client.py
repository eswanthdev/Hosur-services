"""
Thin async client around the AWS Labs Billing & Cost Management MCP server.

Connects over stdio using the official `mcp` Python SDK. Falls back to a
mock mode (MCP_MOCK=1) so the rest of the stack can be developed/tested
without live AWS credentials or the server installed.
"""
from __future__ import annotations

import json
import os
from contextlib import AsyncExitStack
from typing import Any

MOCK_MODE = os.getenv("MCP_MOCK", "1") == "1"


class MCPClientError(RuntimeError):
    pass


class BillingCostMgmtMCPClient:
    """
    Usage:
        async with BillingCostMgmtMCPClient() as client:
            result = await client.call_tool("get_cost_and_usage", {...})
    """

    def __init__(self, command: str | None = None, args: list[str] | None = None):
        # Defaults match how awslabs/mcp's billing-cost-management-mcp-server
        # is typically launched (uvx from the published package).
        self.command = command or os.getenv("MCP_SERVER_COMMAND", "uvx")
        self.args = args or os.getenv(
            "MCP_SERVER_ARGS", "awslabs.billing-cost-management-mcp-server"
        ).split()
        self._stack: AsyncExitStack | None = None
        self._session = None

    async def __aenter__(self) -> "BillingCostMgmtMCPClient":
        if MOCK_MODE:
            return self

        # Imported lazily so `mcp` isn't a hard dependency in mock mode.
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        self._stack = AsyncExitStack()
        params = StdioServerParameters(command=self.command, args=self.args)
        read, write = await self._stack.enter_async_context(stdio_client(params))
        self._session = await self._stack.enter_async_context(ClientSession(read, write))
        await self._session.initialize()
        return self

    async def __aexit__(self, *exc_info) -> None:
        if self._stack is not None:
            await self._stack.aclose()

    async def list_tools(self) -> list[str]:
        if MOCK_MODE:
            return list(_MOCK_TOOLS.keys())
        resp = await self._session.list_tools()
        return [t.name for t in resp.tools]

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if MOCK_MODE:
            return _mock_call(name, arguments)

        if self._session is None:
            raise MCPClientError("Client not initialized; use `async with`.")
        resp = await self._session.call_tool(name, arguments)
        if resp.isError:
            raise MCPClientError(str(resp.content))
        # MCP tool results are content blocks; the billing server returns JSON text.
        text = "".join(block.text for block in resp.content if hasattr(block, "text"))
        return json.loads(text)


# ---------------------------------------------------------------------------
# Mock fixtures used when MCP_MOCK=1 (default), so backend/frontend can be
# built and demoed before the real MCP server + AWS org access is wired up.
# ---------------------------------------------------------------------------

_MOCK_TOOLS = {
    "get_cost_and_usage": {},
    "get_cost_and_usage_grouped": {},
    "get_savings_plans_coverage": {},
}


def _mock_call(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "get_cost_and_usage":
        return {
            "results_by_time": [
                {"time_period": {"start": "2026-03"}, "total": {"unblended_cost": {"amount": "18234.12", "unit": "USD"}}},
                {"time_period": {"start": "2026-04"}, "total": {"unblended_cost": {"amount": "19876.54", "unit": "USD"}}},
                {"time_period": {"start": "2026-05"}, "total": {"unblended_cost": {"amount": "21012.30", "unit": "USD"}}},
                {"time_period": {"start": "2026-06"}, "total": {"unblended_cost": {"amount": "20450.75", "unit": "USD"}}},
                {"time_period": {"start": "2026-07"}, "total": {"unblended_cost": {"amount": "22890.00", "unit": "USD"}}},
                {"time_period": {"start": "2026-08"}, "total": {"unblended_cost": {"amount": "24310.45", "unit": "USD"}}},
            ]
        }
    if name == "get_cost_and_usage_grouped":
        return {
            "groups": [
                {"keys": ["Amazon EC2"], "metrics": {"unblended_cost": {"amount": "9820.00"}}},
                {"keys": ["Amazon RDS"], "metrics": {"unblended_cost": {"amount": "4210.50"}}},
                {"keys": ["Amazon S3"], "metrics": {"unblended_cost": {"amount": "2130.10"}}},
                {"keys": ["AWS Lambda"], "metrics": {"unblended_cost": {"amount": "980.25"}}},
                {"keys": ["Other"], "metrics": {"unblended_cost": {"amount": "1169.60"}}},
            ]
        }
    if name == "get_savings_plans_coverage":
        return {
            "savings_plans_coverages": [
                {
                    "coverage": {
                        "on_demand_cost": "6200.00",
                        "spend_covered_by_savings_plans": "13800.00",
                    }
                }
            ]
        }
    raise MCPClientError(f"No mock fixture registered for tool '{name}'")
