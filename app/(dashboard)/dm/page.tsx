"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface UserContact {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
}

export default function DmIndexPage() {
  const { user, loading: authLoading } = useAuth();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchContacts() {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, name, email, avatarUrl, department")
        .neq("id", user!.id)
        .eq("isActive", true)
        .order("name");
      if (data && !cancelled) setContacts(data);
      if (!cancelled) setLoading(false);
    }
    fetchContacts().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [user, authLoading, refreshKey]);

  const filtered = search.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : contacts;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Mensajes Directos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona una persona para iniciar una conversación
        </p>
      </div>

      <div className="px-6 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="grid gap-2">
          {filtered.map((contact) => (
            <Link
              key={contact.id}
              href={`/dm/${contact.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground shrink-0">
                {getInitials(contact.name)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{contact.name}</p>
                <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
              </div>
              {contact.department && (
                <span className="text-xs text-muted-foreground">{contact.department}</span>
              )}
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No se encontraron contactos
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
