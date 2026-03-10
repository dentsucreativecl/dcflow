"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Hash, Send, Smile, Paperclip, AtSign, Users, Pin, Loader2, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { log } from "@/lib/logger";

interface AttachmentData {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface MessageData {
  id: string;
  content: string;
  attachments: AttachmentData[] | null;
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

const EMOJI_LIST = [
  "👍", "❤️", "😂", "🎉", "🔥", "👀", "✅", "🚀",
  "💯", "👏", "😍", "🤔", "😊", "🙌", "💪", "⭐",
  "📌", "💡", "⚡", "🎯", "✨", "🤝", "📎", "🗂️",
];

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
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

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

      const { count } = await supabase
        .from("ChannelMember")
        .select("id", { count: "exact", head: true })
        .eq("channelId", channelData.id);

      if (count !== null) setMemberCount(count);

      const { data: messagesData } = await supabase
        .from("Message")
        .select("id, content, attachments, createdAt, user:User(id, name, avatarUrl)")
        .eq("channelId", channelData.id)
        .order("createdAt", { ascending: true });

      if (messagesData) {
        setMessages(
          messagesData.map((m: Record<string, unknown>) => ({
            ...m,
            user: Array.isArray(m.user) ? m.user[0] : m.user,
            attachments: m.attachments as AttachmentData[] | null,
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

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id as string,
                content: newMsg.content as string,
                attachments: newMsg.attachments as AttachmentData[] | null,
                createdAt: newMsg.createdAt as string,
                user: null,
              },
            ];
          });

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
    if ((!message.trim() && !attachment) || !user || !channel) return;

    const supabase = createClient();
    const msgId = crypto.randomUUID();
    const content = message.trim();
    let attachments: AttachmentData[] | null = null;

    // Upload attachment if present
    if (attachment) {
      setUploading(true);
      const ext = attachment.name.split(".").pop() || "bin";
      const path = `channels/${channel.id}/${msgId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, attachment, { contentType: attachment.type });

      if (uploadError) {
        log.error("Error uploading file:", uploadError.message);
        // Try without public bucket — generate signed URL
        setUploading(false);
      } else {
        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(path);

        attachments = [{
          name: attachment.name,
          url: urlData.publicUrl,
          type: attachment.type,
          size: attachment.size,
        }];
      }
      setUploading(false);
    }

    // Optimistic update
    const optimisticMsg: MessageData = {
      id: msgId,
      content: content || (attachments ? `📎 ${attachments[0].name}` : ""),
      attachments,
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
        content: content || (attachments ? `📎 ${attachments[0].name}` : ""),
        attachments: attachments || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (error) {
        log.error("Error sending message:", error);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch (err) {
      log.error("Error sending message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    if (e.target) e.target.value = "";
  };

  const insertEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setEmojiOpen(false);
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

  const isImageType = (type: string) =>
    type.startsWith("image/");

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
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.attachments.map((att, i) =>
                      isImageType(att.type) ? (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={att.url}
                            alt={att.name}
                            className="max-w-xs max-h-60 rounded-lg border border-border object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm hover:bg-accent transition-colors w-fit"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{att.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(att.size / 1024).toFixed(1)} KB
                          </span>
                        </a>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border p-4">
        {attachment && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-accent/50 border border-border">
            {attachment.type.startsWith("image/") ? (
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
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
              <X className="h-3 w-3" />
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
            onKeyDown={(e) => e.key === "Enter" && !uploading && sendMessage()}
            placeholder={`Escribe en #${channel.name}...`}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <AtSign className="h-4 w-4" />
          </Button>
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" type="button">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end" side="top" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 bg-[var(--peach)] hover:bg-[var(--peach)]/90"
            onClick={sendMessage}
            disabled={(!message.trim() && !attachment) || uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
