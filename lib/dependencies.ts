export type RelationType = "BLOCKS" | "BLOCKED_BY" | "RELATES_TO" | "DUPLICATES";

export interface TaskRelationData {
    id: string;
    type: RelationType;
    sourceTaskId: string;
    targetTaskId: string;
    sourceTask?: { id: string; title: string; status?: { name: string; color: string } | null };
    targetTask?: { id: string; title: string; status?: { name: string; color: string } | null };
}

const RELATION_LABELS: Record<RelationType, string> = {
    BLOCKS: "Bloquea a",
    BLOCKED_BY: "Bloqueada por",
    RELATES_TO: "Relacionada con",
    DUPLICATES: "Duplica",
};

export function getRelationLabel(type: RelationType): string {
    return RELATION_LABELS[type] || type;
}

/** Given a relation and the current task ID, returns the "other" task info */
export function getRelatedTask(
    rel: TaskRelationData,
    currentTaskId: string
): { id: string; title: string; status?: { name: string; color: string } | null } | null {
    if (rel.sourceTaskId === currentTaskId) {
        return rel.targetTask || null;
    }
    if (rel.targetTaskId === currentTaskId) {
        return rel.sourceTask || null;
    }
    return null;
}

/** Returns the effective relation type from the perspective of currentTaskId */
export function getEffectiveType(rel: TaskRelationData, currentTaskId: string): RelationType {
    // If this task is the source, the type applies as-is
    if (rel.sourceTaskId === currentTaskId) return rel.type;
    // If this task is the target, invert the type
    return getInverseType(rel.type);
}

/** Returns the inverse relation type for creating pairs */
export function getInverseType(type: RelationType): RelationType {
    switch (type) {
        case "BLOCKS": return "BLOCKED_BY";
        case "BLOCKED_BY": return "BLOCKS";
        case "RELATES_TO": return "RELATES_TO";
        case "DUPLICATES": return "DUPLICATES";
    }
}

/** Check if a task is blocked by looking at its BLOCKED_BY relations */
export function isTaskBlocked(
    relations: TaskRelationData[],
    taskId: string,
    completedStatusNames: string[]
): boolean {
    const lowerCompleted = completedStatusNames.map(n => n.toLowerCase());

    return relations.some(rel => {
        const effectiveType = getEffectiveType(rel, taskId);
        if (effectiveType !== "BLOCKED_BY") return false;

        // The blocking task is the "other" task
        const blockingTask = getRelatedTask(rel, taskId);
        if (!blockingTask?.status) return true; // If no status, assume still blocking
        return !lowerCompleted.includes(blockingTask.status.name.toLowerCase());
    });
}

/** Get titles of tasks that block this task */
export function getBlockingTaskTitles(
    relations: TaskRelationData[],
    taskId: string,
    completedStatusNames: string[]
): string[] {
    const lowerCompleted = completedStatusNames.map(n => n.toLowerCase());
    const titles: string[] = [];

    for (const rel of relations) {
        const effectiveType = getEffectiveType(rel, taskId);
        if (effectiveType !== "BLOCKED_BY") continue;

        const blockingTask = getRelatedTask(rel, taskId);
        if (!blockingTask) continue;
        if (blockingTask.status && lowerCompleted.includes(blockingTask.status.name.toLowerCase())) continue;
        titles.push(blockingTask.title);
    }

    return titles;
}

/** Group relations by effective type for display */
export function groupRelationsByType(
    relations: TaskRelationData[],
    currentTaskId: string
): Record<RelationType, Array<TaskRelationData & { relatedTask: NonNullable<ReturnType<typeof getRelatedTask>> }>> {
    const groups: Record<RelationType, Array<TaskRelationData & { relatedTask: NonNullable<ReturnType<typeof getRelatedTask>> }>> = {
        BLOCKS: [],
        BLOCKED_BY: [],
        RELATES_TO: [],
        DUPLICATES: [],
    };

    for (const rel of relations) {
        const effectiveType = getEffectiveType(rel, currentTaskId);
        const relatedTask = getRelatedTask(rel, currentTaskId);
        if (relatedTask) {
            groups[effectiveType].push({ ...rel, relatedTask });
        }
    }

    return groups;
}
