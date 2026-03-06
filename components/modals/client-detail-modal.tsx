"use client";

import { format } from "date-fns";
import {
  ExternalLink,
  Edit,
  Trash2,
  Mail,
  Phone,
  Building2,
  Calendar,
  DollarSign,
  FolderKanban,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, getStatusColor } from "@/lib/utils";

export function ClientDetailModal() {
  const {
    activeModal,
    modalData,
    closeModal,
    clients,
    projects,
    deleteClient,
    openModal,
  } = useAppStore();
  const { addToast } = useToast();

  const isOpen = activeModal === "client-detail";
  const client = clients.find((c) => c.id === modalData?.clientId);
  const clientProjects = projects.filter((p) => p.clientId === client?.id);

  if (!client) return null;

  const handleClose = () => {
    closeModal();
  };

  const handleDelete = () => {
    deleteClient(client.id);
    addToast({ title: "Client deleted", type: "success" });
    handleClose();
  };

  const handleOpenProject = (projectId: string) => {
    closeModal();
    openModal("project-detail", { projectId });
  };

  const totalRevenue = clientProjects.reduce((acc, p) => acc + p.spent, 0);
  const activeProjects = clientProjects.filter(
    (p) => p.status !== "delivered"
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {client.avatar}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {client.company}
                </h2>
                <Badge
                  className={
                    client.status === "active"
                      ? "bg-studio-success/20 text-studio-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {client.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{client.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Client
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-5 space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {clientProjects.length}
                </p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-semibold text-studio-success">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">Ingresos Totales</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-semibold text-studio-info">
                  {activeProjects}
                </p>
                <p className="text-xs text-muted-foreground">Proyectos Activos</p>
              </Card>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Correo</p>
                    <p className="text-sm font-medium text-foreground">
                      {client.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-info/20">
                    <Phone className="h-4 w-4 text-studio-info" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium text-foreground">
                      {client.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-warning/20">
                    <Building2 className="h-4 w-4 text-studio-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Industria</p>
                    <p className="text-sm font-medium text-foreground">
                      {client.industry}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-studio-success/20">
                    <Calendar className="h-4 w-4 text-studio-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Client Since</p>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(client.createdAt), "MMMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Projects */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Projects ({clientProjects.length})
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    closeModal();
                    openModal("new-project");
                  }}
                >
                  New Project
                </Button>
              </div>

              <div className="space-y-3">
                {clientProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="p-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleOpenProject(project.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-semibold"
                        style={{ backgroundColor: project.color }}
                      >
                        {project.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">
                            {project.name}
                          </p>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status.replace("-", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{project.progress}% complete</span>
                          <span>{formatCurrency(project.spent)} spent</span>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                ))}

                {clientProjects.length === 0 && (
                  <Card className="p-8 text-center">
                    <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No projects yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        closeModal();
                        openModal("new-project");
                      }}
                    >
                      Create First Project
                    </Button>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
