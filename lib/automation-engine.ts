import { createClient } from "@/lib/supabase/client";

export interface AutomationRule {
    id: string;
    name: string;
    trigger: string;
    triggerValue: string | null;
    action: string;
    actionValue: string | null;
    isActive: boolean;
}

interface RunAutomationsParams {
    spaceId: string;
    trigger: string;
    taskId: string;
    userId: string;
    context?: { oldValue?: string; newValue?: string };
}

interface RunAutomationsResult {
    executed: string[];
    errors: string[];
}

const ACTIVITY_TYPE_MAP: Record<string, string> = {
    CHANGE_STATUS: "STATUS_CHANGED",
    CHANGE_PRIORITY: "PRIORITY_CHANGED",
    ADD_ASSIGNEE: "ASSIGNED",
    REMOVE_ASSIGNEE: "UNASSIGNED",
    ADD_COMMENT: "COMMENT_ADDED",
};

/** Fetch and execute all applicable automation rules for a trigger */
export async function runAutomations(params: RunAutomationsParams): Promise<RunAutomationsResult> {
    const { spaceId, trigger, taskId, userId, context } = params;
    const supabase = createClient();
    const result: RunAutomationsResult = { executed: [], errors: [] };

    try {
        // Fetch active automations for this space and trigger
        let query = supabase
            .from("Automation")
            .select("id, name, trigger, triggerValue, action, actionValue, isActive")
            .eq("spaceId", spaceId)
            .eq("trigger", trigger)
            .eq("isActive", true);

        const { data: rules, error } = await query;
        if (error || !rules) return result;

        for (const rule of rules) {
            // Check triggerValue match (if specified)
            if (rule.triggerValue && context?.newValue && rule.triggerValue !== context.newValue) {
                continue;
            }

            try {
                await executeAction(rule as AutomationRule, taskId, userId);
                result.executed.push(rule.name);
            } catch (err) {
                result.errors.push(`${rule.name}: ${err instanceof Error ? err.message : "Error"}`);
            }
        }
    } catch {
        // Silent fail - automations should not block the main operation
    }

    return result;
}

async function executeAction(rule: AutomationRule, taskId: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { action, actionValue } = rule;

    if (!actionValue) return;

    switch (action) {
        case "CHANGE_STATUS": {
            const { error } = await supabase
                .from("Task")
                .update({ statusId: actionValue })
                .eq("id", taskId);
            if (error) throw error;
            break;
        }

        case "CHANGE_PRIORITY": {
            const { error } = await supabase
                .from("Task")
                .update({ priority: actionValue })
                .eq("id", taskId);
            if (error) throw error;
            break;
        }

        case "ADD_ASSIGNEE": {
            const { error } = await supabase
                .from("TaskAssignment")
                .upsert(
                    { taskId, userId: actionValue },
                    { onConflict: "taskId,userId" }
                );
            if (error) throw error;
            break;
        }

        case "REMOVE_ASSIGNEE": {
            const { error } = await supabase
                .from("TaskAssignment")
                .delete()
                .eq("taskId", taskId)
                .eq("userId", actionValue);
            if (error) throw error;
            break;
        }

        case "SEND_NOTIFICATION": {
            const { error } = await supabase
                .from("Notification")
                .insert({
                    id: crypto.randomUUID(),
                    type: "STATUS_CHANGED",
                    userId: actionValue,
                    taskId,
                    title: `Automatización: ${rule.name}`,
                    message: `Se ejecutó la automatización "${rule.name}"`,
                    createdAt: new Date().toISOString(),
                });
            if (error) throw error;
            break;
        }

        case "MOVE_TO_LIST": {
            const { error } = await supabase
                .from("Task")
                .update({ listId: actionValue })
                .eq("id", taskId);
            if (error) throw error;
            break;
        }

        case "ADD_COMMENT": {
            const now = new Date().toISOString();
            const { error } = await supabase
                .from("Comment")
                .insert({
                    id: crypto.randomUUID(),
                    taskId,
                    content: actionValue,
                    userId,
                    createdAt: now,
                    updatedAt: now,
                });
            if (error) throw error;
            break;
        }

        default:
            return;
    }

    // Log activity for the action
    const activityType = ACTIVITY_TYPE_MAP[action];
    if (activityType) {
        await supabase.from("Activity").insert({
            id: crypto.randomUUID(),
            taskId,
            userId,
            type: activityType,
            field: `auto:${rule.name}`,
            newValue: actionValue,
            createdAt: new Date().toISOString(),
        }).then(() => {}); // fire and forget
    }
}
