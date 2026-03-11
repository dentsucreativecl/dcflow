"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { Role, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/auth/roles";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PurgeDataCard } from "@/components/features/purge-data-card";
import { CsvImportCard } from "@/components/features/csv-import-card";
import { OutlookIntegration } from "@/components/features/outlook-integration";
import { AreaManagementCard } from "@/components/features/area-management-card";
import { Shield, User, Briefcase, Users2, Camera, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { getGendered } from "@/lib/utils/gender";

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
  const { user, loading, isAdmin, isSuperAdmin: isSA, setUser } = useAuth();
  const { addToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingGender, setSavingGender] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("FILE INPUT CHANGE", file?.name, "user:", user?.id);
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;
      const { error: dbErr } = await supabase.from('User').update({ avatarUrl }).eq('id', user.id);
      if (dbErr) throw dbErr;
      setUser({ ...user, avatarUrl });
      addToast({ title: 'Foto actualizada', type: 'success' });
    } catch (err) {
      console.error('Avatar upload error:', err);
      addToast({ title: 'Error al subir foto', description: err instanceof Error ? err.message : String(err), type: 'error' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleGenderChange = async (gender: string) => {
    if (!user) return;
    setSavingGender(true);
    try {
      const supabase = createClient();
      await supabase.from('User').update({ gender }).eq('id', user.id);
      setUser({ ...user, gender });
    } finally {
      setSavingGender(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const isSuperAdmin = user.supabaseRole === 'SUPER_ADMIN';
  const canManageSettings = isAdmin || isSA;
  const RoleIcon = isSuperAdmin ? Shield : roleIcons[user.role];
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-[#F2A6A6] to-[#17385C] flex items-center justify-center text-white text-xl font-semibold">
                  {user.avatarUrl
                    ? <Image src={user.avatarUrl} alt={user.name} width={64} height={64} className="object-cover w-full h-full" />
                    : initials}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => { console.log("AVATAR BTN CLICK, ref:", avatarInputRef.current); avatarInputRef.current?.click(); }} disabled={uploadingAvatar}>
                  {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  Cambiar foto
                </Button>
              </div>
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
            <div>
              <Label className="text-muted-foreground">Cargo en género</Label>
              <Select value={user.gender || 'MASCULINE'} onValueChange={handleGenderChange} disabled={savingGender}>
                <SelectTrigger className="w-44 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MASCULINE">Masculino</SelectItem>
                  <SelectItem value="FEMININE">Femenino</SelectItem>
                  <SelectItem value="NEUTRAL">Neutro</SelectItem>
                </SelectContent>
              </Select>
              {user.department && (
                <p className="text-xs text-muted-foreground mt-1">
                  Se mostrará como: <span className="font-medium">{getGendered(user.department, user.gender || 'MASCULINE')}</span>
                </p>
              )}
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

      {canManageSettings && (
        <Card className="p-6 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Configuración de Plataforma
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona usuarios, clientes, proyectos y canales desde el Panel de Administración.
              </p>
            </div>
            <a
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              Panel de Administración
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Card>
      )}

      {canManageSettings && <AreaManagementCard />}

      {canManageSettings && <PurgeDataCard />}

      {canManageSettings && <CsvImportCard />}

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