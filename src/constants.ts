import type { DateFilter, Theme } from "./types";
import { parseEnvBoolean } from "./utils/env";

export const API_BASE = "/api";
export const BRAND_EYEBROW = import.meta.env.VITE_BRAND_EYEBROW ?? "Bro File Manager";
export const BRAND_TITLE = import.meta.env.VITE_BRAND_TITLE ?? "Storage Lens";
export const BRAND_SUBTITLE =
  import.meta.env.VITE_BRAND_SUBTITLE ?? "Manage the server file tree with guarded access.";
export const SHORTCUTS_ENABLED = parseEnvBoolean(import.meta.env.VITE_SHORTCUTS_ENABLED, false);

export const DEFAULT_THEME: Theme = "dawn";
export const THEMES: Theme[] = ["dawn", "coast", "slate"];
export const THEME_STORAGE_KEY = "bro-file-manager-theme";

export const FILE_TYPE_GROUPS = [
  { key: "image", exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"] },
  { key: "audio", exts: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"] },
  { key: "video", exts: [".mp4", ".mov", ".mkv", ".webm", ".avi", ".wmv"] },
  {
    key: "document",
    exts: [
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".md",
      ".rtf",
      ".csv",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".json",
      ".yaml",
      ".yml",
      ".xml",
    ],
  },
  { key: "archive", exts: [".zip", ".tar", ".gz", ".tgz", ".rar", ".7z", ".bz2", ".xz"] },
] as const;

export const TEXT_PREVIEW_EXTS = new Set([".txt", ".php", ".js", ".html"]);
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

export const DATE_RANGE_MS: Record<DateFilter, number | null> = {
  any: null,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export const MB_BYTES = 1024 * 1024;
export const CONTENT_SEARCH_DEBOUNCE_MS = 300;
