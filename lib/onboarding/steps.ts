import type { OnboardingStep } from "./types";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── Dashboard ──
  {
    id: "dashboard",
    title: "Conoce tu Dashboard",
    description: "Vista general de tu actividad, tareas y métricas",
    icon: "LayoutDashboard",
    roles: ["admin", "member"],
    tourStops: [
      {
        targetId: "sidebar-home",
        title: "Navegación principal",
        description:
          "Desde el sidebar puedes acceder a todas las secciones de DC Flow. Los espacios de trabajo y canales aparecen organizados debajo.",
        route: "/dashboard",
        side: "right",
      },
      {
        targetId: "dashboard-stats",
        title: "Métricas rápidas",
        description:
          "Aquí verás un resumen de tus tareas pendientes, completadas y horas registradas.",
        route: "/dashboard",
        side: "bottom",
      },
    ],
  },

  // ── Clients (Admin/PM only) ──
  {
    id: "clients",
    title: "Gestiona Clientes",
    description: "Crea y administra las cuentas de clientes de la agencia",
    icon: "Building2",
    roles: ["admin"],
    tourStops: [
      {
        targetId: "sidebar-clients",
        title: "Sección Clientes",
        description:
          "Cada cliente es un espacio de trabajo. Dentro puedes organizar proyectos en carpetas y listas.",
        route: "/clients",
        side: "right",
      },
      {
        targetId: "clients-new-btn",
        title: "Nuevo Cliente",
        description:
          "Crea un nuevo cliente asignándole nombre, color y miembros del equipo.",
        route: "/clients",
        side: "bottom",
      },
    ],
    autoDetect: { table: "Space", filter: "exists" },
  },

  // ── Projects (Admin/PM only) ──
  {
    id: "projects",
    title: "Crea Proyectos",
    description: "Organiza el trabajo en proyectos dentro de cada cliente",
    icon: "FolderKanban",
    roles: ["admin"],
    tourStops: [
      {
        targetId: "sidebar-spaces-tree",
        title: "Árbol de espacios",
        description:
          "Aquí aparecen todos los clientes con sus carpetas y listas. Puedes expandir cada uno para navegar directamente.",
        side: "right",
      },
      {
        targetId: "sidebar-projects",
        title: "Todos los Proyectos",
        description:
          "Esta vista muestra todos los proyectos de la agencia. Puedes filtrar por cliente, estado y más.",
        route: "/projects",
        side: "right",
      },
    ],
    autoDetect: { table: "List", filter: "exists" },
  },

  // ── Tasks ──
  {
    id: "tasks",
    title: "Administra Tareas",
    description: "Crea, asigna y gestiona tareas con múltiples vistas",
    icon: "CheckSquare",
    roles: ["admin"],
    tourStops: [
      {
        targetId: "sidebar-tasks",
        title: "Todas las Tareas",
        description:
          "Vista global de todas las tareas de la agencia. Puedes cambiar entre vista de lista, kanban, calendario y timeline.",
        route: "/tasks",
        side: "right",
      },
      {
        targetId: "tasks-view-toggle",
        title: "Cambiar Vista",
        description:
          "Alterna entre lista, kanban, calendario y timeline según lo que necesites visualizar.",
        route: "/tasks",
        side: "bottom",
      },
    ],
    autoDetect: { table: "Task", filter: "owns" },
  },

  // ── My Tasks (Member) ──
  {
    id: "my-tasks",
    title: "Mis Tareas",
    description: "Revisa y gestiona las tareas asignadas a ti",
    icon: "ClipboardList",
    roles: ["member"],
    tourStops: [
      {
        targetId: "sidebar-my-tasks",
        title: "Mis Tareas",
        description:
          "Aquí encuentras todas las tareas que te han asignado. Puedes filtrar por proyecto, prioridad y estado.",
        route: "/my-tasks",
        side: "right",
      },
      {
        targetId: "my-tasks-filters",
        title: "Filtros",
        description:
          "Usa los filtros para enfocarte en lo que más importa: por fecha, prioridad o proyecto.",
        route: "/my-tasks",
        side: "bottom",
      },
    ],
    autoDetect: { table: "TaskAssignment", filter: "assigned" },
  },

  // ── Team (Admin/PM only) ──
  {
    id: "team",
    title: "Invita a tu Equipo",
    description: "Gestiona los miembros, roles y carga de trabajo",
    icon: "Users",
    roles: ["admin"],
    tourStops: [
      {
        targetId: "sidebar-team",
        title: "Equipo",
        description:
          "Visualiza todos los miembros de la agencia, sus roles y carga de trabajo actual.",
        route: "/team",
        side: "right",
      },
      {
        targetId: "team-invite-btn",
        title: "Invitar Miembros",
        description:
          "Invita nuevos miembros por email. Puedes asignarles un rol (Admin, PM, Member) y espacios de trabajo.",
        route: "/team",
        side: "bottom",
      },
    ],
    autoDetect: { table: "User", filter: "exists" },
  },

  // ── Time Tracking ──
  {
    id: "time-tracking",
    title: "Control de Tiempo",
    description: "Registra horas con el timer o manualmente",
    icon: "Clock",
    roles: ["admin", "member"],
    tourStops: [
      {
        targetId: "header-timer",
        title: "Timer Rápido",
        description:
          "Inicia el timer desde el header para registrar tiempo en cualquier tarea. Se mantiene activo mientras navegas.",
        side: "bottom",
      },
      {
        targetId: "sidebar-reports",
        title: "Reportes de Tiempo",
        description:
          "En reportes puedes ver el desglose de horas por persona, proyecto y período. También puedes exportar a CSV.",
        route: "/reports",
        side: "right",
      },
    ],
    autoDetect: { table: "TimeEntry", filter: "owns" },
  },

  // ── Channels ──
  {
    id: "channels",
    title: "Comunicación en Canales",
    description: "Mensajería en tiempo real con tu equipo",
    icon: "MessageSquare",
    roles: ["admin", "member"],
    tourStops: [
      {
        targetId: "sidebar-channels",
        title: "Canales",
        description:
          "Los canales permiten comunicación en tiempo real. Puedes crear canales por proyecto, equipo o tema.",
        route: "/channels",
        side: "right",
      },
    ],
    autoDetect: { table: "ChannelMember", filter: "assigned" },
  },

  // ── Reports (Admin/PM only) ──
  {
    id: "reports",
    title: "Reportes y Métricas",
    description: "Analiza horas, tareas y rendimiento del equipo",
    icon: "BarChart3",
    roles: ["admin"],
    tourStops: [
      {
        targetId: "sidebar-reports",
        title: "Reportes",
        description:
          "Accede a reportes detallados de horas, tareas, equipo y proyectos. Puedes filtrar por período y exportar.",
        route: "/reports",
        side: "right",
      },
    ],
  },

  // ── Settings ──
  {
    id: "settings",
    title: "Configuración",
    description: "Ajusta tu perfil, notificaciones y preferencias",
    icon: "Settings",
    roles: ["admin", "member"],
    tourStops: [
      {
        targetId: "sidebar-settings",
        title: "Configuración",
        description:
          "Desde aquí puedes actualizar tu nombre, foto de perfil, contraseña y preferencias de notificación.",
        route: "/settings",
        side: "right",
      },
    ],
  },
];

export function getStepsForRole(
  role: OnboardingRole
): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => step.roles.includes(role));
}
