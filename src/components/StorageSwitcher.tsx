import type { S3Config, StorageMode } from "../types";
import { HardDrive, Cloud } from "lucide-react";

interface StorageSwitcherProps {
  mode: StorageMode;
  onModeChange: (mode: StorageMode) => void;
  onSelectS3: (configId: string) => void;
  onAddS3: () => void;
  s3Configs: S3Config[];
  activeS3ConfigId?: string | null;
  maxS3Connections?: number;
}

export function StorageSwitcher({
  mode,
  onModeChange,
  onSelectS3,
  onAddS3,
  s3Configs,
  activeS3ConfigId,
  maxS3Connections,
}: StorageSwitcherProps) {
  const hasS3Configs = s3Configs.length > 0;
  const atLimit = typeof maxS3Connections === "number" && s3Configs.length >= maxS3Connections;
  return (
    <div className="storage-switcher flex items-center gap-1 p-1.5 rounded-full bg-[var(--card)] border border-[rgba(28,37,43,0.12)]">
      <button
        onClick={() => onModeChange("local")}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${mode === "local"
          ? "bg-[var(--accent-soft)] text-[var(--ink)]"
          : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[rgba(28,37,43,0.06)]"
          }`}
      >
        <HardDrive className={`w-4 h-4 transition-colors ${mode === "local" ? "text-[var(--accent)]" : "text-current"}`} />
        <span>Local Files</span>
      </button>

      {hasS3Configs ? (
        s3Configs.map((config) => {
          const isActive = mode === "s3" && activeS3ConfigId === config.id;
          return (
            <button
              key={config.id}
              onClick={() => onSelectS3(config.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${isActive
                ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[rgba(28,37,43,0.06)]"
                }`}
              title={config.name}
            >
              <Cloud className={`w-4 h-4 transition-colors ${isActive ? "text-[var(--accent)]" : "text-current"}`} />
              <span className="max-w-[120px] truncate">{config.name}</span>
            </button>
          );
        })
      ) : (
        <button
          onClick={onAddS3}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${mode === "s3"
            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
            : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[rgba(28,37,43,0.06)]"
            }`}
        >
          <Cloud className={`w-4 h-4 transition-colors ${mode === "s3" ? "text-[var(--accent)]" : "text-current"}`} />
          <span>S3 Storage</span>
        </button>
      )}

      <button
        type="button"
        onClick={onAddS3}
        disabled={atLimit}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)] text-white transition-colors hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add S3 connection"
        title={atLimit ? "Max S3 connections reached" : "Add S3 connection"}
      >
        <span className="text-lg leading-none">+</span>
      </button>
    </div>
  );
}
