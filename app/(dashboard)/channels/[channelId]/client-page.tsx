"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Hash, Send, Smile, Paperclip, AtSign, MoreHorizontal, Users, Bell, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";

interface Message {
  id: string;
  user: string;
  avatar: string;
  content: string;
  time: string;
  reactions?: { emoji: string; count: number }[];
  attachment?: { name: string; size: string; type: string; url?: string };
}

const channelMessages: Record<string, Message[]> = {
  general: [
    { id: "1", user: "Rebecca Sottorff", avatar: "RS", content: "Buenos dias equipo. Recordatorio: la reunion de alineacion es a las 10am.", time: "9:15 AM", reactions: [{ emoji: "👍", count: 3 }] },
    { id: "2", user: "Jose Rojas", avatar: "JR", content: "Perfecto, ahi estare. Alguien tiene el link de la sala?", time: "9:18 AM" },
    { id: "3", user: "Zacha Martinez", avatar: "ZM", content: "https://meet.google.com/abc-defg-hij", time: "9:20 AM", reactions: [{ emoji: "🙏", count: 2 }] },
    { id: "4", user: "Valentina Espinoza", avatar: "VE", content: "El cliente de Cardio Autos confirmo la reunion del viernes para revisar las propuestas.", time: "10:45 AM" },
    { id: "5", user: "Rebecca Sottorff", avatar: "RS", content: "Excelente. Tengo 3 propuestas listas. Las subo al espacio de Creatividad.", time: "10:48 AM", reactions: [{ emoji: "🔥", count: 4 }] },
  ],
  creatividad: [
    { id: "1", user: "Jose Rojas", avatar: "JR", content: "Equipo, necesito feedback sobre los moodboards del rebranding.", time: "2:00 PM", attachment: { name: "moodboard-opcion-B.png", size: "2.4 MB", type: "image", url: "https://picsum.photos/seed/moodboard/400/300" } },
    { id: "2", user: "Zacha Martinez", avatar: "ZM", content: "Me gusta la direccion de la opcion B, tiene mas fuerza visual.", time: "2:15 PM", reactions: [{ emoji: "👍", count: 2 }] },
    { id: "3", user: "Valentina Espinoza", avatar: "VE", content: "Coincido. La paleta de colores es mas moderna.", time: "2:22 PM" },
  ],
  produccion: [
    { id: "1", user: "Rebecca Sottorff", avatar: "RS", content: "El spot de Cardio Autos necesita casting para manana. Tenemos confirmados?", time: "11:00 AM" },
    { id: "2", user: "Jose Rojas", avatar: "JR", content: "Tengo 5 candidatos confirmados. Envio portafolio por DM.", time: "11:30 AM", attachment: { name: "casting-portafolio.pdf", size: "1.8 MB", type: "file" } },
  ],
};

const channelInfo: Record<string, { name: string; description: string; members: number }> = {
  general: { name: "general", description: "Canal general del equipo", members: 12 },
  creatividad: { name: "creatividad", description: "Discusión del área creativa", members: 8 },
  produccion: { name: "produccion", description: "Coordinación de producción", members: 6 },
};

export default function ChannelPage() {
  const params = useParams();
  const { user } = useAuth();
  const rawChannelId = params.channelId as string;
  // Get actual channelId from URL path if params return placeholder
  const channelId = rawChannelId === '_' ? (typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '') : rawChannelId;
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>(channelMessages[channelId] || []);
  const info = channelInfo[channelId] || { name: channelId, description: "", members: 0 };

  const sendMessage = () => {
    if (!message.trim() && !attachment) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      user: user?.name || "Usuario",
      avatar: user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().substring(0, 2) : "U",
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

  return (
    <div className="flex h-full flex-col animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{info.name}</h1>
          <span className="text-sm text-muted-foreground ml-2">{info.description}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Miembros">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Fijar mensaje">
            <Pin className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{info.members} miembros</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3 group hover:bg-accent/30 -mx-3 px-3 py-2 rounded-lg transition-colors">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{msg.avatar}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{msg.user}</span>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-sm text-foreground mt-0.5">{msg.content}</p>
                {msg.attachment && (
                  <div className="mt-1.5 max-w-xs">
                    {msg.attachment.type === "image" && msg.attachment.url ? (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={msg.attachment.url}
                          alt={msg.attachment.name}
                          className="w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.attachment!.url, "_blank")}
                        />
                        <div className="flex items-center gap-2 p-2 bg-accent/50">
                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs truncate">{msg.attachment.name}</span>
                          <span className="text-[10px] text-muted-foreground">{msg.attachment.size}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-border">
                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{msg.attachment.name}</p>
                          <p className="text-[10px] text-muted-foreground">{msg.attachment.size}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {msg.reactions && (
                  <div className="flex gap-1 mt-1">
                    {msg.reactions.map((r, i) => (
                      <button key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-xs hover:bg-accent/80 transition-colors">
                        <span>{r.emoji}</span>
                        <span className="text-muted-foreground">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
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
            placeholder={`Escribe en #${info.name}...`}
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
            disabled={!message.trim() && !attachment}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
