import { useEffect } from "react";
import type { Entry } from "../types";
import { isEditableTarget } from "../utils/dom";

type ShortcutHandlers = {
  onSelectAll: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleTrash: () => void;
  onOpenSelection: (entry: Entry) => void;
  onClearSelection: () => void;
};

type ShortcutOptions = {
  enabled: boolean;
  showTrash: boolean;
  selectionTargets: Entry[];
  handlers: ShortcutHandlers;
};

export function useKeyboardShortcuts({
  enabled,
  showTrash,
  selectionTargets,
  handlers,
}: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (showTrash && key !== "t" && key !== "escape") {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "a") {
        event.preventDefault();
        handlers.onSelectAll();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "c") {
        event.preventDefault();
        handlers.onCopy();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "v") {
        event.preventDefault();
        handlers.onPaste();
        return;
      }

      if (key === "escape") {
        handlers.onClearSelection();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        handlers.onCreateFolder();
        return;
      }

      if (key === "u") {
        event.preventDefault();
        handlers.onUpload();
        return;
      }

      if (key === "r" || key === "f2") {
        event.preventDefault();
        handlers.onRename();
        return;
      }

      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        handlers.onDelete();
        return;
      }

      if (key === "t") {
        event.preventDefault();
        handlers.onToggleTrash();
        return;
      }

      if (key === "enter") {
        if (selectionTargets.length === 1) {
          event.preventDefault();
          handlers.onOpenSelection(selectionTargets[0]);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, showTrash, selectionTargets, handlers]);
}
