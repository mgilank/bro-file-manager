import {
  Archive,
  ArrowUp,
  ClipboardPaste,
  Copy,
  FolderPlus,
  LayoutGrid,
  List as ListIcon,
  MoveRight,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent, MouseEvent, RefObject } from "react";
import type { ViewMode } from "../types";

type ToolbarProps = {
  query: string;
  currentPathLabel: string;
  onQueryChange: (value: string) => void;
  onUp: () => void;
  onRefresh: () => void;
  onUploadClick: () => void;
  onCreateFolder: () => void;
  onToggleTrash: () => void;
  showTrash: boolean;
  actionLoading: boolean;
  canWrite: boolean;
  selectionCount: number;
  clipboardCount: number;
  archiveHref: string | null;
  parent: string | null;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCopy: () => void;
  onPaste: () => void;
  onRename: () => void;
  onMove: () => void;
  onArchiveClick: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function Toolbar({
  query,
  currentPathLabel,
  onQueryChange,
  onUp,
  onRefresh,
  onUploadClick,
  onCreateFolder,
  onToggleTrash,
  showTrash,
  actionLoading,
  canWrite,
  selectionCount,
  clipboardCount,
  archiveHref,
  parent,
  viewMode,
  onViewModeChange,
  fileInputRef,
  onUploadChange,
  onCopy,
  onPaste,
  onRename,
  onMove,
  onArchiveClick,
  onDelete,
  onClearSelection,
}: ToolbarProps) {
  const iconProps = {
    size: 16,
    strokeWidth: 1.8,
    "aria-hidden": true,
  } as const;
  const hasSelection = selectionCount > 0;
  const archiveDisabled = actionLoading || showTrash || selectionCount === 0 || !archiveHref;
  const handleArchiveClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (archiveDisabled) {
      event.preventDefault();
      return;
    }
    onArchiveClick();
  };

  return (
    <div
      className={
        hasSelection ? "toolbar card is-sticky shadow-sm shadow-sky-800" : "toolbar card "
      }
    >
      <div>
        <p className="label">Current path</p>
        <p className="meta">{currentPathLabel}</p>
      </div>
      <div className="toolbar-actions">
        {!hasSelection ? (
          <input
            className="search"
            type="search"
            placeholder="Search names..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            disabled={showTrash}
          />
        ) : null}
        <button className="ghost" onClick={onUp} disabled={!parent}>
          <ArrowUp {...iconProps} />
          Up
        </button>
        {hasSelection ? (
          <>
            <button className="ghost" onClick={onClearSelection} disabled={actionLoading}>
              <X {...iconProps} />
              Deselect
            </button>
            <button
              className="ghost"
              onClick={onCopy}
              disabled={actionLoading || showTrash || selectionCount === 0}
            >
              <Copy {...iconProps} />
              Copy
            </button>
            <button
              className="ghost"
              onClick={onPaste}
              disabled={actionLoading || showTrash || clipboardCount === 0 || !canWrite}
            >
              <ClipboardPaste {...iconProps} />
              Paste
            </button>
            <button
              className="ghost"
              onClick={onRename}
              disabled={actionLoading || showTrash || selectionCount !== 1 || !canWrite}
            >
              <Pencil {...iconProps} />
              Rename
            </button>
            <button
              className="ghost"
              onClick={onMove}
              disabled={actionLoading || showTrash || selectionCount === 0 || !canWrite}
            >
              <MoveRight {...iconProps} />
              Move
            </button>
            <a
              className={`ghost${archiveDisabled ? " is-disabled" : ""}`}
              href={archiveHref ?? "#"}
              onClick={handleArchiveClick}
              aria-disabled={archiveDisabled}
              tabIndex={archiveDisabled ? -1 : undefined}
            >
              <Archive {...iconProps} />
              Download Zip
            </a>
            <button
              className="danger"
              onClick={onDelete}
              disabled={actionLoading || showTrash || selectionCount === 0 || !canWrite}
            >
              <Trash2 {...iconProps} />
              Delete
            </button>
          </>
        ) : (
          <>
            <button className="ghost" onClick={onRefresh}>
              <RefreshCw {...iconProps} />
              Refresh
            </button>
            <button onClick={onUploadClick} disabled={actionLoading || showTrash || !canWrite}>
              <Upload {...iconProps} />
              Upload
            </button>
            <button
              className="ghost"
              onClick={onCreateFolder}
              disabled={actionLoading || showTrash || !canWrite}
            >
              <FolderPlus {...iconProps} />
              New Folder
            </button>
            <button className="ghost" onClick={onToggleTrash} disabled={actionLoading}>
              <Trash2 {...iconProps} />
              {showTrash ? "Back to Files" : "Trash"}
            </button>
          </>
        )}
        {!showTrash ? (
          <div className="view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`ghost${viewMode === "list" ? " is-active" : ""}`}
              aria-pressed={viewMode === "list"}
              onClick={() => onViewModeChange("list")}
            >
              <ListIcon {...iconProps} />
              List
            </button>
            <button
              type="button"
              className={`ghost${viewMode === "grid" ? " is-active" : ""}`}
              aria-pressed={viewMode === "grid"}
              onClick={() => onViewModeChange("grid")}
            >
              <LayoutGrid {...iconProps} />
              Grid
            </button>
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          multiple
          onChange={onUploadChange}
        />
      </div>
    </div>
  );
}
