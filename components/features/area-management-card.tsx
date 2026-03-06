"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { AREAS } from "@/lib/areas";
import { clearSpaceAreaCache } from "@/lib/permissions/area-permissions";
import { useToast } from "@/components/ui/toast";
import { Layers, Check } from "lucide-react";

interface SpaceRow {
    id: string;
    name: string;
    color: string;
    areas: string[];
}

export function AreaManagementCard() {
    const { addToast } = useToast();
    const [spaces, setSpaces] = useState<SpaceRow[]>([]);
    const [saving, setSaving] = useState<string | null>(null); // spaceId currently saving
    const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase
            .from("Space")
            .select("id, name, color, areas")
            .order("name")
            .then(({ data }) => {
                if (data) {
                    setSpaces(
                        (data as Array<{ id: string; name: string; color: string; areas: string[] | null }>).map(
                            (s) => ({ ...s, areas: s.areas ?? [] })
                        )
                    );
                }
            });
    }, []);

    const handleAreaToggle = async (spaceId: string, area: string) => {
        const space = spaces.find((s) => s.id === spaceId);
        if (!space) return;

        const current = space.areas;
        const next = current.includes(area)
            ? current.filter((a) => a !== area)
            : [...current, area];

        // Optimistic update
        setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, areas: next } : s)));
        setSaving(spaceId);

        const res = await fetch(`/api/spaces/${spaceId}/areas`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areas: next }),
        });

        clearSpaceAreaCache(spaceId);
        setSaving(null);

        if (!res.ok) {
            addToast({ title: "Error al guardar las áreas", type: "error" });
            // Revert optimistic update
            setSpaces((prev) => prev.map((s) => (s.id === spaceId ? { ...s, areas: current } : s)));
        } else {
            setRecentlySaved(spaceId);
            setTimeout(() => setRecentlySaved(null), 2000);
        }
    };

    return (
        <Card className="p-6">
            <div className="flex items-center gap-2 mb-1">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Áreas por Cliente</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
                Asigna qué áreas internas gestionan cada cuenta cliente. Un usuario puede editar
                una cuenta si comparte al menos un área con ella. Sin áreas = acceso abierto.
            </p>

            <div className="space-y-3">
                {spaces.map((space) => (
                    <div key={space.id} className="rounded-md border px-4 py-3">
                        {/* Space header */}
                        <div className="flex items-center gap-2 mb-2.5">
                            <span
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: space.color }}
                            />
                            <span className="text-sm font-medium text-foreground flex-1 truncate">
                                {space.name}
                            </span>
                            {saving === space.id && (
                                <span className="text-xs text-muted-foreground">Guardando…</span>
                            )}
                            {recentlySaved === space.id && saving !== space.id && (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                            )}
                            {space.areas.length === 0 && saving !== space.id && recentlySaved !== space.id && (
                                <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                                    Acceso abierto
                                </Badge>
                            )}
                            {space.areas.length > 0 && saving !== space.id && recentlySaved !== space.id && (
                                <div className="flex gap-1 flex-wrap justify-end">
                                    {space.areas.map((a) => (
                                        <Badge key={a} variant="secondary" className="text-xs">
                                            {a}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Area checkboxes */}
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 pl-4">
                            {AREAS.map((area) => {
                                const checked = space.areas.includes(area);
                                return (
                                    <label
                                        key={area}
                                        className="flex items-center gap-1.5 cursor-pointer text-sm select-none"
                                    >
                                        <input
                                            type="checkbox"
                                            className="rounded border-input"
                                            checked={checked}
                                            disabled={saving === space.id}
                                            onChange={() => handleAreaToggle(space.id, area)}
                                        />
                                        <span
                                            className={
                                                checked
                                                    ? "text-foreground font-medium"
                                                    : "text-muted-foreground"
                                            }
                                        >
                                            {area}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
