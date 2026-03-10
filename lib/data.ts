export interface Project {
  id: string;
  name: string;
  client: string;
  clientId: string;
  status: "briefing" | "in-progress" | "review" | "approved" | "delivered";
  progress: number;
  dueDate: string;
  team: TeamMember[];
  budget: number;
  spent: number;
  description: string;
  color: string;
  tasks: Task[];
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  avatar: string;
  industry: string;
  projectsCount: number;
  totalSpent: number;
  status: "active" | "inactive";
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
  department: string;
  hourlyRate: number;
  hoursThisWeek: number;
  capacity: number;
  skills: string[];
  status: "available" | "busy" | "away";
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee: TeamMember | null;
  dueDate: string;
  projectId: string;
  createdAt: string;
  estimatedHours: number;
  loggedHours: number;
  attachments?: TaskAttachment[];
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Activity {
  id: string;
  user: TeamMember;
  action: string;
  target: string;
  timestamp: string;
  type: "task" | "project" | "comment" | "file";
}

export interface Deadline {
  id: string;
  title: string;
  project: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  type: "task" | "deadline" | "milestone" | "meeting";
  projectId?: string;
  assigneeId?: string;
  allDay: boolean;
  color?: string;
}

export interface Milestone {
  id: string;
  title: string;
  projectId: string;
  date: string;
  completed: boolean;
}
