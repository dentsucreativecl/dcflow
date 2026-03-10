"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  FileText,
  Image,
  Film,
  File,
  Download,
  Loader2,
  Grid,
  List,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

interface ProjectFilesTabProps {
  projectId: string;
}

interface FileRow {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  taskTitle: string;
  uploaderName: string;
  uploaderInitials: string;
}

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.startsWith("video/")) return Film;
  if (type.includes("pdf") || type.includes("document") || type.includes("text")) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ProjectFilesTab({ projectId }: ProjectFilesTabProps) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchFiles = useCallback(async () => {
    const supabase = createClient();

    const { data: taskIds } = await supabase
      .from("Task")
      .select("id")
      .eq("listId", projectId);

    if (!taskIds || taskIds.length === 0) {
      setFiles([]);
      setLoading(false);
      return;
    }

    const ids = taskIds.map((t) => t.id);

    const { data } = await supabase
      .from("Attachment")
      .select("id, fileName, fileUrl, fileType, fileSize, createdAt, Task:taskId(title), User:uploadedById(name)")
      .in("taskId", ids)
      .order("createdAt", { ascending: false });

    const parsed: FileRow[] = (data || []).map((a: any) => {
      const task = Array.isArray(a.Task) ? a.Task[0] : a.Task;
      const user = Array.isArray(a.User) ? a.User[0] : a.User;
      const name = user?.name || "Usuario";
      return {
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
        taskTitle: task?.title || "",
        uploaderName: name,
        uploaderInitials: name.split(" ").map((n: string) => n[0]).join("").slice(0, 2),
      };
    });

    setFiles(parsed);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">
          Archivos ({files.length})
        </h3>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <File className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sin archivos adjuntos</p>
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const Icon = getFileIcon(file.fileType);
            return (
              <Card key={file.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      en {file.taskTitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                        {file.uploaderInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(file.createdAt), "MMM d")}
                    </span>
                  </div>
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {files.map((file) => {
            const Icon = getFileIcon(file.fileType);
            return (
              <div key={file.id} className="flex items-center gap-4 p-3 hover:bg-secondary/50 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)} &middot; en {file.taskTitle}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                      {file.uploaderInitials}
                    </AvatarFallback>
                  </Avatar>
                  {format(new Date(file.createdAt), "MMM d, yyyy")}
                </div>
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
