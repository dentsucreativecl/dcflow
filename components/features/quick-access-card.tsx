"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface QuickAccessCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  href: string;
  color: string;
}

export function QuickAccessCard({ title, count, icon: Icon, href, color }: QuickAccessCardProps) {
  const router = useRouter();

  return (
    <Card
      className="flex items-center gap-3 p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => router.push(href)}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
      </div>
    </Card>
  );
}
