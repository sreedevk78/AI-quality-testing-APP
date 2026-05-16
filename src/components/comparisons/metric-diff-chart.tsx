"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export function MetricDiffChart({ title, baseline, candidate, unit = "%" }: { title: string, baseline: number, candidate: number, unit?: string }) {
  const data = [
    { name: "Baseline", value: baseline, color: "rgba(148,163,184,0.3)" },
    { name: "Candidate", value: candidate, color: candidate >= baseline ? "#6f8cff" : "#ef4444" }
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
         <p className="text-xs font-medium text-muted-foreground uppercase">{title}</p>
         <p className="text-xs font-bold">{unit === "%" ? Math.round(candidate * 100) : candidate}{unit}</p>
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: -30, right: 10 }}>
            <XAxis type="number" hide domain={[0, unit === "%" ? 1 : 'auto']} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "12px" }} 
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
