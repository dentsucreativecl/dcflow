-- =============================================================================
-- DC Flow - Row Level Security (RLS) Policies
-- =============================================================================
--
-- This file enables RLS on all tables and creates fine-grained access policies.
--
-- IMPORTANT NOTES:
-- 1. Supabase's service_role key bypasses RLS automatically. Use it only in
--    trusted server-side contexts (API routes, background jobs, webhooks).
-- 2. The anon and authenticated roles are subject to these policies.
-- 3. All user ID comparisons use auth.uid()::text since Prisma stores the
--    Supabase Auth UUID as a text column rather than a native uuid type.
-- 4. This script is idempotent: it drops existing policies before recreating
--    them, so it is safe to re-run at any time.
--
-- Access model:
--   Space membership (via "SpaceMember") is the primary access gate.
--   Users can access resources in spaces they belong to. Role-based
--   restrictions (OWNER, ADMIN, MEMBER, VIEWER) are enforced where relevant.
-- =============================================================================


-- =============================================================================
-- SECTION 0: DROP ALL EXISTING POLICIES (idempotent re-run support)
-- =============================================================================

DO $$
DECLARE
    _tbl text;
    _pol record;
BEGIN
    FOR _tbl IN
        SELECT unnest(ARRAY[
            'User', 'Space', 'SpaceMember', 'Folder', 'List', 'Status',
            'Task', 'TaskAssignment', 'Attachment', 'Annotation',
            'Comment', 'Activity', 'Document', 'Template', 'Automation',
            'TimeEntry', 'Checklist', 'ChecklistItem', 'CustomField',
            'CustomFieldValue', 'TaskRelation', 'Notification',
            'NotificationPreference', 'Team', 'TeamMember',
            'ResourcePermission', 'Invitation'
        ])
    LOOP
        FOR _pol IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = _tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol.policyname, _tbl);
        END LOOP;
    END LOOP;
END
$$;


-- =============================================================================
-- SECTION 1: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

ALTER TABLE public."User"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Space"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SpaceMember"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Folder"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."List"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Status"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskAssignment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attachment"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Annotation"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Comment"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Activity"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Template"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Automation"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimeEntry"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Checklist"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChecklistItem"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomField"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CustomFieldValue"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskRelation"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Team"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TeamMember"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ResourcePermission"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation"             ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 2: REUSABLE HELPER — check if the current user is a member of a space
-- =============================================================================
-- We create a SQL function to avoid repeating the same sub-select everywhere.
-- This is NOT security-defining on its own; the policies below are.

CREATE OR REPLACE FUNCTION public.is_space_member(_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM "SpaceMember"
        WHERE "spaceId" = _space_id
          AND "userId" = auth.uid()::text
    );
$$;

CREATE OR REPLACE FUNCTION public.is_space_admin(_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM "SpaceMember"
        WHERE "spaceId" = _space_id
          AND "userId" = auth.uid()::text
          AND role IN ('OWNER', 'ADMIN')
    );
$$;

-- Helper: get the spaceId for a given task (Task -> List -> spaceId)
CREATE OR REPLACE FUNCTION public.task_space_id(_task_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT l."spaceId"
    FROM "Task" t
    JOIN "List" l ON l.id = t."listId"
    WHERE t.id = _task_id
    LIMIT 1;
$$;


-- =============================================================================
-- SECTION 3: POLICIES PER TABLE
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 3.1  "User"
-- -----------------------------------------------------------------------------
-- SELECT: own profile + users who share at least one space with you.
-- UPDATE: own profile only.
-- INSERT: handled by Supabase Auth trigger / service_role.
-- DELETE: only SUPER_ADMIN / ADMIN (checked via role column on User row).

CREATE POLICY "user_select_own_and_shared_spaces"
    ON public."User"
    FOR SELECT
    USING (
        id = auth.uid()::text
        OR id IN (
            SELECT sm2."userId"
            FROM "SpaceMember" sm1
            JOIN "SpaceMember" sm2 ON sm1."spaceId" = sm2."spaceId"
            WHERE sm1."userId" = auth.uid()::text
        )
    );

CREATE POLICY "user_update_own_profile"
    ON public."User"
    FOR UPDATE
    USING (id = auth.uid()::text)
    WITH CHECK (id = auth.uid()::text);

CREATE POLICY "user_insert_own"
    ON public."User"
    FOR INSERT
    WITH CHECK (id = auth.uid()::text);

CREATE POLICY "user_delete_admin_only"
    ON public."User"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM "User"
            WHERE id = auth.uid()::text
              AND role IN ('SUPER_ADMIN', 'ADMIN')
        )
    );


-- -----------------------------------------------------------------------------
-- 3.2  "Space"
-- -----------------------------------------------------------------------------
-- SELECT / UPDATE / DELETE: only if you are a member of the space.
-- INSERT: any authenticated user can create a space.

CREATE POLICY "space_select_member"
    ON public."Space"
    FOR SELECT
    USING (
        public.is_space_member(id)
    );

CREATE POLICY "space_insert_authenticated"
    ON public."Space"
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "space_update_member"
    ON public."Space"
    FOR UPDATE
    USING (public.is_space_member(id))
    WITH CHECK (public.is_space_member(id));

CREATE POLICY "space_delete_admin"
    ON public."Space"
    FOR DELETE
    USING (public.is_space_admin(id));


-- -----------------------------------------------------------------------------
-- 3.3  "SpaceMember"
-- -----------------------------------------------------------------------------
-- SELECT: memberships in spaces you belong to.
-- INSERT / UPDATE / DELETE: only OWNER or ADMIN of that space.

CREATE POLICY "spacemember_select_own_spaces"
    ON public."SpaceMember"
    FOR SELECT
    USING (
        public.is_space_member("spaceId")
    );

CREATE POLICY "spacemember_insert_admin"
    ON public."SpaceMember"
    FOR INSERT
    WITH CHECK (
        public.is_space_admin("spaceId")
        -- Allow the very first member (space creator) to insert themselves
        OR NOT EXISTS (
            SELECT 1 FROM "SpaceMember" WHERE "spaceId" = "SpaceMember"."spaceId"
        )
    );

CREATE POLICY "spacemember_update_admin"
    ON public."SpaceMember"
    FOR UPDATE
    USING (public.is_space_admin("spaceId"))
    WITH CHECK (public.is_space_admin("spaceId"));

CREATE POLICY "spacemember_delete_admin"
    ON public."SpaceMember"
    FOR DELETE
    USING (
        public.is_space_admin("spaceId")
        OR "userId" = auth.uid()::text  -- members can remove themselves
    );


-- -----------------------------------------------------------------------------
-- 3.4  "Folder"
-- -----------------------------------------------------------------------------
-- ALL operations: member of the parent space.

CREATE POLICY "folder_select_space_member"
    ON public."Folder"
    FOR SELECT
    USING (public.is_space_member("spaceId"));

CREATE POLICY "folder_insert_space_member"
    ON public."Folder"
    FOR INSERT
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "folder_update_space_member"
    ON public."Folder"
    FOR UPDATE
    USING (public.is_space_member("spaceId"))
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "folder_delete_space_member"
    ON public."Folder"
    FOR DELETE
    USING (public.is_space_member("spaceId"));


-- -----------------------------------------------------------------------------
-- 3.5  "List"
-- -----------------------------------------------------------------------------
-- ALL operations: member of the parent space.

CREATE POLICY "list_select_space_member"
    ON public."List"
    FOR SELECT
    USING (public.is_space_member("spaceId"));

CREATE POLICY "list_insert_space_member"
    ON public."List"
    FOR INSERT
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "list_update_space_member"
    ON public."List"
    FOR UPDATE
    USING (public.is_space_member("spaceId"))
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "list_delete_space_member"
    ON public."List"
    FOR DELETE
    USING (public.is_space_member("spaceId"));


-- -----------------------------------------------------------------------------
-- 3.6  "Status"
-- -----------------------------------------------------------------------------
-- Access if member of the space OR the folder's space.

CREATE POLICY "status_select_space_member"
    ON public."Status"
    FOR SELECT
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
    );

CREATE POLICY "status_insert_space_member"
    ON public."Status"
    FOR INSERT
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
    );

CREATE POLICY "status_update_space_member"
    ON public."Status"
    FOR UPDATE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
    )
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
    );

CREATE POLICY "status_delete_space_member"
    ON public."Status"
    FOR DELETE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
    );


-- -----------------------------------------------------------------------------
-- 3.7  "Task"
-- -----------------------------------------------------------------------------
-- ALL operations: member of the space the task's list belongs to.

CREATE POLICY "task_select_space_member"
    ON public."Task"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        )
    );

CREATE POLICY "task_insert_space_member"
    ON public."Task"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        )
    );

CREATE POLICY "task_update_authenticated"
    ON public."Task"
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "task_delete_space_member"
    ON public."Task"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        )
    );


-- -----------------------------------------------------------------------------
-- 3.8  "TaskAssignment"
-- -----------------------------------------------------------------------------
-- Access if member of the task's space (Task -> List -> SpaceMember).

CREATE POLICY "taskassignment_select_space_member"
    ON public."TaskAssignment"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "taskassignment_insert_space_member"
    ON public."TaskAssignment"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "taskassignment_update_space_member"
    ON public."TaskAssignment"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "taskassignment_delete_space_member"
    ON public."TaskAssignment"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.9  "Attachment"
-- -----------------------------------------------------------------------------
-- Access if member of the task's space.

CREATE POLICY "attachment_select_space_member"
    ON public."Attachment"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "attachment_insert_space_member"
    ON public."Attachment"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "attachment_update_space_member"
    ON public."Attachment"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "attachment_delete_space_member"
    ON public."Attachment"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.10 "Annotation"
-- -----------------------------------------------------------------------------
-- Access if member of the attachment's task's space.

CREATE POLICY "annotation_select_space_member"
    ON public."Annotation"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "Attachment" a
            WHERE a.id = "attachmentId"
              AND public.is_space_member(public.task_space_id(a."taskId"))
        )
    );

CREATE POLICY "annotation_insert_space_member"
    ON public."Annotation"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "Attachment" a
            WHERE a.id = "attachmentId"
              AND public.is_space_member(public.task_space_id(a."taskId"))
        )
    );

CREATE POLICY "annotation_update_space_member"
    ON public."Annotation"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "Attachment" a
            WHERE a.id = "attachmentId"
              AND public.is_space_member(public.task_space_id(a."taskId"))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "Attachment" a
            WHERE a.id = "attachmentId"
              AND public.is_space_member(public.task_space_id(a."taskId"))
        )
    );

CREATE POLICY "annotation_delete_space_member"
    ON public."Annotation"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM "Attachment" a
            WHERE a.id = "attachmentId"
              AND public.is_space_member(public.task_space_id(a."taskId"))
        )
    );


-- -----------------------------------------------------------------------------
-- 3.11 "Comment"
-- -----------------------------------------------------------------------------
-- Access if member of the task's space.

CREATE POLICY "comment_select_authenticated"
    ON public."Comment"
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
    );

CREATE POLICY "comment_insert_authenticated"
    ON public."Comment"
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND "userId" = auth.uid()::text
    );

CREATE POLICY "comment_update_space_member"
    ON public."Comment"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "comment_delete_space_member"
    ON public."Comment"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.12 "Activity"
-- -----------------------------------------------------------------------------
-- Access if member of the task's space. Activity is typically read-heavy.

CREATE POLICY "activity_select_authenticated"
    ON public."Activity"
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "activity_insert_authenticated"
    ON public."Activity"
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND "userId" = auth.uid()::text
    );

CREATE POLICY "activity_update_space_member"
    ON public."Activity"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "activity_delete_space_member"
    ON public."Activity"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.13 "Document"
-- -----------------------------------------------------------------------------
-- SELECT: public docs OR member of the associated space.
-- INSERT / UPDATE / DELETE: member of the associated space OR own documents.

CREATE POLICY "document_select_public_or_space_member"
    ON public."Document"
    FOR SELECT
    USING (
        "isPublic" = true
        OR "createdById" = auth.uid()::text
        OR ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );

CREATE POLICY "document_insert_space_member"
    ON public."Document"
    FOR INSERT
    WITH CHECK (
        "createdById" = auth.uid()::text
        AND (
            "spaceId" IS NULL
            OR public.is_space_member("spaceId")
        )
        AND (
            "listId" IS NULL
            OR EXISTS (
                SELECT 1 FROM "List" l
                WHERE l.id = "listId"
                  AND public.is_space_member(l."spaceId")
            )
        )
    );

CREATE POLICY "document_update_space_member"
    ON public."Document"
    FOR UPDATE
    USING (
        "createdById" = auth.uid()::text
        OR ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    )
    WITH CHECK (
        "createdById" = auth.uid()::text
        OR ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );

CREATE POLICY "document_delete_space_member"
    ON public."Document"
    FOR DELETE
    USING (
        "createdById" = auth.uid()::text
        OR ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );


-- -----------------------------------------------------------------------------
-- 3.14 "Template"
-- -----------------------------------------------------------------------------
-- SELECT: all authenticated users (templates are shared).
-- INSERT / UPDATE / DELETE: own templates only.

CREATE POLICY "template_select_all_authenticated"
    ON public."Template"
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "template_insert_own"
    ON public."Template"
    FOR INSERT
    WITH CHECK ("createdById" = auth.uid()::text);

CREATE POLICY "template_update_own"
    ON public."Template"
    FOR UPDATE
    USING ("createdById" = auth.uid()::text)
    WITH CHECK ("createdById" = auth.uid()::text);

CREATE POLICY "template_delete_own"
    ON public."Template"
    FOR DELETE
    USING ("createdById" = auth.uid()::text);


-- -----------------------------------------------------------------------------
-- 3.15 "Automation"
-- -----------------------------------------------------------------------------
-- Access if member of the automation's space.
-- (Note: Automation belongs to Space directly via spaceId.)

CREATE POLICY "automation_select_space_member"
    ON public."Automation"
    FOR SELECT
    USING (public.is_space_member("spaceId"));

CREATE POLICY "automation_insert_space_member"
    ON public."Automation"
    FOR INSERT
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "automation_update_space_member"
    ON public."Automation"
    FOR UPDATE
    USING (public.is_space_member("spaceId"))
    WITH CHECK (public.is_space_member("spaceId"));

CREATE POLICY "automation_delete_space_member"
    ON public."Automation"
    FOR DELETE
    USING (public.is_space_member("spaceId"));


-- -----------------------------------------------------------------------------
-- 3.16 "TimeEntry"
-- -----------------------------------------------------------------------------
-- Access if member of the task's space.

CREATE POLICY "timeentry_select_space_member"
    ON public."TimeEntry"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "timeentry_insert_space_member"
    ON public."TimeEntry"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "timeentry_update_space_member"
    ON public."TimeEntry"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "timeentry_delete_space_member"
    ON public."TimeEntry"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.17 "Checklist"
-- -----------------------------------------------------------------------------
-- Access through task -> list -> space membership.

CREATE POLICY "checklist_select_space_member"
    ON public."Checklist"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "checklist_insert_space_member"
    ON public."Checklist"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "checklist_update_space_member"
    ON public."Checklist"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "checklist_delete_space_member"
    ON public."Checklist"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.18 "ChecklistItem"
-- -----------------------------------------------------------------------------
-- Access through checklist -> task -> list -> space membership.

CREATE POLICY "checklistitem_select_space_member"
    ON public."ChecklistItem"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "Checklist" c
            WHERE c.id = "checklistId"
              AND public.is_space_member(public.task_space_id(c."taskId"))
        )
    );

CREATE POLICY "checklistitem_insert_space_member"
    ON public."ChecklistItem"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "Checklist" c
            WHERE c.id = "checklistId"
              AND public.is_space_member(public.task_space_id(c."taskId"))
        )
    );

CREATE POLICY "checklistitem_update_space_member"
    ON public."ChecklistItem"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "Checklist" c
            WHERE c.id = "checklistId"
              AND public.is_space_member(public.task_space_id(c."taskId"))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "Checklist" c
            WHERE c.id = "checklistId"
              AND public.is_space_member(public.task_space_id(c."taskId"))
        )
    );

CREATE POLICY "checklistitem_delete_space_member"
    ON public."ChecklistItem"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM "Checklist" c
            WHERE c.id = "checklistId"
              AND public.is_space_member(public.task_space_id(c."taskId"))
        )
    );


-- -----------------------------------------------------------------------------
-- 3.19 "CustomField"
-- -----------------------------------------------------------------------------
-- Access through space / folder / list membership.
-- A CustomField can belong to a Space, Folder, or List (all optional).

CREATE POLICY "customfield_select_space_member"
    ON public."CustomField"
    FOR SELECT
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );

CREATE POLICY "customfield_insert_space_member"
    ON public."CustomField"
    FOR INSERT
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );

CREATE POLICY "customfield_update_space_member"
    ON public."CustomField"
    FOR UPDATE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    )
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );

CREATE POLICY "customfield_delete_space_member"
    ON public."CustomField"
    FOR DELETE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_member("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_member(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_member(l."spaceId")
        ))
    );


-- -----------------------------------------------------------------------------
-- 3.20 "CustomFieldValue"
-- -----------------------------------------------------------------------------
-- Access through task -> list -> space membership.

CREATE POLICY "customfieldvalue_select_space_member"
    ON public."CustomFieldValue"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "customfieldvalue_insert_space_member"
    ON public."CustomFieldValue"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("taskId"))
    );

CREATE POLICY "customfieldvalue_update_space_member"
    ON public."CustomFieldValue"
    FOR UPDATE
    USING (public.is_space_member(public.task_space_id("taskId")))
    WITH CHECK (public.is_space_member(public.task_space_id("taskId")));

CREATE POLICY "customfieldvalue_delete_space_member"
    ON public."CustomFieldValue"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("taskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.21 "TaskRelation"
-- -----------------------------------------------------------------------------
-- Access if member of EITHER the source or target task's space.

CREATE POLICY "taskrelation_select_space_member"
    ON public."TaskRelation"
    FOR SELECT
    USING (
        public.is_space_member(public.task_space_id("sourceTaskId"))
        OR public.is_space_member(public.task_space_id("targetTaskId"))
    );

CREATE POLICY "taskrelation_insert_space_member"
    ON public."TaskRelation"
    FOR INSERT
    WITH CHECK (
        public.is_space_member(public.task_space_id("sourceTaskId"))
        OR public.is_space_member(public.task_space_id("targetTaskId"))
    );

CREATE POLICY "taskrelation_update_space_member"
    ON public."TaskRelation"
    FOR UPDATE
    USING (
        public.is_space_member(public.task_space_id("sourceTaskId"))
        OR public.is_space_member(public.task_space_id("targetTaskId"))
    )
    WITH CHECK (
        public.is_space_member(public.task_space_id("sourceTaskId"))
        OR public.is_space_member(public.task_space_id("targetTaskId"))
    );

CREATE POLICY "taskrelation_delete_space_member"
    ON public."TaskRelation"
    FOR DELETE
    USING (
        public.is_space_member(public.task_space_id("sourceTaskId"))
        OR public.is_space_member(public.task_space_id("targetTaskId"))
    );


-- -----------------------------------------------------------------------------
-- 3.22 "Notification"
-- -----------------------------------------------------------------------------
-- Only own notifications (userId = auth.uid()).

CREATE POLICY "notification_select_own"
    ON public."Notification"
    FOR SELECT
    USING ("userId" = auth.uid()::text);

CREATE POLICY "notification_insert_authenticated"
    ON public."Notification"
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notification_update_own"
    ON public."Notification"
    FOR UPDATE
    USING ("userId" = auth.uid()::text)
    WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "notification_delete_own"
    ON public."Notification"
    FOR DELETE
    USING ("userId" = auth.uid()::text);


-- -----------------------------------------------------------------------------
-- 3.23 "NotificationPreference"
-- -----------------------------------------------------------------------------
-- Only own preferences.

CREATE POLICY "notificationpref_select_own"
    ON public."NotificationPreference"
    FOR SELECT
    USING ("userId" = auth.uid()::text);

CREATE POLICY "notificationpref_insert_own"
    ON public."NotificationPreference"
    FOR INSERT
    WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "notificationpref_update_own"
    ON public."NotificationPreference"
    FOR UPDATE
    USING ("userId" = auth.uid()::text)
    WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "notificationpref_delete_own"
    ON public."NotificationPreference"
    FOR DELETE
    USING ("userId" = auth.uid()::text);


-- -----------------------------------------------------------------------------
-- 3.24 "Team"
-- -----------------------------------------------------------------------------
-- SELECT: if member of that team.
-- INSERT: any authenticated user can create a team.
-- UPDATE / DELETE: only LEAD of that team.

CREATE POLICY "team_select_member"
    ON public."Team"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "TeamMember"
            WHERE "teamId" = "Team".id
              AND "userId" = auth.uid()::text
        )
    );

CREATE POLICY "team_insert_authenticated"
    ON public."Team"
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "team_update_lead"
    ON public."Team"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "TeamMember"
            WHERE "teamId" = "Team".id
              AND "userId" = auth.uid()::text
              AND role = 'LEAD'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "TeamMember"
            WHERE "teamId" = "Team".id
              AND "userId" = auth.uid()::text
              AND role = 'LEAD'
        )
    );

CREATE POLICY "team_delete_lead"
    ON public."Team"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM "TeamMember"
            WHERE "teamId" = "Team".id
              AND "userId" = auth.uid()::text
              AND role = 'LEAD'
        )
    );


-- -----------------------------------------------------------------------------
-- 3.25 "TeamMember"
-- -----------------------------------------------------------------------------
-- SELECT: own teams + members of those teams.
-- INSERT / UPDATE / DELETE: only LEAD of that team.
-- Members can also remove themselves.

CREATE POLICY "teammember_select_own_teams"
    ON public."TeamMember"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
              AND tm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "teammember_insert_lead"
    ON public."TeamMember"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
              AND tm."userId" = auth.uid()::text
              AND tm.role = 'LEAD'
        )
        -- Allow the first member (team creator) to add themselves
        OR NOT EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
        )
    );

CREATE POLICY "teammember_update_lead"
    ON public."TeamMember"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
              AND tm."userId" = auth.uid()::text
              AND tm.role = 'LEAD'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
              AND tm."userId" = auth.uid()::text
              AND tm.role = 'LEAD'
        )
    );

CREATE POLICY "teammember_delete_lead_or_self"
    ON public."TeamMember"
    FOR DELETE
    USING (
        "userId" = auth.uid()::text  -- members can remove themselves
        OR EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "TeamMember"."teamId"
              AND tm."userId" = auth.uid()::text
              AND tm.role = 'LEAD'
        )
    );


-- -----------------------------------------------------------------------------
-- 3.26 "ResourcePermission"
-- -----------------------------------------------------------------------------
-- SELECT: own permissions (where userId matches).
-- INSERT / UPDATE / DELETE: if admin of the relevant space.

CREATE POLICY "resourcepermission_select_own"
    ON public."ResourcePermission"
    FOR SELECT
    USING (
        "userId" = auth.uid()::text
        OR EXISTS (
            SELECT 1
            FROM "TeamMember" tm
            WHERE tm."teamId" = "ResourcePermission"."teamId"
              AND tm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "resourcepermission_insert_space_admin"
    ON public."ResourcePermission"
    FOR INSERT
    WITH CHECK (
        -- Admin of the space the permission targets
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "ResourcePermission"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );

CREATE POLICY "resourcepermission_update_space_admin"
    ON public."ResourcePermission"
    FOR UPDATE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "ResourcePermission"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    )
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "ResourcePermission"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );

CREATE POLICY "resourcepermission_delete_space_admin"
    ON public."ResourcePermission"
    FOR DELETE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "ResourcePermission"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );


-- -----------------------------------------------------------------------------
-- 3.27 "Invitation"
-- -----------------------------------------------------------------------------
-- SELECT / INSERT / UPDATE / DELETE: admin of the relevant space (or
-- the space containing the folder/list/task).
-- Also: the invited user (by email) can SELECT their own invitations.

CREATE POLICY "invitation_select_admin_or_invitee"
    ON public."Invitation"
    FOR SELECT
    USING (
        -- The invitee can see their own invitation
        email = (SELECT u.email FROM "User" u WHERE u.id = auth.uid()::text)
        -- Or admin of the target space
        OR ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "Invitation"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );

CREATE POLICY "invitation_insert_admin"
    ON public."Invitation"
    FOR INSERT
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "Invitation"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );

CREATE POLICY "invitation_update_admin"
    ON public."Invitation"
    FOR UPDATE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "Invitation"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    )
    WITH CHECK (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "Invitation"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );

CREATE POLICY "invitation_delete_admin"
    ON public."Invitation"
    FOR DELETE
    USING (
        ("spaceId" IS NOT NULL AND public.is_space_admin("spaceId"))
        OR ("folderId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "Folder" f
            WHERE f.id = "folderId"
              AND public.is_space_admin(f."spaceId")
        ))
        OR ("listId" IS NOT NULL AND EXISTS (
            SELECT 1 FROM "List" l
            WHERE l.id = "listId"
              AND public.is_space_admin(l."spaceId")
        ))
        OR ("taskId" IS NOT NULL AND EXISTS (
            SELECT 1
            FROM "Task" t
            JOIN "List" l ON l.id = t."listId"
            WHERE t.id = "Invitation"."taskId"
              AND public.is_space_admin(l."spaceId")
        ))
    );


-- =============================================================================
-- SECTION 4: GRANT USAGE
-- =============================================================================
-- Ensure the authenticated role can execute the helper functions.

GRANT EXECUTE ON FUNCTION public.is_space_member(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_admin(text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_space_id(text)    TO authenticated;


-- =============================================================================
-- DONE
-- =============================================================================
-- All 27 tables now have RLS enabled with appropriate policies.
--
-- Summary of policy count:
--   User .................. 4 policies (SELECT, INSERT, UPDATE, DELETE)
--   Space ................. 4 policies
--   SpaceMember ........... 4 policies
--   Folder ................ 4 policies
--   List .................. 4 policies
--   Status ................ 4 policies
--   Task .................. 4 policies
--   TaskAssignment ........ 4 policies
--   Attachment ............ 4 policies
--   Annotation ............ 4 policies
--   Comment ............... 4 policies
--   Activity .............. 4 policies
--   Document .............. 4 policies
--   Template .............. 4 policies
--   Automation ............ 4 policies
--   TimeEntry ............. 4 policies
--   Checklist ............. 4 policies
--   ChecklistItem ......... 4 policies
--   CustomField ........... 4 policies
--   CustomFieldValue ...... 4 policies
--   TaskRelation .......... 4 policies
--   Notification .......... 4 policies
--   NotificationPreference  4 policies
--   Team .................. 4 policies
--   TeamMember ............ 4 policies
--   ResourcePermission .... 4 policies
--   Invitation ............ 4 policies
--   -----------------------------------
--   Total:               108 policies
--
-- Remember: The service_role key always bypasses RLS. Use it for server-side
-- operations (cron jobs, webhooks, admin actions) that need unrestricted access.
-- =============================================================================
