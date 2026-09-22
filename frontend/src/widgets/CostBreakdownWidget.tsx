import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CostBreakdownData } from "./types";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#65a30d", "#0891b2"];

export function CostBreakdownWidget({ data }: { data: CostBreakdownData }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
        <Pie
          data={data.slices}
          dataKey="amount"
          nameKey="label"
          cx="50%"
          cy="45%"
          outerRadius={90}
          labelLine={false}
          label={(entry) => `${entry.percent_of_total}%`}
        >
          {data.slices.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
