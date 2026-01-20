import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, Shrink } from "lucide-react";
import ace from "ace-builds";
import "ace-builds/src-noconflict/theme-textmate";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-php";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-scss";
import "ace-builds/src-noconflict/mode-less";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-jsx";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-tsx";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/mode-xml";
import type { EditorFile } from "../types";
import { getFileExtension } from "../utils/path";

type EditorModalProps = {
  open: boolean;
  file: EditorFile | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  canWrite: boolean;
  onOpenInNewTab?: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

function getAceMode(name: string) {
  const ext = getFileExtension(name);
  if (ext === ".html" || ext === ".htm") {
    return "ace/mode/html";
  }
  if (ext === ".php") {
    return "ace/mode/php";
  }
  if (ext === ".css" || ext === ".scss" || ext === ".less") {
    return ext === ".scss" ? "ace/mode/scss" : ext === ".less" ? "ace/mode/less" : "ace/mode/css";
  }
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    return "ace/mode/javascript";
  }
  if (ext === ".jsx") {
    return "ace/mode/jsx";
  }
  if (ext === ".ts") {
    return "ace/mode/typescript";
  }
  if (ext === ".tsx") {
    return "ace/mode/tsx";
  }
  if (ext === ".json") {
    return "ace/mode/json";
  }
  if (ext === ".md" || ext === ".markdown") {
    return "ace/mode/markdown";
  }
  if (ext === ".xml" || ext === ".svg") {
    return "ace/mode/xml";
  }
  return null;
}

export function EditorModal({
  open,
  file,
  dirty,
  loading,
  saving,
  canWrite,
  onOpenInNewTab,
  onChange,
  onSave,
  onClose,
}: EditorModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const aceRef = useRef<ace.Ace.Editor | null>(null);
  const iconProps = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;
  const editorMode = useMemo(
    () => (file?.name ? getAceMode(file.name) : null),
    [file?.name]
  );

  useEffect(() => {
    if (!open || !file || !editorRef.current || loading) {
      if (aceRef.current) {
        aceRef.current.destroy();
        aceRef.current = null;
      }
      return;
    }

    if (aceRef.current) {
      aceRef.current.destroy();
    }

    const editor = ace.edit(editorRef.current);
    editor.setTheme("ace/theme/textmate");
    editor.session.setMode(editorMode ?? "ace/mode/text");
    editor.session.setValue(file.content);
    editor.clearSelection();
    editor.navigateFileStart();
    editor.setOptions({
      wrap: true,
      showPrintMargin: false,
      fontSize: "14px",
      useWorker: false,
    });
    editor.setReadOnly(!canWrite);
    editor.resize(true);

    editor.commands.addCommand({
      name: "undo-alt",
      bindKey: { win: "Alt-Z", mac: "Alt-Z" },
      exec: "undo",
    });
    editor.commands.addCommand({
      name: "redo-alt",
      bindKey: { win: "Alt-Shift-Z", mac: "Alt-Shift-Z" },
      exec: "redo",
    });

    const changeHandler = () => {
      onChange(editor.getValue());
    };
    editor.session.on("change", changeHandler);

    aceRef.current = editor;

    return () => {
      editor.session.off("change", changeHandler);
      editor.destroy();
      aceRef.current = null;
    };
  }, [open, file, editorMode, canWrite, onChange, loading]);

  useEffect(() => {
    if (aceRef.current) {
      aceRef.current.resize(true);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
    }
  }, [open]);

  if (!open || !file) {
    return null;
  }

  return (
    <div
      className={`text-preview${isFullscreen ? " is-fullscreen" : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`text-preview-body editor-body${isFullscreen ? " is-fullscreen" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-preview-header editor-header">
          <div className="editor-title">
            <span className="text-preview-title">{file.name}</span>
            {dirty ? <span className="editor-status">Unsaved changes</span> : null}
          </div>
          <div className="editor-actions">
            {onOpenInNewTab ? (
              <button className="ghost" type="button" onClick={onOpenInNewTab}>
                New Tab
              </button>
            ) : null}
            <button
              className="ghost"
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen editor" : "Enter fullscreen editor"}
            >
              {isFullscreen ? <Shrink {...iconProps} /> : <Expand {...iconProps} />}
            </button>
            <button className="ghost" type="button" onClick={onClose}>
              Close
            </button>
            <button type="button" onClick={onSave} disabled={!dirty || saving || !canWrite}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {loading ? (
          <div className="editor-loading">Loading editor...</div>
        ) : (
          <div className="editor-surface" ref={editorRef} />
        )}
      </div>
    </div>
  );
}
