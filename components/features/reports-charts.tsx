"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { reportsData } from "@/lib/data";

export function RevenueChart() {
  return (
    <Card className="h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Resumen de Ingresos</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={reportsData.monthlyRevenue}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis
              dataKey="month"
              stroke="#71717A"
              tick={{ fill: "#71717A", fontSize: 12 }}
              axisLine={{ stroke: "#27272A" }}
            />
            <YAxis
              stroke="#71717A"
              tick={{ fill: "#71717A", fontSize: 12 }}
              axisLine={{ stroke: "#27272A" }}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181B",
                border: "1px solid #27272A",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#FAFAFA" }}
              itemStyle={{ color: "#A78BFA" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#7C3AED"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TeamPerformanceChart() {
  return (
    <Card className="h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Rendimiento del Equipo</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={reportsData.teamPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" horizontal={false} />
            <XAxis
              type="number"
              stroke="#71717A"
              tick={{ fill: "#71717A", fontSize: 12 }}
              axisLine={{ stroke: "#27272A" }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#71717A"
              tick={{ fill: "#71717A", fontSize: 12 }}
              axisLine={{ stroke: "#27272A" }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181B",
                border: "1px solid #27272A",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#FAFAFA" }}
              formatter={(value: number) => [`${value}%`, "Utilization"]}
            />
            <Bar
              dataKey="utilization"
              fill="#7C3AED"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ProjectStatusChart() {
  return (
    <Card className="h-[400px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Projects by Status</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={reportsData.projectsByStatus}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={4}
              dataKey="count"
            >
              {reportsData.projectsByStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181B",
                border: "1px solid #27272A",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#FAFAFA" }}
              formatter={(value: number, name: string) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute space-y-2">
          {reportsData.projectsByStatus.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.status}</span>
              <span className="text-sm font-medium text-foreground">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
