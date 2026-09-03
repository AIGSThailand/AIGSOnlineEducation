"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Link2,
  ImageIcon,
  Undo2,
  Redo2,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stripWordPressBlockComments } from "@/lib/utils/wordpress-content";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, show a raw HTML textarea toggle for migrated LearnDash content. */
  allowHtmlSource?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write lesson content…",
  disabled,
  className,
  allowHtmlSource = true,
}: RichTextEditorProps) {
  const [sourceMode, setSourceMode] = React.useState(false);
  const [sourceHtml, setSourceHtml] = React.useState(value);
  const lastEmitted = React.useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: stripWordPressBlockComments(value) || "",
    editable: !disabled && !sourceMode,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "rich-content tiptap-editor min-h-[280px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      lastEmitted.current = html;
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  React.useEffect(() => {
    if (!editor || sourceMode) return;
    const incoming = stripWordPressBlockComments(value) || "";
    const current = editor.getHTML();
    if (incoming !== lastEmitted.current && incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false });
      lastEmitted.current = incoming;
    }
  }, [value, editor, sourceMode]);

  React.useEffect(() => {
    if (editor) editor.setEditable(!disabled && !sourceMode);
  }, [editor, disabled, sourceMode]);

  const enterSourceMode = () => {
    if (!editor) return;
    const html = editor.getHTML();
    setSourceHtml(html === "<p></p>" ? "" : html);
    setSourceMode(true);
  };

  const exitSourceMode = () => {
    if (!editor) return;
    const cleaned = stripWordPressBlockComments(sourceHtml);
    editor.commands.setContent(cleaned || "", { emitUpdate: false });
    lastEmitted.current = cleaned;
    onChange(cleaned);
    setSourceMode(false);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-500",
        disabled && "opacity-60",
        className
      )}
    >
      {editor && (
        <Toolbar
          editor={editor}
          disabled={disabled || sourceMode}
          sourceMode={sourceMode}
          allowHtmlSource={allowHtmlSource}
          onToggleSource={() => (sourceMode ? exitSourceMode() : enterSourceMode())}
        />
      )}

      {sourceMode ? (
        <textarea
          value={sourceHtml}
          disabled={disabled}
          onChange={(e) => {
            setSourceHtml(e.target.value);
            onChange(e.target.value);
          }}
          className="min-h-[280px] w-full resize-y border-0 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 focus:outline-none"
          aria-label="HTML source"
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function Toolbar({
  editor,
  disabled,
  sourceMode,
  allowHtmlSource,
  onToggleSource,
}: {
  editor: Editor;
  disabled?: boolean;
  sourceMode: boolean;
  allowHtmlSource: boolean;
  onToggleSource: () => void;
}) {
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("Image URL", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5"
      role="toolbar"
      aria-label="Text formatting"
    >
      <ToolBtn
        label="Undo"
        disabled={disabled || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Redo"
        disabled={disabled || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Bold"
        active={editor.isActive("bold")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Italic"
        active={editor.isActive("italic")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Underline"
        active={editor.isActive("underline")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn
        label="Bullet list"
        active={editor.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Numbered list"
        active={editor.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Blockquote"
        active={editor.isActive("blockquote")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Inline code"
        active={editor.isActive("code")}
        disabled={disabled}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Horizontal rule"
        disabled={disabled}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolBtn>
      <Sep />
      <ToolBtn label="Insert link" active={editor.isActive("link")} disabled={disabled} onClick={setLink}>
        <Link2 className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn label="Insert image" disabled={disabled} onClick={addImage}>
        <ImageIcon className="h-3.5 w-3.5" />
      </ToolBtn>
      {allowHtmlSource && (
        <>
          <Sep />
          <ToolBtn
            label={sourceMode ? "Visual editor" : "HTML source"}
            active={sourceMode}
            disabled={false}
            onClick={onToggleSource}
          >
            <Code2 className="h-3.5 w-3.5" />
          </ToolBtn>
        </>
      )}
    </div>
  );
}

function ToolBtn({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-brand-500",
        active && "bg-brand-50 text-brand-800"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />;
}
