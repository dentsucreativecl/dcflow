"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Hash, Send, Smile, Paperclip, AtSign, Users, Pin, Loader2, X, Image as ImageIcon, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface ChannelMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

const EMOJI_LIST = [
  "👍", "❤️", "😂", "🎉", "🔥", "👀", "✅", "🚀",
  "💯", "👏", "😍", "🤔", "😊", "🙌", "💪", "⭐",
  "📌", "💡", "⚡", "🎯", "✨", "🤝", "📎", "🗂️",
];

/** Highlight @mention spans in message content */
function MessageContent({ content, memberNames }: { content: string; memberNames: Set<string> }) {
  const parts = content.split(/(@\S+)/g);
  return (
    <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("@") && memberNames.has(part.slice(1).toLowerCase())) {
          return (
            <span key={i} className="text-blue-500 font-medium bg-blue-500/10 rounded px-0.5">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function ChannelPage() {
  const params = useParams();
  const { user, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const slug = params.channelId as string;
  const canManageMembers = isAdmin || isSuperAdmin;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  // Last-resort safety: never stay stuck in loading state
  useEffect(() => { const t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(t); }, []);

  // Members
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // Mention
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Derived: set of lowercase member first names for highlight matching
  const memberNameSet = new Set(
    channelMembers.map((m) => m.name.split(" ")[0].toLowerCase())
  );
  // For mention filtering
  const filteredMentions = channelMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );
  // Users not yet in channel (for add dropdown)
  const availableUsers = allUsers.filter(
    (u) => !channelMembers.some((m) => m.userId === u.id)
  );

  // Load channel, messages and members
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    if (!slug || slug === "_") return;

    let cancelled = false;
    setLoading(true);

    const timeoutId = setTimeout(() => {
      if (!cancelled) { cancelled = true; setLoading(false); }
    }, 8000);

    async function fetchChannel() {
      const supabase = createClient();

      const { data: channelData } = await supabase
        .from("Channel")
        .select("id, name, slug, description")
        .eq("slug", slug)
        .single();

      if (!channelData) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) setChannel(channelData);

      // Fetch messages
      const { data: messagesData } = await supabase
        .from("Message")
        .select("id, content, attachments, createdAt, user:User(id, name, avatarUrl)")
        .eq("channelId", channelData.id)
        .order("createdAt", { ascending: true });

      if (messagesData && !cancelled) {
        setMessages(
          messagesData.map((m: Record<string, unknown>) => ({
            ...m,
            user: Array.isArray(m.user) ? m.user[0] : m.user,
            attachments: m.attachments as AttachmentData[] | null,
          })) as MessageData[]
        );
      }

      // Fetch channel members with user info
      const { data: membersData } = await supabase
        .from("ChannelMember")
        .select("userId, User!userId(id, name, avatarUrl)")
        .eq("channelId", channelData.id);

      if (membersData && !cancelled) {
        setChannelMembers(
          membersData.map((m: any) => {
            const u = Array.isArray(m.User) ? m.User[0] : m.User;
            return {
              userId: m.userId,
              name: u?.name || "Usuario",
              avatarUrl: u?.avatarUrl || null,
            };
          })
        );
      }

      if (!cancelled) setLoading(false);
      setTimeout(scrollToBottom, 100);
    }

    fetchChannel().finally(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [slug, scrollToBottom, user, authLoading]);

  // Load all users for admin member management
  useEffect(() => {
    if (!canManageMembers) return;
    const supabase = createClient();
    supabase
      .from("User")
      .select("id, name")
      .eq("isActive", true)
      .neq("userType", "GUEST")
      .order("name")
      .then(({ data }) => { if (data) setAllUsers(data); });
  }, [canManageMembers]);

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
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime error, continuing without realtime:', err);
        }
      });

    return () => { supabase.removeChannel(subscription); };
  }, [channel?.id, scrollToBottom]);

  const sendMessage = async () => {
    if ((!message.trim() && !attachment) || !user || !channel) return;

    const supabase = createClient();
    const msgId = crypto.randomUUID();
    const content = message.trim();
    let attachments: AttachmentData[] | null = null;

    if (attachment) {
      setUploading(true);
      const ext = attachment.name.split(".").pop() || "bin";
      const path = `channels/${channel.id}/${msgId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, attachment, { contentType: attachment.type });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(path);

        attachments = [{
          name: attachment.name,
          url: urlData.publicUrl,
          type: attachment.type,
          size: attachment.size,
        }];
      } else {
        log.error("Error uploading file:", uploadError.message);
      }
      setUploading(false);
    }

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
      const finalContent = content || (attachments ? `📎 ${attachments[0].name}` : "");
      const { error } = await supabase.from("Message").insert({
        id: msgId,
        channelId: channel.id,
        userId: user.id,
        content: finalContent,
        attachments: attachments || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (error) {
        log.error("Error sending message:", error);
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        return;
      }

      // ── Mention notifications ──────────────────────────────────────────
      const mentionMatches = [...finalContent.matchAll(/@(\S+)/g)].map(m => m[1].toLowerCase());
      if (mentionMatches.length > 0) {
        const mentionedMembers = channelMembers.filter(
          (m) => mentionMatches.includes(m.name.split(" ")[0].toLowerCase()) && m.userId !== user.id
        );
        if (mentionedMembers.length > 0) {
          const notifications = mentionedMembers.map((m) => ({
            id: crypto.randomUUID(),
            type: "MENTION",
            userId: m.userId,
            actorId: user.id,
            title: `${user.name} te mencionó en #${channel.name}`,
            message: finalContent.length > 100 ? finalContent.slice(0, 97) + "…" : finalContent,
            isRead: false,
            data: { channelSlug: slug },
            createdAt: new Date().toISOString(),
          }));
          await supabase.from("Notification").insert(notifications);
        }
      }
    } catch (err) {
      log.error("Error sending message:", err);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    }
  };

  // ── @ mention handlers ────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionSearch("");
    }
  };

  const insertMention = (name: string) => {
    const input = inputRef.current;
    const cursor = input?.selectionStart ?? message.length;
    const textBefore = message.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf("@");
    const newMsg = message.slice(0, atIndex) + "@" + name.split(" ")[0] + " " + message.slice(cursor);
    setMessage(newMsg);
    setMentionOpen(false);
    setMentionSearch("");
    setTimeout(() => {
      input?.focus();
      const pos = atIndex + name.split(" ")[0].length + 2;
      input?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleAtClick = () => {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? message.length;
    const newMsg = message.slice(0, cursor) + "@" + message.slice(cursor);
    setMessage(newMsg);
    setMentionOpen(true);
    setMentionSearch("");
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(cursor + 1, cursor + 1);
    }, 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !uploading) {
      if (mentionOpen && filteredMentions.length > 0) {
        e.preventDefault();
        insertMention(filteredMentions[0].name);
      } else {
        sendMessage();
      }
    }
    if (e.key === "Escape") {
      setMentionOpen(false);
    }
  };

  // ── Member management handlers ────────────────────────────────────────────

  const handleAddMember = async () => {
    if (!addUserId || !channel) return;
    setAddingMember(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("ChannelMember").insert({
        channelId: channel.id,
        userId: addUserId,
      });
      if (error) throw error;
      const found = allUsers.find((u) => u.id === addUserId);
      if (found) {
        setChannelMembers((prev) => [...prev, { userId: found.id, name: found.name, avatarUrl: null }]);
      }
      setAddUserId("");
    } catch (err) {
      log.error("Error adding member:", err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!channel) return;
    setRemovingMember(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("ChannelMember")
        .delete()
        .eq("channelId", channel.id)
        .eq("userId", userId);
      if (error) throw error;
      setChannelMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err) {
      log.error("Error removing member:", err);
    } finally {
      setRemovingMember(null);
    }
  };

  // ── Utilities ─────────────────────────────────────────────────────────────

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
    name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const isImageType = (type: string) => type.startsWith("image/");

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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{channel.name}</h1>
          {channel.description && (
            <span className="text-sm text-muted-foreground ml-2">{channel.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Members panel */}
          <Popover open={membersOpen} onOpenChange={setMembersOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Miembros">
                <Users className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end" side="bottom">
              <div className="p-3 border-b">
                <p className="text-sm font-semibold">
                  Miembros del canal ({channelMembers.length})
                </p>
              </div>

              {/* Add member — admin only */}
              {canManageMembers && availableUsers.length > 0 && (
                <div className="p-3 border-b flex gap-2">
                  <Select value={addUserId} onValueChange={setAddUserId}>
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue placeholder="Agregar miembro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 px-2"
                    disabled={!addUserId || addingMember}
                    onClick={handleAddMember}
                  >
                    {addingMember
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <UserPlus className="h-3 w-3" />}
                  </Button>
                </div>
              )}

              {/* Member list */}
              <ScrollArea className="max-h-60">
                <div className="p-2 space-y-0.5">
                  {channelMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin miembros</p>
                  )}
                  {channelMembers.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground shrink-0">
                          {getInitials(m.name)}
                        </div>
                        <span className="text-sm truncate">{m.name}</span>
                        {m.userId === user?.id && (
                          <span className="text-[10px] text-muted-foreground">(tú)</span>
                        )}
                      </div>
                      {canManageMembers && m.userId !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={removingMember === m.userId}
                          onClick={() => handleRemoveMember(m.userId)}
                        >
                          {removingMember === m.userId
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <UserMinus className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fijar mensaje">
            <Pin className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {channelMembers.length} miembro{channelMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Messages */}
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
                  <span className="font-semibold text-sm">{msg.user?.name || "Usuario"}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(msg.createdAt)}</span>
                </div>
                <MessageContent content={msg.content} memberNames={memberNameSet} />
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

      {/* Input area */}
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
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setAttachment(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* @ mention dropdown */}
        {mentionOpen && filteredMentions.length > 0 && (
          <div className="mb-2 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
              Mencionar miembro
            </div>
            {filteredMentions.map((m) => (
              <button
                key={m.userId}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m.name); }}
              >
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground shrink-0">
                  {getInitials(m.name)}
                </div>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground text-xs">@{m.name.split(" ")[0]}</span>
              </button>
            ))}
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
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={`Escribe en #${channel.name}...`}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleAtClick}
            title="Mencionar"
          >
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
