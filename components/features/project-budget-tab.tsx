"use client";

import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Project, Task } from "@/lib/data";
import { formatCurrency, getProgressColor } from "@/lib/utils";

interface ProjectBudgetTabProps {
  project: Project;
  tasks: Task[];
}

export function ProjectBudgetTab({ project, tasks }: ProjectBudgetTabProps) {
  const budgetUsed = Math.round((project.spent / project.budget) * 100);
  const budgetRemaining = project.budget - project.spent;
  const isOverBudget = project.spent > project.budget;

  // Calculate hours by team member
  const hoursByMember = project.team.map((member) => {
    const memberTasks = tasks.filter((t) => t.assignee?.id === member.id);
    const hours = memberTasks.reduce((acc, t) => acc + t.loggedHours, 0);
    const cost = hours * member.hourlyRate;
    return {
      name: member.name.split(" ")[0],
      avatar: member.avatar,
      hours,
      cost,
      rate: member.hourlyRate,
    };
  });

  const totalHours = tasks.reduce((acc, t) => acc + t.loggedHours, 0);
  const estimatedHours = tasks.reduce((acc, t) => acc + t.estimatedHours, 0);

  // Budget breakdown by category (mock)
  const budgetBreakdown = [
    { name: "Design", value: project.spent * 0.4, color: "#7C3AED" },
    { name: "Development", value: project.spent * 0.35, color: "#3B82F6" },
    { name: "Strategy", value: project.spent * 0.15, color: "#22C55E" },
    { name: "Management", value: project.spent * 0.1, color: "#F59E0B" },
  ];

  // Monthly spending (mock)
  const monthlySpending = [
    { month: "Jan", actual: 8500, planned: 10000 },
    { month: "Feb", actual: 12500, planned: 12000 },
    { month: "Mar", actual: 10500, planned: 11000 },
  ];

  return (
    <div className="space-y-6">
      {/* Budget Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-success/20">
              <DollarSign className="h-5 w-5 text-studio-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(project.budget)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isOverBudget ? "bg-studio-error/20" : "bg-studio-info/20"
              }`}
            >
              {isOverBudget ? (
                <TrendingUp className="h-5 w-5 text-studio-error" />
              ) : (
                <TrendingDown className="h-5 w-5 text-studio-info" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spent</p>
              <p
                className={`text-xl font-semibold ${
                  isOverBudget ? "text-studio-error" : "text-foreground"
                }`}
              >
                {formatCurrency(project.spent)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                budgetRemaining < 0 ? "bg-studio-error/20" : "bg-primary/20"
              }`}
            >
              <DollarSign
                className={`h-5 w-5 ${
                  budgetRemaining < 0 ? "text-studio-error" : "text-primary"
                }`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p
                className={`text-xl font-semibold ${
                  budgetRemaining < 0 ? "text-studio-error" : "text-foreground"
                }`}
              >
                {formatCurrency(Math.abs(budgetRemaining))}
                {budgetRemaining < 0 && " over"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-studio-warning/20">
              <Clock className="h-5 w-5 text-studio-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours Logged</p>
              <p className="text-xl font-semibold text-foreground">
                {totalHours}h
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {estimatedHours}h
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Budget Progress */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Budget Usage</h3>
          {isOverBudget && (
            <Badge className="bg-studio-error/20 text-studio-error gap-1">
              <AlertTriangle className="h-3 w-3" />
              Over Budget
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCurrency(project.spent)} spent
            </span>
            <span className="text-foreground font-medium">{budgetUsed}%</span>
          </div>
          <Progress
            value={Math.min(budgetUsed, 100)}
            className="h-3"
            indicatorClassName={
              isOverBudget ? "bg-studio-error" : getProgressColor(100 - budgetUsed)
            }
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending by Category */}
        <Card className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            Spending by Category
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={budgetBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {budgetBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly Spending Trend */}
        <Card className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Monthly Spending</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="planned" fill="hsl(var(--muted))" name="Planned" />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Team Cost Breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">Team Cost Breakdown</h3>
        <div className="space-y-4">
          {hoursByMember.map((member) => (
            <div
              key={member.name}
              className="flex items-center gap-4 rounded-lg border border-border p-4"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {member.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-foreground">{member.name}</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(member.cost)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{member.hours} hours logged</span>
                  <span>{formatCurrency(member.rate)}/hr</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
