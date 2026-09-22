import type { SavingsPlanCoverageData } from "./types";

export function SavingsPlanCoverageWidget({ data }: { data: SavingsPlanCoverageData }) {
  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ fontSize: "3rem", fontWeight: 700, color: "#2563eb" }}>
        {data.coverage_percent}%
      </div>
      <div style={{ color: "#555" }}>
        Covered: ${data.covered_cost.toLocaleString()} &nbsp;|&nbsp; On-Demand: $
        {data.on_demand_cost.toLocaleString()}
      </div>
      <div
        style={{
          marginTop: "0.75rem",
          height: 10,
          borderRadius: 6,
          background: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(data.coverage_percent, 100)}%`,
            height: "100%",
            background: "#2563eb",
          }}
        />
      </div>
    </div>
  );
}
