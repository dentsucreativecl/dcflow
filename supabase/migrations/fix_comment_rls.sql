-- Fix: Comment INSERT/SELECT policies
-- Allows any authenticated user to insert and read comments
-- (replaces the space-member check that was silently blocking inserts)

DROP POLICY IF EXISTS "comment_insert_space_member" ON public."Comment";
DROP POLICY IF EXISTS "comment_select_space_member" ON public."Comment";

CREATE POLICY "comment_insert_authenticated"
    ON public."Comment"
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND "userId" = auth.uid()::text
    );

CREATE POLICY "comment_select_authenticated"
    ON public."Comment"
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
    );
