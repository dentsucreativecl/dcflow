"use client";

import { useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  icon?: React.ReactNode;
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  icon,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectAll = () => {
    onChange(options.map((o) => o.value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 bg-card",
            selected.length > 0 && "border-primary"
          )}
        >
          {icon || <Filter className="h-4 w-4" />}
          {label}
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 bg-primary text-primary-foreground"
            >
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={clearAll}
            >
              Limpiar
            </Button>
          )}
        </div>

        {/* Options */}
        <div className="p-2 max-h-[300px] overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => toggleOption(option.value)}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-secondary transition-colors"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                className="pointer-events-none"
              />
              <span className="flex-1 text-sm text-foreground text-left">
                {option.label}
              </span>
              {option.count !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {option.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={selectAll}
          >
            Seleccionar Todo
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Multi-filter component for combining multiple filters
interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface MultiFilterProps {
  filters: FilterConfig[];
  values: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  onClearAll: () => void;
}

export function MultiFilter({
  filters,
  values,
  onChange,
  onClearAll,
}: MultiFilterProps) {
  const activeFilterCount = Object.values(values).reduce(
    (acc, v) => acc + v.length,
    0
  );

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <FilterDropdown
          key={filter.key}
          label={filter.label}
          options={filter.options}
          selected={values[filter.key] || []}
          onChange={(selected) => onChange(filter.key, selected)}
        />
      ))}

      {activeFilterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={onClearAll}
        >
          <X className="h-4 w-4" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  );
}
