import jsPDF from "jspdf";
import { Project, Client, Task, TeamMember } from "@/lib/data";

export function exportProjectsToPDF(projects: Project[]) {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Projects Report", 20, 20);

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

    // Projects
    let y = 45;
    doc.setFontSize(12);

    projects.forEach((project, index) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. ${project.name}`, 20, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Client: ${project.client}`, 25, y);
        y += 5;
        doc.text(`Status: ${project.status}`, 25, y);
        y += 5;
        doc.text(`Progress: ${project.progress}%`, 25, y);
        y += 5;
        doc.text(`Budget: $${project.budget.toLocaleString()} | Spent: $${project.spent.toLocaleString()}`, 25, y);
        y += 5;
        doc.text(`Due Date: ${project.dueDate}`, 25, y);
        y += 10;

        doc.setFontSize(12);
    });

    doc.save(`projects-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportProjectsToCSV(projects: Project[]) {
    const headers = ["Name", "Client", "Status", "Progress", "Budget", "Spent", "Due Date", "Team Size"];
    const rows = projects.map(p => [
        p.name,
        p.client,
        p.status,
        `${p.progress}%`,
        p.budget,
        p.spent,
        p.dueDate,
        p.team.length
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `projects-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export async function exportProjectsToExcel(projects: Project[]) {
    const XLSX = await import("xlsx");

    const data = projects.map(p => ({
        "Project Name": p.name,
        "Client": p.client,
        "Status": p.status,
        "Progress": `${p.progress}%`,
        "Budget": p.budget,
        "Spent": p.spent,
        "Remaining": p.budget - p.spent,
        "Due Date": p.dueDate,
        "Team Size": p.team.length,
        "Tasks": p.tasks.length,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");

    XLSX.writeFile(workbook, `projects-${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportTasksToCSV(tasks: Task[], projects: Project[]) {
    const headers = ["Title", "Project", "Status", "Priority", "Assignee", "Due Date", "Estimated Hours", "Logged Hours"];
    const rows = tasks.map(t => {
        const project = projects.find(p => p.id === t.projectId);
        return [
            t.title,
            project?.name || "N/A",
            t.status,
            t.priority,
            t.assignee?.name || "Unassigned",
            t.dueDate,
            t.estimatedHours,
            t.loggedHours
        ];
    });

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportTeamToCSV(teamMembers: TeamMember[]) {
    const headers = ["Name", "Role", "Department", "Email", "Hourly Rate", "Hours This Week", "Capacity", "Utilization", "Status"];
    const rows = teamMembers.map(m => [
        m.name,
        m.role,
        m.department,
        m.email,
        m.hourlyRate,
        m.hoursThisWeek,
        m.capacity,
        `${Math.round((m.hoursThisWeek / m.capacity) * 100)}%`,
        m.status
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `team-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
