"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Send, Smile, Paperclip, MessageCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface Message {
  id: string;
  sender: "me" | "other";
  content: string;
  time: string;
  attachment?: { name: string; size: string; type: string };
}

interface Contact {
  name: string;
  initials: string;
  role: string;
  status: string;
}

export default function DMPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const rawContactId = params.contactId as string;
  const contactId = rawContactId === '_' ? (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '') : rawContactId;
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('dcflow:refresh', handler);
    return () => window.removeEventListener('dcflow:refresh', handler);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    if (!contactId) { setLoading(false); return; }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchContact() {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, name, role, jobTitle")
        .eq("id", contactId)
        .single();
      if (data && !cancelled) {
        const initials = data.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2);
        setContact({
          name: data.name,
          initials,
          role: data.jobTitle || data.role || "Miembro",
          status: "Disponible",
        });
      }
      if (!cancelled) setLoading(false);
    }
    fetchContact().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [contactId, user, authLoading, refreshKey]);

  const sendMessage = () => {
    if (!message.trim() && !attachment) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "me",
      content: attachment && !message.trim() ? "Archivo adjunto" : message,
      time: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
      attachment: attachment ? {
        name: attachment.name,
        size: (attachment.size / 1024).toFixed(1) + " KB",
        type: attachment.type.split("/")[0] || "file",
      } : undefined,
    };
    setMessages([...messages, newMsg]);
    setMessage("");
    setAttachment(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    if (e.target) e.target.value = "";
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col animate-fade-in-up">
        <div className="flex items-center gap-3 border-b border-border px-6 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Contacto no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Mensajes</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{contact.name}</span>
          </div>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{contact.initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-sm font-semibold">{contact.name}</h1>
            <p className="text-xs text-muted-foreground">{contact.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1" />
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hay mensajes aun</p>
            <p className="text-xs text-muted-foreground mt-1">Envia el primer mensaje a {contact.name}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  msg.sender === "me"
                    ? "bg-[var(--peach)] text-black rounded-br-md"
                    : "bg-accent text-foreground rounded-bl-md"
                }`}>
                  <p className="text-sm">{msg.content}</p>
                  {msg.attachment && (
                    <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-black/10 max-w-xs">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{msg.attachment.name}</p>
                        <p className="text-[10px] opacity-60">{msg.attachment.size}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] mt-1 opacity-60">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border p-4">
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-accent/50 border border-border">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{attachment.name}</span>
            <span className="text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(1)} KB</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setAttachment(null)}>
              <span className="text-xs">X</span>
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Mensaje para ${contact.name}...`}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Smile className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 bg-[var(--peach)] hover:bg-[var(--peach)]/90"
            onClick={sendMessage}
            disabled={!message.trim() && !attachment}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
