"use client";

import { useState } from "react";
import {
  FileText,
  Image,
  Film,
  File,
  Upload,
  FolderPlus,
  MoreHorizontal,
  Download,
  Trash2,
  Grid,
  List,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Mock files data
const mockFiles = [
  {
    id: "f-1",
    name: "Brand Guidelines v2.pdf",
    type: "document",
    size: "2.4 MB",
    uploadedBy: "Sarah Chen",
    uploadedAt: "2024-03-02",
  },
  {
    id: "f-2",
    name: "Hero Banner Final.png",
    type: "image",
    size: "4.8 MB",
    uploadedBy: "Rachel Green",
    uploadedAt: "2024-03-01",
  },
  {
    id: "f-3",
    name: "Logo Variations.ai",
    type: "document",
    size: "12.3 MB",
    uploadedBy: "Sarah Chen",
    uploadedAt: "2024-02-28",
  },
  {
    id: "f-4",
    name: "Promo Video Draft.mp4",
    type: "video",
    size: "156 MB",
    uploadedBy: "Alex Rivera",
    uploadedAt: "2024-02-25",
  },
  {
    id: "f-5",
    name: "Color Palette.sketch",
    type: "document",
    size: "8.1 MB",
    uploadedBy: "Sarah Chen",
    uploadedAt: "2024-02-20",
  },
];

const getFileIcon = (type: string) => {
  switch (type) {
    case "image":
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image className="h-6 w-6 text-studio-info" />;
    case "video":
      return <Film className="h-6 w-6 text-studio-warning" />;
    case "document":
    default:
      return <FileText className="h-6 w-6 text-primary" />;
  }
};

interface ProjectFilesTabProps {
  projectId: string;
}

export function ProjectFilesTab({ projectId }: ProjectFilesTabProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="default" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
          <Button variant="outline" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Files */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mockFiles.map((file) => (
            <Card
              key={file.id}
              className="p-4 hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center mb-3">
                  {getFileIcon(file.type)}
                </div>
                <p className="text-sm font-medium text-foreground truncate w-full">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {mockFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file.uploadedBy} • {file.uploadedAt}
                </p>
              </div>
              <Badge variant="secondary">{file.size}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Card>
      )}

      {mockFiles.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <File className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No files yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Upload files to share with your team
          </p>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </Card>
      )}
    </div>
  );
}
