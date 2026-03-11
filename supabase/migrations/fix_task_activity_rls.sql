-- Fix RLS: Task UPDATE and Activity INSERT/SELECT
-- Replaces space-member checks (silently blocking authenticated users) with auth.uid() checks

-- Task UPDATE
DROP POLICY IF EXISTS "task_update_space_member" ON public."Task";
CREATE POLICY "task_update_authenticated"
    ON public."Task"
    FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- Activity SELECT
DROP POLICY IF EXISTS "activity_select_space_member" ON public."Activity";
CREATE POLICY "activity_select_authenticated"
    ON public."Activity"
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Activity INSERT
DROP POLICY IF EXISTS "activity_insert_space_member" ON public."Activity";
CREATE POLICY "activity_insert_authenticated"
    ON public."Activity"
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND "userId" = auth.uid()::text
    );
