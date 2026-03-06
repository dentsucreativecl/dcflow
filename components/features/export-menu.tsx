"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, File } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
    exportProjectsToPDF,
    exportProjectsToCSV,
    exportProjectsToExcel,
    exportTasksToCSV,
    exportTeamToCSV,
} from "@/lib/export";
import { useToast } from "@/components/ui/use-toast";

interface ExportMenuProps {
    type: "projects" | "tasks" | "team";
}

export function ExportMenu({ type }: ExportMenuProps) {
    const [isExporting, setIsExporting] = useState(false);
    const { projects, tasks, teamMembers } = useAppStore();
    const { toast } = useToast();

    const handleExport = async (format: "pdf" | "csv" | "excel") => {
        setIsExporting(true);
        try {
            switch (type) {
                case "projects":
                    if (format === "pdf") {
                        exportProjectsToPDF(projects);
                    } else if (format === "csv") {
                        exportProjectsToCSV(projects);
                    } else {
                        await exportProjectsToExcel(projects);
                    }
                    break;
                case "tasks":
                    if (format === "csv") {
                        exportTasksToCSV(tasks, projects);
                    }
                    break;
                case "team":
                    if (format === "csv") {
                        exportTeamToCSV(teamMembers);
                    }
                    break;
            }

            toast({
                title: "Export successful",
                description: `${type} exported as ${format.toUpperCase()}`,
            });
        } catch (error) {
            toast({
                title: "Export failed",
                description: "There was an error exporting the data",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {type === "projects" && (
                    <>
                        <DropdownMenuItem onClick={() => handleExport("pdf")}>
                            <FileText className="h-4 w-4 mr-2" />
                            Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport("excel")}>
                            <Table className="h-4 w-4 mr-2" />
                            Export as Excel
                        </DropdownMenuItem>
                    </>
                )}
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <File className="h-4 w-4 mr-2" />
                    Export as CSV
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
