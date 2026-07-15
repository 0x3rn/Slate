"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  readOnly?: boolean;
  forceSyncVersion?: number;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <div 
      className="flex flex-wrap items-center gap-1 border-b border-[var(--editor-border)] bg-card/50 p-2 backdrop-blur-sm"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("bold")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("italic")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("strike")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-border" />

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("heading", { level: 1 })
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("heading", { level: 2 })
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("heading", { level: 3 })
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-border" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("bulletList")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("orderedList")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          editor.isActive("blockquote")
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Blockquote"
      >
        <Quote className="h-4 w-4" />
      </button>

      <div className="mx-1 h-5 w-px bg-border" />

      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </button>
    </div>
  );
};

export function RichTextEditor({ content, onUpdate, readOnly = false, forceSyncVersion }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-custom prose-preview flex-1 focus:outline-none min-h-full",
      },
    },
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editor && forceSyncVersion && forceSyncVersion > 0) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceSyncVersion]);

  if (!mounted) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--editor-bg)]">
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto p-6">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
