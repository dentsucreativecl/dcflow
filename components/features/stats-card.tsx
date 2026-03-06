"use client";

import { LucideIcon, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeText?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
}

export function StatsCard({
  title,
  value,
  change,
  changeText,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  onClick,
}: StatsCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === "up") return TrendingUp;
    if (trend === "down") return TrendingDown;
    return Target;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend === "up") return "text-studio-success";
    if (trend === "down") return "text-studio-error";
    return "text-primary";
  };

  const TrendIcon = getTrendIcon();

  return (
    <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="mt-3">
        <span className="text-[32px] font-semibold text-foreground">
          {value}
        </span>
      </div>
      {(change !== undefined || changeText) && (
        <div className="mt-2 flex items-center gap-1">
          {TrendIcon && (
            <TrendIcon className={cn("h-3.5 w-3.5", getTrendColor())} />
          )}
          <span className={cn("text-xs", getTrendColor())}>
            {change !== undefined && change > 0 && "+"}
            {change !== undefined && `${change}%`}
            {changeText && ` ${changeText}`}
          </span>
        </div>
      )}
    </Card>
  );
}
