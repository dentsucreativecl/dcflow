"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/lib/supabase/client";
import { Upload, X, FileText, Image, Film, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface FileUploadZoneProps {
    taskId: string;
    onUploadComplete?: () => void;
}

const fileIcons: Record<string, React.ElementType> = {
    image: Image,
    video: Film,
    document: FileText,
    default: File,
};

function getFileCategory(type: string) {
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.includes("pdf") || type.includes("document") || type.includes("text")) return "document";
    return "default";
}

export function FileUploadZone({ taskId, onUploadComplete }: FileUploadZoneProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string; size: number; type: string}>>([]);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!taskId || !user) return;
        setUploading(true);
        setError(null);

        const supabase = createClient();

        try {
            for (const file of acceptedFiles) {
                // Upload to Supabase Storage
                const fileExt = file.name.split(".").pop();
                const fileName = `${taskId}/${Date.now()}-${file.name}`;

                let uploadData = null;
                try {
                    const result = await supabase.storage
                        .from("attachments")
                        .upload(fileName, file);
                    if (result.error) {
                        console.warn("Storage upload skipped:", result.error.message);
                    } else {
                        uploadData = result.data;
                    }
                } catch (storageErr) {
                    console.warn("Storage not configured, saving reference only");
                }

                // Get public URL
                const fileUrl = uploadData
                    ? supabase.storage.from("attachments").getPublicUrl(uploadData.path).data.publicUrl
                    : `/uploads/${fileName}`;

                // Save attachment record in database
                const attachId = crypto.randomUUID();
            const { error: dbError } = await supabase.from("Attachment").insert({
                id: attachId,
                    taskId,
                    fileName: file.name,
                    fileUrl,
                    fileType: file.type || "application/octet-stream",
                    fileSize: file.size,
                    uploadedById: user.id,
                });

                if (dbError) {
                    console.error("Error saving attachment:", dbError);
                    setError("Error al guardar el archivo: " + dbError.message);
                } else {
                    setUploadedFiles(prev => [...prev, { name: file.name, size: file.size, type: file.type }]);
                }
            }
            onUploadComplete?.();
        } catch (err: unknown) {
            console.error("Upload error:", err);
            setError("Error al subir archivo: " + (err instanceof Error ? err.message : "Error desconocido"));
        } finally {
            setUploading(false);
        }
    }, [taskId, user, onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: 10 * 1024 * 1024, // 10MB
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'video/*': ['.mp4', '.mov', '.avi'],
            'text/*': ['.txt', '.csv'],
        },
    });

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                    uploading && "opacity-50 pointer-events-none"
                )}
            >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {isDragActive ? (
                    <p className="text-sm text-primary font-medium">Suelta los archivos aqui...</p>
                ) : uploading ? (
                    <p className="text-sm text-muted-foreground">Subiendo archivo...</p>
                ) : (
                    <>
                        <p className="text-sm font-medium">Arrastra archivos o haz clic para seleccionar</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF, DOC, XLS, MP4 hasta 10MB</p>
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
                    <X className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Subidos:</p>
                    {uploadedFiles.map((file, i) => {
                        const IconComp = fileIcons[getFileCategory(file.type)] || fileIcons.default;
                        return (
                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                                <IconComp className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate flex-1">{file.name}</span>
                                <span className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
