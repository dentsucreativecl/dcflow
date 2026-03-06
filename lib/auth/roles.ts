export type Role = 'admin' | 'pm' | 'member' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  department?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  pm: 'Gerente de Proyecto',
  member: 'Miembro del Equipo',
  client: 'Cliente',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Acceso completo a todas las funciones y configuraciones',
  pm: 'Gestionar proyectos, equipos y ver reportes',
  member: 'Ver tareas y proyectos asignados',
  client: 'Ver sus proyectos y dar feedback',
};