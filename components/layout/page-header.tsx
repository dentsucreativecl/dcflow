"use client";

import { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { GlobalSearch } from "@/components/features/global-search";
import { NotificationsDropdown } from "@/components/features/notifications-dropdown";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  showSearch?: boolean;
  showNewButton?: boolean;
  newButtonText?: string;
  onNewClick?: () => void;
}

export function PageHeader({
  title,
  description,
  actions,
  showSearch = true,
  showNewButton = false,
  newButtonText = "New",
  onNewClick,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-[28px] font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {showSearch && <GlobalSearch />}
        <NotificationsDropdown />
        <ThemeToggle />
        {showNewButton && (
          <Button onClick={onNewClick} className="gap-2">
            <Plus className="h-4 w-4" />
            {newButtonText}
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
