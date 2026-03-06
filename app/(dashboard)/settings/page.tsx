"use client";



import { useAuth } from "@/contexts/auth-context";
import { Role, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PurgeDataCard } from "@/components/features/purge-data-card";
import { CsvImportCard } from "@/components/features/csv-import-card";
import { OutlookIntegration } from "@/components/features/outlook-integration";
import { AreaManagementCard } from "@/components/features/area-management-card";
import { Shield, User, Briefcase, Users2 } from "lucide-react";

const roleIcons: Record<Role, any> = {
  admin: Shield,
  pm: Briefcase,
  member: User,
  client: Users2,
};

const roleColors: Record<Role, string> = {
  admin: "bg-studio-error/20 text-studio-error",
  pm: "bg-primary/20 text-primary",
  member: "bg-studio-info/20 text-studio-info",
  client: "bg-studio-success/20 text-studio-success",
};
export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const isSuperAdmin = user.supabaseRole === 'SUPER_ADMIN';
  const RoleIcon = isSuperAdmin ? Shield : roleIcons[user.role];

  return (
    <div className="flex h-full flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Perfil</h2>
        <p className="text-muted-foreground">
          Administra tu cuenta y preferencias
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Información del Usuario */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Información del Usuario</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nombre</Label>
              <p className="text-foreground font-medium">{user.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Correo</Label>
              <p className="text-foreground font-medium">{user.email}</p>
            </div>
            {user.department && (
              <div>
                <Label className="text-muted-foreground">Departamento</Label>
                <p className="text-foreground font-medium">{user.department}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Rol Actual</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={isSuperAdmin ? "bg-purple-500/20 text-purple-600" : roleColors[user.role]}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {isSuperAdmin ? "Super Admin" : ROLE_LABELS[user.role]}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
        {/* Información del Rol */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-2">
            Tu Rol
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {ROLE_DESCRIPTIONS[user.role]}
          </p>

          <div className="space-y-3">
            {(Object.keys(ROLE_LABELS) as Role[]).map((role) => {
              const Icon = roleIcons[role];
              return (
                <div
                  key={role}
                  className={`rounded-lg border p-3 transition-colors ${
                    user.role === role
                      ? "border-primary bg-primary/5"
                      : "border-border opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {ROLE_LABELS[role]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      {/* Información de Permisos */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2">
          Permisos Actuales
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Basado en tu rol actual: <strong>{ROLE_LABELS[user.role]}</strong>
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {user.role === "admin" && (
            <>
              <PermissionBadge text="Acceso Total al Sistema" />
              <PermissionBadge text="Gestionar Usuarios" />
              <PermissionBadge text="Acciones Masivas" />
              <PermissionBadge text="Ver Todos los Proyectos" />
              <PermissionBadge text="Gestionar Equipo" />
              <PermissionBadge text="Exportar Reportes" />
            </>
          )}
          {user.role === "pm" && (
            <>
              <PermissionBadge text="Ver Todos los Proyectos" />
              <PermissionBadge text="Crear Proyectos" />
              <PermissionBadge text="Gestionar Equipo" />
              <PermissionBadge text="Ver Reportes" />
              <PermissionBadge text="Gestionar Clientes" />
              <PermissionBadge text="Ver Carga de Trabajo" />
            </>
          )}
          {user.role === "member" && (
            <>
              <PermissionBadge text="Ver Proyectos Asignados" />
              <PermissionBadge text="Ver Tareas Asignadas" />
              <PermissionBadge text="Registrar Tiempo" />
              <PermissionBadge text="Editar Perfil" />
            </>
          )}
          {user.role === "client" && (
            <>
              <PermissionBadge text="Ver Proyectos Propios" />
              <PermissionBadge text="Aprobar Entregables" />
              <PermissionBadge text="Enviar Feedback" />
              <PermissionBadge text="Editar Perfil" />
            </>
          )}
        </div>
      </Card>

      {user.role === "admin" && <AreaManagementCard />}

      {user.role === "admin" && <PurgeDataCard />}

      {user.role === "admin" && <CsvImportCard />}

      <OutlookIntegration tasks={[]} />
    </div>
  );
}

function PermissionBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2">
      <div className="h-1.5 w-1.5 rounded-full bg-studio-success" />
      <span className="text-sm text-foreground">{text}</span>
    </div>
  );
}