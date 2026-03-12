"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Hash, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: number;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("Channel")
        .select("id, name, slug, description")
        .eq("isArchived", false)
        .order("name");
      if (!cancelled) setChannels(data || []);
      if (!cancelled) setLoading(false);
    }
    load().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <MessageSquare className="h-12 w-12" />
        <p className="text-lg font-medium">No hay canales disponibles</p>
        <p className="text-sm">Los canales aparecerán aquí cuando un administrador los cree.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold">Canales</h2>
        <p className="text-muted-foreground text-sm mt-1">Selecciona un canal para ver los mensajes</p>
      </div>
      <div className="space-y-2">
        {channels.map((ch) => (
          <Link key={ch.id} href={`/channels/${ch.slug}`}>
            <Card className="p-4 hover:bg-accent/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Hash className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium"># {ch.name.toLowerCase()}</p>
                  {ch.description && (
                    <p className="text-sm text-muted-foreground truncate">{ch.description}</p>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
