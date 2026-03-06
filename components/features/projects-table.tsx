"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
} from "@tanstack/react-table";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Project } from "@/lib/data";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, getStatusColor, getProgressColor } from "@/lib/utils";

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "name",
    header: "Nombre del Proyecto",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: row.original.color }}
        >
          {row.original.name.charAt(0)}
        </div>
        <span className="font-medium text-foreground">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "client",
    header: "Cliente",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.client}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const statusLabels: Record<string, string> = {
        briefing: "Briefing",
        "in-progress": "In Progress",
        review: "Review",
        approved: "Approved",
        delivered: "Delivered",
      };
      return (
        <Badge className={getStatusColor(row.original.status)}>
          {statusLabels[row.original.status]}
        </Badge>
      );
    },
  },
  {
    accessorKey: "progress",
    header: "Progreso",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 w-[140px]">
        <Progress
          value={row.original.progress}
          className="h-1.5 w-20"
          indicatorClassName={getProgressColor(row.original.progress)}
        />
        <span className="text-sm text-muted-foreground">
          {row.original.progress}%
        </span>
      </div>
    ),
  },
  {
    accessorKey: "dueDate",
    header: "Fecha Límite",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.dueDate)}
      </span>
    ),
  },
  {
    accessorKey: "team",
    header: "Equipo",
    cell: ({ row }) => (
      <div className="flex -space-x-2">
        {row.original.team.slice(0, 3).map((member, i) => (
          <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {member.avatar}
            </AvatarFallback>
          </Avatar>
        ))}
        {row.original.team.length > 3 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-medium">
            +{row.original.team.length - 3}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "budget",
    header: () => <span className="text-right block">Budget</span>,
    cell: ({ row }) => (
      <span className="text-right block font-medium text-foreground">
        {formatCurrency(row.original.budget)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const meta = table.options.meta as { openModal: (type: string, data?: Record<string, unknown>) => void; deleteProject: (id: string) => void };
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => meta.openModal("project-detail", { projectId: row.original.id })}>
              <Eye className="h-4 w-4 mr-2" />
              Quick View
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/projects/${row.original.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => meta.deleteProject(row.original.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ProjectsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { projects, openModal, deleteProject } = useAppStore();
  const { addToast } = useToast();

  const handleDelete = (id: string) => {
    deleteProject(id);
    addToast({ title: "Project deleted", type: "success" });
  };

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    meta: {
      openModal,
      deleteProject: handleDelete,
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table Header */}
      <div className="bg-secondary px-4">
        <div className="flex h-12 items-center">
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => (
              <div
                key={header.id}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                style={{
                  width:
                    header.id === "name"
                      ? 240
                      : header.id === "actions"
                      ? 40
                      : header.id === "budget"
                      ? "auto"
                      : header.column.columnDef.size || "auto",
                  flex: header.id === "budget" || header.id === "name" ? 1 : "none",
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Table Body */}
      <div>
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="flex h-16 items-center border-b border-border px-4 hover:bg-secondary/50 transition-colors cursor-pointer"
            onClick={() => openModal("project-detail", { projectId: row.original.id })}
          >
            {row.getVisibleCells().map((cell) => (
              <div
                key={cell.id}
                style={{
                  width:
                    cell.column.id === "name"
                      ? 240
                      : cell.column.id === "actions"
                      ? 40
                      : cell.column.id === "budget"
                      ? "auto"
                      : cell.column.columnDef.size || "auto",
                  flex: cell.column.id === "budget" || cell.column.id === "name" ? 1 : "none",
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Table Footer */}
      <div className="flex h-[52px] items-center justify-between border-t border-border px-4">
        <span className="text-sm text-muted-foreground">
          Mostrando {table.getRowModel().rows.length} de {projects.length} proyectos
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: table.getPageCount() }, (_, i) => i + 1).map(
            (page) => (
              <Button
                key={page}
                variant={
                  table.getState().pagination.pageIndex === page - 1
                    ? "default"
                    : "secondary"
                }
                size="icon"
                className="h-8 w-8"
                onClick={() => table.setPageIndex(page - 1)}
              >
                {page}
              </Button>
            )
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
