import type { Entry } from "../types";

type ActionBarProps = {
  showTrash: boolean;
  selectionCount: number;
  trashCount: number;
  clipboardCount: number;
  actionLoading: boolean;
  canWrite: boolean;
  selected: Entry | null;
  previewLoading: boolean;
  canTextPreview: boolean;
  canImagePreview: boolean;
  downloadHref: string | null;
  onCopy: () => void;
  onPaste: () => void;
  onRename: () => void;
  onMove: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onImagePreview: () => void;
};

export function ActionBar({
  showTrash,
  selectionCount,
  trashCount,
  clipboardCount,
  actionLoading,
  canWrite,
  selected,
  previewLoading,
  canTextPreview,
  canImagePreview,
  downloadHref,
  onCopy,
  onPaste,
  onRename,
  onMove,
  onArchive,
  onDelete,
  onPreview,
  onImagePreview,
}: ActionBarProps) {
  return (
    <div className="card action-bar">
      <div>
        <p className="label">Actions</p>
        <p className="meta">
          {showTrash ? `${trashCount} item(s) in trash` : `${selectionCount} item(s) selected`}
        </p>
        {clipboardCount > 0 ? <p className="meta">Clipboard: {clipboardCount} item(s)</p> : null}
      </div>
      <div className="action-buttons">
        <button
          className="ghost"
          onClick={onCopy}
          disabled={actionLoading || showTrash || selectionCount === 0}
        >
          Copy
        </button>
        <button
          className="ghost"
          onClick={onPaste}
          disabled={actionLoading || showTrash || clipboardCount === 0 || !canWrite}
        >
          Paste
        </button>
        <button
          className="ghost"
          onClick={onRename}
          disabled={actionLoading || showTrash || selectionCount !== 1 || !canWrite}
        >
          Rename
        </button>
        <button
          className="ghost"
          onClick={onMove}
          disabled={actionLoading || showTrash || selectionCount === 0 || !canWrite}
        >
          Move
        </button>
        <button
          className="ghost"
          onClick={onArchive}
          disabled={actionLoading || showTrash || selectionCount === 0}
        >
          Archive
        </button>
        <button
          className="danger"
          onClick={onDelete}
          disabled={actionLoading || showTrash || selectionCount === 0 || !canWrite}
        >
          Delete
        </button>
        {!showTrash && selected && selected.type === "file" ? (
          <>
            <span className="action-divider" aria-hidden="true" />
            {canTextPreview ? (
              <button className="ghost" onClick={onPreview} disabled={previewLoading}>
                {previewLoading ? "Loading..." : "Preview"}
              </button>
            ) : null}
            {canImagePreview ? (
              <button className="ghost" onClick={onImagePreview}>
                Image Preview
              </button>
            ) : null}
            {downloadHref ? (
              <a className="ghost" href={downloadHref}>
                Download
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
