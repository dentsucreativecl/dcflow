"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Project,
  Client,
  TeamMember,
  Task,
  CalendarEvent,
  Milestone,
} from "./data";

// Modal types
export type ModalType =
  | "new-project"
  | "new-client"
  | "new-task-v2"
  | "new-member"
  | "new-event"
  | "log-time"
  | "project-detail"
  | "client-detail"
  | "task-detail-v2"
  | "event-detail"
  | "confirm-delete"
  | "bulk-import"
  | "bulk-status-change"
  | "bulk-assign"
  | "new-channel"
  | null;

interface ModalData {
  projectId?: string;
  clientId?: string;
  taskId?: string;
  memberId?: string;
  eventId?: string;
  statusId?: string;
  selectedDate?: Date;
  selectedSlot?: { start: Date; end: Date };
  onConfirm?: () => void;
  title?: string;
  message?: string;
  taskIds?: string[];
  statuses?: Array<{ id: string; name: string; color: string }>;
}

// App Store
interface AppState {
  // Data
  projects: Project[];
  clients: Client[];
  teamMembers: TeamMember[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  milestones: Milestone[];
  activeTimer: { entryId?: string; startTime: Date; taskId: string; taskTitle: string } | null;



  // UI State
  sidebarCollapsed: boolean;
  activeModal: ModalType;
  modalData: ModalData | null;

  // Actions - Data
  addProject: (project: Omit<Project, "id" | "createdAt">) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  addClient: (client: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addTask: (task: Omit<Task, "id" | "createdAt">) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: Task["status"]) => void;

  addTeamMember: (member: Omit<TeamMember, "id">) => void;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => void;
  deleteTeamMember: (id: string) => void;

  addCalendarEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateCalendarEvent: (id: string, data: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;

  addMilestone: (milestone: Omit<Milestone, "id">) => void;
  updateMilestone: (id: string, data: Partial<Milestone>) => void;
  deleteMilestone: (id: string) => void;


  // Actions - Time
  setActiveTimer: (timer: { startTime: Date; taskId: string; taskTitle: string } | null) => void;


  // Actions - UI
  toggleSidebar: () => void;
  openModal: (type: ModalType, data?: ModalData) => void;
  closeModal: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial Data
      projects: [],
      clients: [],
      teamMembers: [],
      tasks: [],
      calendarEvents: [],
      milestones: [],
      activeTimer: null,

      // Initial UI State
      sidebarCollapsed: false,
      activeModal: null,
      modalData: null,
      searchOpen: false,

      // Project Actions
      addProject: (projectData) => {
        const newProject: Project = {
          ...projectData,
          id: `pj-${Date.now()}`,
          createdAt: new Date().toISOString().split("T")[0],
        };
        set((state) => ({
          projects: [...state.projects, newProject],
        }));
      },

      updateProject: (id, data) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      },

      // Client Actions
      addClient: (clientData) => {
        const newClient: Client = {
          ...clientData,
          id: `cl-${Date.now()}`,
          createdAt: new Date().toISOString().split("T")[0],
        };
        set((state) => ({
          clients: [...state.clients, newClient],
        }));
      },

      updateClient: (id, data) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...data } : c
          ),
        }));
      },

      deleteClient: (id) => {
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
        }));
      },

      // Task Actions
      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: `tk-${Date.now()}`,
          createdAt: new Date().toISOString().split("T")[0],
        };
        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));
      },

      updateTask: (id, data) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
        }));
      },

      moveTask: (taskId, newStatus) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        }));
      },

      // Team Member Actions
      addTeamMember: (memberData) => {
        const newMember: TeamMember = {
          ...memberData,
          id: `tm-${Date.now()}`,
        };
        set((state) => ({
          teamMembers: [...state.teamMembers, newMember],
        }));
      },

      updateTeamMember: (id, data) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((m) =>
            m.id === id ? { ...m, ...data } : m
          ),
        }));
      },

      deleteTeamMember: (id) => {
        set((state) => ({
          teamMembers: state.teamMembers.filter((m) => m.id !== id),
        }));
      },

      // Calendar Event Actions
      addCalendarEvent: (eventData) => {
        const newEvent: CalendarEvent = {
          ...eventData,
          id: `evt-${Date.now()}`,
        };
        set((state) => ({
          calendarEvents: [...state.calendarEvents, newEvent],
        }));
      },

      updateCalendarEvent: (id, data) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }));
      },

      deleteCalendarEvent: (id) => {
        set((state) => ({
          calendarEvents: state.calendarEvents.filter((e) => e.id !== id),
        }));
      },

      // Milestone Actions
      addMilestone: (milestoneData) => {
        const newMilestone: Milestone = {
          ...milestoneData,
          id: `ms-${Date.now()}`,
        };
        set((state) => ({
          milestones: [...state.milestones, newMilestone],
        }));
      },

      updateMilestone: (id, data) => {
        set((state) => ({
          milestones: state.milestones.map((m) =>
            m.id === id ? { ...m, ...data } : m
          ),
        }));
      },

      deleteMilestone: (id) => {
        set((state) => ({
          milestones: state.milestones.filter((m) => m.id !== id),
        }));
      },

      setActiveTimer: (timer) => set({ activeTimer: timer }),


      // UI Actions
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      openModal: (type, data) => {
        set({ activeModal: type, modalData: data || null });
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null });
      },

      openSearch: () => set({ searchOpen: true }),
      closeSearch: () => set({ searchOpen: false }),
    }),
    {
      name: "dc-flow-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
