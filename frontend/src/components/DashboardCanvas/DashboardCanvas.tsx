import type { WidgetSpec } from "../../widgets/types";
import { CostTrendWidget } from "../../widgets/CostTrendWidget";
import { CostBreakdownWidget } from "../../widgets/CostBreakdownWidget";
import { SavingsPlanCoverageWidget } from "../../widgets/SavingsPlanCoverageWidget";

// Dispatch table: widget_type -> renderer. Add new widget components here
// as backend/widgets/builders.py grows (utilization_table, anomaly_list, etc.).
function renderWidgetBody(widget: WidgetSpec) {
  switch (widget.widget_type) {
    case "cost_trend":
      return <CostTrendWidget data={widget.data as any} />;
    case "cost_breakdown":
      return <CostBreakdownWidget data={widget.data as any} />;
    case "savings_plan_coverage":
      return <SavingsPlanCoverageWidget data={widget.data as any} />;
    default:
      return <pre>{JSON.stringify(widget.data, null, 2)}</pre>;
  }
}

export function DashboardCanvas({ widgets }: { widgets: WidgetSpec[] }) {
  if (widgets.length === 0) {
    return (
      <div style={{ color: "#888", padding: "2rem", textAlign: "center" }}>
        Ask a FinOps question in the chat to generate a dashboard here.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 900 }}>
      {widgets.map((widget, idx) => (
        <div
          key={idx}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "1rem",
            background: "#fff",
          }}
        >
          <h3 style={{ margin: 0 }}>{widget.title}</h3>
          {widget.subtitle && <div style={{ color: "#888", fontSize: 13 }}>{widget.subtitle}</div>}
          {renderWidgetBody(widget)}
        </div>
      ))}
    </div>
  );
}
