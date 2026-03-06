"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Link as LinkIcon,
    Code,
    Quote,
} from "lucide-react";

interface RichTextEditorProps {
    content: string;
    onChange?: (html: string) => void;
    onBlur?: (html: string) => void;
    placeholder?: string;
    editable?: boolean;
    className?: string;
}

export function RichTextEditor({
    content,
    onChange,
    onBlur,
    placeholder = "",
    editable = true,
    className,
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: "text-primary underline" },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML());
        },
        onBlur: ({ editor }) => {
            onBlur?.(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] px-3 py-2",
            },
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content || "");
        }
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className={cn("border rounded-md overflow-hidden", className)}>
            {editable && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}

function Toolbar({ editor }: { editor: Editor }) {
    const addLink = () => {
        const url = window.prompt("URL:");
        if (url) {
            editor.chain().focus().setLink({ href: url }).run();
        } else {
            editor.chain().focus().unsetLink().run();
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1 bg-muted/30">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                icon={Bold}
                title="Negrita"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                icon={Italic}
                title="Cursiva"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive("strike")}
                icon={Strikethrough}
                title="Tachado"
            />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor.isActive("heading", { level: 1 })}
                icon={Heading1}
                title="Titulo 1"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive("heading", { level: 2 })}
                icon={Heading2}
                title="Titulo 2"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                active={editor.isActive("heading", { level: 3 })}
                icon={Heading3}
                title="Titulo 3"
            />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                icon={List}
                title="Lista"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")}
                icon={ListOrdered}
                title="Lista numerada"
            />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")}
                icon={Quote}
                title="Cita"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleCode().run()}
                active={editor.isActive("code")}
                icon={Code}
                title="Codigo"
            />
            <ToolbarButton
                onClick={addLink}
                active={editor.isActive("link")}
                icon={LinkIcon}
                title="Enlace"
            />
        </div>
    );
}

function ToolbarButton({
    onClick,
    active,
    icon: Icon,
    title,
}: {
    onClick: () => void;
    active: boolean;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", active && "bg-accent")}
            onClick={onClick}
            type="button"
            title={title}
        >
            <Icon className="h-3.5 w-3.5" />
        </Button>
    );
}
