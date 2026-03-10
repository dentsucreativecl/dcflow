"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Hash, Send, Smile, Paperclip, AtSign, MoreHorizontal, Users, Pin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";

interface MessageData {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

interface ChannelData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export default function ChannelPage() {
  const params = useParams();
  const { user } = useAuth();
  const slug = params.channelId as string;
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Load channel and messages
  useEffect(() => {
    if (!slug || slug === "_") return;

    async function fetchChannel() {
      setLoading(true);
      const supabase = createClient();

      // Fetch channel by slug
      const { data: channelData } = await supabase
        .from("Channel")
        .select("id, name, slug, description")
        .eq("slug", slug)
        .single();

      if (!channelData) {
        setLoading(false);
        return;
      }

      setChannel(channelData);

      // Fetch member count
      const { count } = await supabase
        .from("ChannelMember")
        .select("id", { count: "exact", head: true })
        .eq("channelId", channelData.id);

      if (count !== null) setMemberCount(count);

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("Message")
        .select("id, content, createdAt, user:User(id, name, avatarUrl)")
        .eq("channelId", channelData.id)
        .order("createdAt", { ascending: true });

      if (messagesData) {
        setMessages(
          messagesData.map((m: Record<string, unknown>) => ({
            ...m,
            user: Array.isArray(m.user) ? m.user[0] : m.user,
          })) as MessageData[]
        );
      }

      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }

    fetchChannel();
  }, [slug, scrollToBottom]);

  // Real-time subscription
  useEffect(() => {
    if (!channel?.id) return;

    const supabase = createClient();

    const subscription = supabase
      .channel("messages-" + channel.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `channelId=eq.${channel.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Record<string, unknown>;

          // Don't duplicate messages we already added optimistically
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            // Fetch user info for the message
            // For now use a placeholder; we'll enrich below
            return [
              ...prev,
              {
                id: newMsg.id as string,
                content: newMsg.content as string,
                createdAt: newMsg.createdAt as string,
                user: null,
              },
            ];
          });

          // Enrich with user data
          const { data: userData } = await supabase
            .from("User")
            .select("id, name, avatarUrl")
            .eq("id", newMsg.userId as string)
            .single();

          if (userData) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === newMsg.id ? { ...m, user: userData } : m
              )
            );
          }

          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channel?.id, scrollToBottom]);

  const sendMessage = async () => {
    if (!message.trim() || !user || !channel) return;

    const supabase = createClient();
    const msgId = crypto.randomUUID();
    const content = message.trim();

    // Optimistic update
    const optimisticMsg: MessageData = {
      id: msgId,
      content,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name || "Usuario",
        avatarUrl: user.avatar || null,
      },
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMessage("");
    setAttachment(null);
    setTimeout(scrollToBottom, 50);

    try {
      const { error } = await supabase.from("Message").insert({
        id: msgId,
        channelId: channel.id,
        userId: user.id,
        content,
        updatedAt: new Date().toISOString(),
      });

      if (error) {
        console.error("Error sending message:", error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    if (e.target) e.target.value = "";
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Canal no encontrado
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{channel.name}</h1>
          {channel.description && (
            <span className="text-sm text-muted-foreground ml-2">
              {channel.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Miembros">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fijar mensaje">
            <Pin className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {memberCount} miembro{memberCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex gap-3 group hover:bg-accent/30 -mx-3 px-3 py-2 rounded-lg transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {msg.user ? getInitials(msg.user.name) : "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">
                    {msg.user?.name || "Usuario"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-0.5">{msg.content}</p>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Smile className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-4">
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-accent/50 border border-border">
            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate flex-1">{attachment.name}</span>
            <span className="text-xs text-muted-foreground">
              {(attachment.size / 1024).toFixed(1)} KB
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setAttachment(null)}
            >
              <span className="text-xs">X</span>
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Escribe en #${channel.name}...`}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <AtSign className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Smile className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 bg-[var(--peach)] hover:bg-[var(--peach)]/90"
            onClick={sendMessage}
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
