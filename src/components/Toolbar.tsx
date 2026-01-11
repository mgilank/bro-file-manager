import type { ChangeEvent, RefObject } from "react";
import type { Breadcrumb } from "../types";

type ToolbarProps = {
  breadcrumbs: Breadcrumb[];
  query: string;
  onQueryChange: (value: string) => void;
  onUp: () => void;
  onRefresh: () => void;
  onUploadClick: () => void;
  onCreateFolder: () => void;
  onToggleTrash: () => void;
  showTrash: boolean;
  actionLoading: boolean;
  canWrite: boolean;
  parent: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBreadcrumbClick: (path: string) => void;
};

export function Toolbar({
  breadcrumbs,
  query,
  onQueryChange,
  onUp,
  onRefresh,
  onUploadClick,
  onCreateFolder,
  onToggleTrash,
  showTrash,
  actionLoading,
  canWrite,
  parent,
  fileInputRef,
  onUploadChange,
  onBreadcrumbClick,
}: ToolbarProps) {
  return (
    <div className="toolbar card">
      <div>
        <p className="label">Current path</p>
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.path}
              className="crumb"
              onClick={() => onBreadcrumbClick(crumb.path)}
            >
              {crumb.label}
              {index < breadcrumbs.length - 1 ? <span>/</span> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-actions">
        <input
          className="search"
          type="search"
          placeholder="Search names..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={showTrash}
        />
        <button className="ghost" onClick={onUp} disabled={!parent}>
          Up
        </button>
        <button className="ghost" onClick={onRefresh}>
          Refresh
        </button>
        <button onClick={onUploadClick} disabled={actionLoading || showTrash || !canWrite}>
          Upload
        </button>
        <button
          className="ghost"
          onClick={onCreateFolder}
          disabled={actionLoading || showTrash || !canWrite}
        >
          New Folder
        </button>
        <button className="ghost" onClick={onToggleTrash} disabled={actionLoading}>
          {showTrash ? "Back to Files" : "Trash"}
        </button>
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
