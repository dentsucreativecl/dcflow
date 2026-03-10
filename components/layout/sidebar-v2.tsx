"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { IconBar } from "./icon-bar";
import { ContextPanel } from "./context-panel";
// TimeTracker eliminado — timer en tiempo real removido
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SidebarV2Props {
  className?: string;
}

export function SidebarV2({ className }: SidebarV2Props) {
  const [activeSection, setActiveSection] = useState("home");
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(240);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(240);

  const handleSectionChange = (section: string) => {
    if (section === activeSection && isPanelOpen) {
      setIsPanelOpen(false);
    } else {
      setActiveSection(section);
      setIsPanelOpen(true);
    }
  };

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startX.current = e.clientX;
    startW.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.min(Math.max(startW.current + delta, 200), 480);
      setPanelWidth(newW);
    };
    const onUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const togglePanel = () => setIsPanelOpen(p => !p);

  return (
    <div className={cn("flex h-screen", className)}>
      <IconBar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />
      <div className="relative flex">
        <div
          className="overflow-hidden"
          style={{ width: isPanelOpen ? panelWidth : 0, transition: isResizing.current ? "none" : "width 200ms" }}
        >
          <ContextPanel isOpen={isPanelOpen} activeSection={activeSection} />
        </div>
        {isPanelOpen && (
          <div className="relative flex flex-col items-center flex-shrink-0">
            <div
              onMouseDown={onResizeStart}
              className="w-1.5 h-full cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500/60 transition-colors"
              title="Arrastrar para redimensionar"
            />
            <button
              onClick={togglePanel}
              className="absolute top-1/2 -translate-y-1/2 -right-3 z-10 flex items-center justify-center w-6 h-6 bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
              title="Cerrar panel lateral"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}
        {!isPanelOpen && (
          <button
            onClick={togglePanel}
            className="flex items-center justify-center w-6 h-12 my-auto bg-muted/80 hover:bg-muted border border-border rounded-r-md transition-colors self-center"
            title="Abrir panel lateral"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {/* TimeTracker eliminado */}
    </div>
  );
}
