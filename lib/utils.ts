import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateFull(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-studio-success/20 text-studio-success",
    "in-progress": "bg-studio-info/20 text-studio-info",
    "in progress": "bg-studio-info/20 text-studio-info",
    review: "bg-studio-warning/20 text-studio-warning",
    completed: "bg-studio-success/20 text-studio-success",
    approved: "bg-studio-success/20 text-studio-success",
    delivered: "bg-studio-primary/20 text-studio-primary",
    briefing: "bg-muted-foreground/20 text-muted-foreground",
    pending: "bg-studio-warning/20 text-studio-warning",
    cancelled: "bg-studio-error/20 text-studio-error",
  };
  return colors[status.toLowerCase()] || "bg-muted text-muted-foreground";
}

export function getProgressColor(progress: number): string {
  if (progress >= 80) return "bg-studio-success";
  if (progress >= 50) return "bg-studio-info";
  if (progress >= 25) return "bg-studio-warning";
  return "bg-studio-error";
}

/**
 * Detect @mentions in text and return mentioned usernames
 */
export function detectMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

