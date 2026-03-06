export interface StatusOption {
    id: string;
    name: string;
    color: string;
}

export interface CustomFieldColumn {
    id: string;
    name: string;
    type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX" | "URL";
    options?: string[] | null;
}

export interface ListTask {
    id: string;
    title: string;
    description: string | null;
    priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NORMAL" | "NONE";
    dueDate: string | null;
    estimatedHours: number | null;
    status: StatusOption | null;
    assignments: Array<{
        user: {
            id: string;
            name: string;
            avatarUrl: string | null;
        };
    }>;
    subtasks?: Array<{
        id: string;
        title: string;
        dueDate?: string | null;
        startDate?: string | null;
        status: { id: string; name: string; color: string } | null;
    }>;
    _count?: {
        comments: number;
        attachments: number;
        subtasks: number;
    };
    customFieldValues?: Record<string, {
        textValue?: string | null;
        numberValue?: number | null;
        dateValue?: string | null;
        selectValue?: string | null;
        checkboxValue?: boolean | null;
    }>;
    isBlocked?: boolean;
    blockedByTitles?: string[];
}
