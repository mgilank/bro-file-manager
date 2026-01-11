import type { DragEvent } from "react";
import type { Entry, TrashItem } from "../types";
import { formatBytes, formatDate } from "../utils/format";
import { FileIcon, FolderIcon } from "./icons";
import { Pagination, type PaginationProps } from "./Pagination";

type FileListProps = {
  showTrash: boolean;
  loading: boolean;
  trashItems: TrashItem[];
  filtered: Entry[];
  selectedNames: string[];
  allSelected: boolean;
  dragActive: boolean;
  actionLoading: boolean;
  canWrite: boolean;
  pagination?: PaginationProps;
  onToggleSelectAll: () => void;
  onToggleSelect: (entry: Entry) => void;
  onEntryClick: (entry: Entry) => void;
  onRestore: (item: TrashItem) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};

export function FileList({
  showTrash,
  loading,
  trashItems,
  filtered,
  selectedNames,
  allSelected,
  dragActive,
  actionLoading,
  canWrite,
  pagination,
  onToggleSelectAll,
  onToggleSelect,
  onEntryClick,
  onRestore,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileListProps) {
  return (
    <div
      className={`card list ${dragActive ? "dragging" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {showTrash ? (
        <>
          <div className="list-header trash">
            <span>Item</span>
            <span>Original</span>
            <span>Deleted</span>
            <span>Action</span>
          </div>
          {loading ? (
            <div className="empty">Loading trash...</div>
          ) : trashItems.length === 0 ? (
            <div className="empty">Trash is empty.</div>
          ) : (
            trashItems.map((item, index) => (
              <div
                key={item.id}
                className="row trash"
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <div className="name">
                  <span className="icon">{item.type === "dir" ? <FolderIcon /> : <FileIcon />}</span>
                  {item.name}
                </div>
                <span className="muted">{item.originalPath}</span>
                <span>{formatDate(item.deletedAt)}</span>
                <button
                  className="ghost"
                  onClick={() => onRestore(item)}
                  disabled={actionLoading || !canWrite}
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <div className="list-header">
            <span>
              <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
            </span>
            <span>Name</span>
            <span>Size</span>
            <span>Modified</span>
          </div>
          {loading ? (
            <div className="empty">Loading directory...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">Nothing here yet.</div>
          ) : (
            filtered.map((entry, index) => (
              <div
                key={`${entry.type}-${entry.name}`}
                className={`row ${entry.type} ${selectedNames.includes(entry.name) ? "selected" : ""}`}
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <span>
                  <input
                    type="checkbox"
                    checked={selectedNames.includes(entry.name)}
                    onChange={() => onToggleSelect(entry)}
                  />
                </span>
                <button className="name" onClick={() => onEntryClick(entry)}>
                  <span className="icon">
                    {entry.type === "dir" ? <FolderIcon /> : <FileIcon />}
                  </span>
                  {entry.name}
                </button>
                <span>{entry.type === "file" ? formatBytes(entry.size) : "--"}</span>
                <span>{formatDate(entry.mtime)}</span>
              </div>
            ))
          )}
          {dragActive ? <div className="drop-overlay">Drop files to upload</div> : null}
        </>
      )}
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
