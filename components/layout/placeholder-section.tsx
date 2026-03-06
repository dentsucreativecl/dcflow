"use client";

import { FileText, BarChart3, Clock, Info } from "lucide-react";

interface PlaceholderSectionProps {
    title?: string;
    section?: string;
    description?: string;
}

export function PlaceholderSection({ title: titleProp, section, description }: PlaceholderSectionProps) {
        const sectionMap: Record<string, string> = {
        docs: "Documentos",
        reports: "Reportes",
        time: "Tiempo",
    };
    const title = titleProp || (section ? sectionMap[section] || section : "");

const getIcon = () => {
        switch ((title || "").toLowerCase()) {
            case "documentos":
            case "archivos":
                return <FileText className="h-8 w-8 text-muted-foreground" />;
            case "reportes":
                return <BarChart3 className="h-8 w-8 text-muted-foreground" />;
            case "tiempo":
            case "tiempos":
                return <Clock className="h-8 w-8 text-muted-foreground" />;
            default:
                return <Info className="h-8 w-8 text-muted-foreground" />;
        }
    };

    const getDefaultDescription = () => {
        switch ((title || "").toLowerCase()) {
            case "documentos":
            case "archivos":
                return "Gestiona todos tus archivos y documentos del proyecto";
            case " reportes":
                return "Visualiza métricas y reportes de rendimiento";
            case "tiempo":
            case "tiempos":
                return "Registra y analiza el tiempo dedicado a tareas";
            default:
                return "Esta funcionalidad estará disponible próximamente";
        }
    };

    return (
        <div className="px-4 py-12 text-center">
            <div className="flex justify-center mb-3">
                {getIcon()}
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                {description || getDefaultDescription()}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Próximamente</span>
            </div>
        </div>
    );
}
