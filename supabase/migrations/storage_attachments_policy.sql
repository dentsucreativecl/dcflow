-- Create 'attachments' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "attachments_insert_authenticated"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'attachments'
        AND auth.uid() IS NOT NULL
    );

-- Allow public read access (bucket is public)
CREATE POLICY "attachments_select_public"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'attachments');

-- Allow users to delete their own uploads
CREATE POLICY "attachments_delete_own"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'attachments'
        AND auth.uid() IS NOT NULL
    );
