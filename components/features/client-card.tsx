"use client";

import { MoreHorizontal, Mail, Phone, Briefcase, Eye, Edit, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Client } from "@/lib/data";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-primary",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-rose-500",
];

function getAvatarColor(id: string) {
  const index = parseInt(id.split("-")[1]) - 1;
  return avatarColors[index % avatarColors.length];
}

interface ClientCardProps {
  client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
  const { openModal, deleteClient } = useAppStore();
  const { addToast } = useToast();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteClient(client.id);
    addToast({ title: "Client deleted", type: "success" });
  };

  return (
    <Card
      className="p-5 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => openModal("client-detail", { clientId: client.id })}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar className={`h-12 w-12 ${getAvatarColor(client.id)}`}>
            <AvatarFallback className="text-white font-semibold">
              {client.avatar}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-foreground">{client.name}</h4>
            <p className="text-sm text-muted-foreground">{client.company}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openModal("client-detail", { clientId: client.id })}>
              <Eye className="h-4 w-4 mr-2" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          {client.email}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          {client.phone}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          {client.industry}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Projects</p>
          <p className="font-semibold text-foreground">{client.projectsCount}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total Spent</p>
          <p className="font-semibold text-foreground">
            {formatCurrency(client.totalSpent)}
          </p>
        </div>
        <Badge
          variant={client.status === "active" ? "success" : "secondary"}
          className="capitalize"
        >
          {client.status}
        </Badge>
      </div>
    </Card>
  );
}
