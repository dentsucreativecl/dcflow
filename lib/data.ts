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

// Team Members
export const teamMembers: TeamMember[] = [
  {
    id: "tm-1",
    name: "John Doe",
    role: "Project Manager",
    email: "john@dcflow.com",
    avatar: "JD",
    department: "Management",
    hourlyRate: 85,
    hoursThisWeek: 32,
    capacity: 40,
    skills: ["Project Management", "Agile", "Client Relations"],
    status: "available",
  },
  {
    id: "tm-2",
    name: "Sarah Chen",
    role: "Lead Designer",
    email: "sarah@dcflow.com",
    avatar: "SC",
    department: "Design",
    hourlyRate: 95,
    hoursThisWeek: 38,
    capacity: 40,
    skills: ["UI Design", "Brand Design", "Figma", "Prototyping"],
    status: "busy",
  },
  {
    id: "tm-3",
    name: "Mike Johnson",
    role: "Senior Developer",
    email: "mike@dcflow.com",
    avatar: "MJ",
    department: "Development",
    hourlyRate: 100,
    hoursThisWeek: 42,
    capacity: 40,
    skills: ["React", "Node.js", "TypeScript", "AWS"],
    status: "busy",
  },
  {
    id: "tm-4",
    name: "Emily Davis",
    role: "UX Researcher",
    email: "emily@dcflow.com",
    avatar: "ED",
    department: "Design",
    hourlyRate: 80,
    hoursThisWeek: 28,
    capacity: 40,
    skills: ["User Research", "Usability Testing", "Analytics"],
    status: "available",
  },
  {
    id: "tm-5",
    name: "Alex Rivera",
    role: "Motion Designer",
    email: "alex@dcflow.com",
    avatar: "AR",
    department: "Design",
    hourlyRate: 90,
    hoursThisWeek: 35,
    capacity: 40,
    skills: ["After Effects", "Animation", "3D Motion"],
    status: "available",
  },
  {
    id: "tm-6",
    name: "Lisa Park",
    role: "Frontend Developer",
    email: "lisa@dcflow.com",
    avatar: "LP",
    department: "Development",
    hourlyRate: 85,
    hoursThisWeek: 40,
    capacity: 40,
    skills: ["React", "CSS", "Vue.js", "Animation"],
    status: "busy",
  },
  {
    id: "tm-7",
    name: "David Kim",
    role: "Brand Strategist",
    email: "david@dcflow.com",
    avatar: "DK",
    department: "Strategy",
    hourlyRate: 110,
    hoursThisWeek: 25,
    capacity: 40,
    skills: ["Brand Strategy", "Marketing", "Content"],
    status: "available",
  },
  {
    id: "tm-8",
    name: "Rachel Green",
    role: "Art Director",
    email: "rachel@dcflow.com",
    avatar: "RG",
    department: "Design",
    hourlyRate: 105,
    hoursThisWeek: 36,
    capacity: 40,
    skills: ["Art Direction", "Visual Design", "Typography"],
    status: "available",
  },
];

// Clients
export const clients: Client[] = [
  {
    id: "cl-1",
    name: "Robert Smith",
    company: "Acme Corp",
    email: "robert@acmecorp.com",
    phone: "+1 (555) 123-4567",
    avatar: "RS",
    industry: "Technology",
    projectsCount: 3,
    totalSpent: 125000,
    status: "active",
    createdAt: "2023-06-15",
  },
  {
    id: "cl-2",
    name: "Jennifer Lee",
    company: "TechCorp Inc",
    email: "jennifer@techcorp.com",
    phone: "+1 (555) 234-5678",
    avatar: "JL",
    industry: "Software",
    projectsCount: 2,
    totalSpent: 85000,
    status: "active",
    createdAt: "2023-08-20",
  },
  {
    id: "cl-3",
    name: "Michael Brown",
    company: "Nova Labs",
    email: "michael@novalabs.com",
    phone: "+1 (555) 345-6789",
    avatar: "MB",
    industry: "Biotech",
    projectsCount: 1,
    totalSpent: 78000,
    status: "active",
    createdAt: "2023-10-01",
  },
  {
    id: "cl-4",
    name: "Amanda White",
    company: "Zenith Co",
    email: "amanda@zenithco.com",
    phone: "+1 (555) 456-7890",
    avatar: "AW",
    industry: "Finance",
    projectsCount: 2,
    totalSpent: 110000,
    status: "active",
    createdAt: "2023-07-10",
  },
  {
    id: "cl-5",
    name: "Chris Martinez",
    company: "Stellar Media",
    email: "chris@stellarmedia.com",
    phone: "+1 (555) 567-8901",
    avatar: "CM",
    industry: "Entertainment",
    projectsCount: 4,
    totalSpent: 200000,
    status: "active",
    createdAt: "2023-03-22",
  },
  {
    id: "cl-6",
    name: "Diana Ross",
    company: "EcoVenture",
    email: "diana@ecoventure.com",
    phone: "+1 (555) 678-9012",
    avatar: "DR",
    industry: "Sustainability",
    projectsCount: 1,
    totalSpent: 45000,
    status: "inactive",
    createdAt: "2023-09-05",
  },
];

// Projects
export const projects: Project[] = [
  {
    id: "pj-1",
    name: "Acme Brand Refresh",
    client: "Acme Corp",
    clientId: "cl-1",
    status: "in-progress",
    progress: 70,
    dueDate: "2024-03-15",
    team: [teamMembers[1], teamMembers[7], teamMembers[6]],
    budget: 45000,
    spent: 31500,
    description: "Complete brand identity refresh including logo, guidelines, and collateral",
    color: "#4F46E5",
    tasks: [],
    createdAt: "2024-01-10",
  },
  {
    id: "pj-2",
    name: "TechCorp Website",
    client: "TechCorp Inc",
    clientId: "cl-2",
    status: "review",
    progress: 90,
    dueDate: "2024-03-18",
    team: [teamMembers[2], teamMembers[5], teamMembers[1]],
    budget: 32500,
    spent: 29250,
    description: "Responsive corporate website with custom CMS integration",
    color: "#059669",
    tasks: [],
    createdAt: "2024-01-05",
  },
  {
    id: "pj-3",
    name: "Nova App Design",
    client: "Nova Labs",
    clientId: "cl-3",
    status: "in-progress",
    progress: 50,
    dueDate: "2024-03-22",
    team: [teamMembers[1], teamMembers[3], teamMembers[4]],
    budget: 78000,
    spent: 39000,
    description: "Mobile app UI/UX design for their biotech platform",
    color: "#7C3AED",
    tasks: [],
    createdAt: "2024-01-15",
  },
  {
    id: "pj-4",
    name: "Zenith Marketing",
    client: "Zenith Co",
    clientId: "cl-4",
    status: "briefing",
    progress: 10,
    dueDate: "2024-04-01",
    team: [teamMembers[6], teamMembers[7]],
    budget: 55000,
    spent: 5500,
    description: "Q2 marketing campaign strategy and creative assets",
    color: "#DC2626",
    tasks: [],
    createdAt: "2024-02-01",
  },
  {
    id: "pj-5",
    name: "Stellar Video Series",
    client: "Stellar Media",
    clientId: "cl-5",
    status: "approved",
    progress: 95,
    dueDate: "2024-03-10",
    team: [teamMembers[4], teamMembers[7]],
    budget: 68000,
    spent: 64600,
    description: "5-part promotional video series with motion graphics",
    color: "#0891B2",
    tasks: [],
    createdAt: "2023-12-01",
  },
  {
    id: "pj-6",
    name: "EcoVenture Branding",
    client: "EcoVenture",
    clientId: "cl-6",
    status: "delivered",
    progress: 100,
    dueDate: "2024-02-28",
    team: [teamMembers[1], teamMembers[6]],
    budget: 45000,
    spent: 45000,
    description: "Sustainable brand identity and packaging design",
    color: "#16A34A",
    tasks: [],
    createdAt: "2023-11-15",
  },
];

// Tasks
export const tasks: Task[] = [
  {
    id: "tk-1",
    title: "Design homepage mockup",
    description: "Create high-fidelity mockup for the main landing page",
    status: "done",
    priority: "high",
    assignee: teamMembers[1],
    dueDate: "2024-03-05",
    projectId: "pj-2",
    createdAt: "2024-02-15",
    estimatedHours: 12,
    loggedHours: 14,
  },
  {
    id: "tk-2",
    title: "Implement navigation component",
    description: "Build responsive navigation with dropdown menus",
    status: "in-progress",
    priority: "high",
    assignee: teamMembers[5],
    dueDate: "2024-03-08",
    projectId: "pj-2",
    createdAt: "2024-02-20",
    estimatedHours: 8,
    loggedHours: 6,
  },
  {
    id: "tk-3",
    title: "Logo variations",
    description: "Create horizontal, vertical, and icon-only logo versions",
    status: "review",
    priority: "medium",
    assignee: teamMembers[1],
    dueDate: "2024-03-12",
    projectId: "pj-1",
    createdAt: "2024-02-10",
    estimatedHours: 16,
    loggedHours: 15,
    attachments: [{ id: "att-2", name: "logo-v3-final.jpg", url: "https://picsum.photos/seed/logo/400/200", type: "image/jpeg", size: 180000, uploadedAt: "2024-03-05", uploadedBy: "Sarah Chen" }],
  },
  {
    id: "tk-4",
    title: "User research interviews",
    description: "Conduct 8 user interviews for app feature validation",
    status: "in-progress",
    priority: "high",
    assignee: teamMembers[3],
    dueDate: "2024-03-15",
    projectId: "pj-3",
    createdAt: "2024-02-25",
    estimatedHours: 20,
    loggedHours: 12,
  },
  {
    id: "tk-5",
    title: "Brand guidelines document",
    description: "Compile comprehensive brand guidelines PDF",
    status: "todo",
    priority: "medium",
    assignee: teamMembers[7],
    dueDate: "2024-03-20",
    projectId: "pj-1",
    createdAt: "2024-03-01",
    estimatedHours: 24,
    loggedHours: 0,
    attachments: [{ id: "att-1", name: "brand-mockup.png", url: "https://picsum.photos/seed/brand/400/200", type: "image/png", size: 245000, uploadedAt: "2024-03-10", uploadedBy: "Rachel Green" }],
  },
  {
    id: "tk-6",
    title: "Motion storyboard",
    description: "Create storyboards for all 5 video episodes",
    status: "done",
    priority: "high",
    assignee: teamMembers[4],
    dueDate: "2024-02-28",
    projectId: "pj-5",
    createdAt: "2024-02-01",
    estimatedHours: 32,
    loggedHours: 35,
  },
  {
    id: "tk-7",
    title: "API integration",
    description: "Connect frontend to backend API endpoints",
    status: "todo",
    priority: "urgent",
    assignee: teamMembers[2],
    dueDate: "2024-03-10",
    projectId: "pj-2",
    createdAt: "2024-03-02",
    estimatedHours: 16,
    loggedHours: 0,
  },
  {
    id: "tk-8",
    title: "Client presentation deck",
    description: "Prepare strategy presentation for kickoff meeting",
    status: "in-progress",
    priority: "high",
    assignee: teamMembers[6],
    dueDate: "2024-03-08",
    projectId: "pj-4",
    createdAt: "2024-03-01",
    estimatedHours: 8,
    loggedHours: 4,
  },
];

// Recent Activity
export const recentActivity: Activity[] = [
  {
    id: "act-1",
    user: teamMembers[1],
    action: "completó",
    target: "Homepage design mockup",
    timestamp: "2024-03-03T14:30:00",
    type: "task",
  },
  {
    id: "act-2",
    user: teamMembers[2],
    action: "subió código a",
    target: "TechCorp Website",
    timestamp: "2024-03-03T13:15:00",
    type: "project",
  },
  {
    id: "act-3",
    user: teamMembers[7],
    action: "subió archivos a",
    target: "Acme Brand Refresh",
    timestamp: "2024-03-03T11:45:00",
    type: "file",
  },
  {
    id: "act-4",
    user: teamMembers[3],
    action: "comentó en",
    target: "User research findings",
    timestamp: "2024-03-03T10:20:00",
    type: "comment",
  },
  {
    id: "act-5",
    user: teamMembers[4],
    action: "submitted for review",
    target: "Video episode 3",
    timestamp: "2024-03-03T09:00:00",
    type: "task",
  },
];

// Milestones
export const milestones: Milestone[] = [
  {
    id: "ms-1",
    title: "Brand Strategy Approved",
    projectId: "pj-1",
    date: "2024-03-08",
    completed: true,
  },
  {
    id: "ms-2",
    title: "Logo Design Finalized",
    projectId: "pj-1",
    date: "2024-03-12",
    completed: false,
  },
  {
    id: "ms-3",
    title: "Website Beta Launch",
    projectId: "pj-2",
    date: "2024-03-15",
    completed: false,
  },
  {
    id: "ms-4",
    title: "User Testing Complete",
    projectId: "pj-3",
    date: "2024-03-18",
    completed: false,
  },
  {
    id: "ms-5",
    title: "Video Series Wrap",
    projectId: "pj-5",
    date: "2024-03-08",
    completed: true,
  },
];

// Calendar Events (meetings, etc.)
export const calendarEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "TechCorp Kickoff Meeting",
    description: "Project kickoff with client stakeholders",
    start: "2024-03-05T10:00:00",
    end: "2024-03-05T11:30:00",
    type: "meeting",
    projectId: "pj-2",
    allDay: false,
  },
  {
    id: "evt-2",
    title: "Design Review",
    description: "Internal design review for Acme brand",
    start: "2024-03-07T14:00:00",
    end: "2024-03-07T15:00:00",
    type: "meeting",
    projectId: "pj-1",
    allDay: false,
  },
  {
    id: "evt-3",
    title: "Sprint Planning",
    description: "Weekly sprint planning session",
    start: "2024-03-11T09:00:00",
    end: "2024-03-11T10:00:00",
    type: "meeting",
    allDay: false,
  },
  {
    id: "evt-4",
    title: "Client Presentation",
    description: "Present final video series to Stellar Media",
    start: "2024-03-09T15:00:00",
    end: "2024-03-09T16:30:00",
    type: "meeting",
    projectId: "pj-5",
    allDay: false,
  },
];

// Upcoming Deadlines
export const upcomingDeadlines: Deadline[] = [
  {
    id: "dl-1",
    title: "TechCorp Website Launch",
    project: "TechCorp Website",
    dueDate: "2024-03-18",
    priority: "high",
  },
  {
    id: "dl-2",
    title: "Brand Guidelines Delivery",
    project: "Acme Brand Refresh",
    dueDate: "2024-03-15",
    priority: "high",
  },
  {
    id: "dl-3",
    title: "App Prototype Review",
    project: "Nova App Design",
    dueDate: "2024-03-22",
    priority: "medium",
  },
  {
    id: "dl-4",
    title: "Campaign Strategy Presentation",
    project: "Zenith Marketing",
    dueDate: "2024-04-01",
    priority: "medium",
  },
];

// Dashboard Stats
export const dashboardStats = {
  activeProjects: 24,
  activeProjectsChange: 12,
  pendingTasks: 156,
  pendingTasksChange: -8,
  teamUtilization: 87,
  teamUtilizationChange: 5,
  weeklyHours: 278, // 8 team members, avg ~35hrs each
  weeklyCapacity: 320, // 8 team members x 40 hours max
};

// Hours breakdown for the week
export const hoursBreakdown = {
  logged: 32,
  target: 40,
  billable: 28,
  nonBillable: 4,
  byProject: [
    { project: "TechCorp Website", hours: 14 },
    { project: "Acme Brand Refresh", hours: 10 },
    { project: "Nova App Design", hours: 8 },
  ],
};

// Reports data
export const reportsData = {
  revenue: {
    current: 245000,
    previous: 198000,
    change: 23.7,
  },
  hoursTracked: {
    current: 1248,
    previous: 1150,
    change: 8.5,
  },
  projectsCompleted: {
    current: 12,
    previous: 9,
    change: 33.3,
  },
  clientSatisfaction: {
    current: 4.8,
    previous: 4.6,
    change: 4.3,
  },
  monthlyRevenue: [
    { month: "Jan", revenue: 42000, hours: 180 },
    { month: "Feb", revenue: 48000, hours: 195 },
    { month: "Mar", revenue: 55000, hours: 220 },
    { month: "Apr", revenue: 51000, hours: 205 },
    { month: "May", revenue: 62000, hours: 248 },
    { month: "Jun", revenue: 58000, hours: 232 },
  ],
  projectsByStatus: [
    { status: "In Progress", count: 8, color: "#3B82F6" },
    { status: "Review", count: 4, color: "#F59E0B" },
    { status: "Completed", count: 12, color: "#22C55E" },
  ],
  teamPerformance: teamMembers.slice(0, 6).map((member) => ({
    name: member.name.split(" ")[0],
    hours: member.hoursThisWeek,
    utilization: Math.round((member.hoursThisWeek / member.capacity) * 100),
  })),
};
