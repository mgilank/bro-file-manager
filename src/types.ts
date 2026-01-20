export type Entry = {
  name: string;
  type: "dir" | "file";
  size: number;
  mtime: number;
};

export type Preview = {
  name: string;
  size: number;
  mtime: number;
  content: string;
};

export type UserRole = "read-only" | "read-write" | "admin";

export type TrashItem = {
  id: string;
  name: string;
  originalPath: string;
  deletedAt: number;
  type: "dir" | "file";
  size: number;
};

export type ClipboardItem = {
  name: string;
  path: string;
};

export type AuthState = "unknown" | "authed" | "logged_out";

export type ListResponse = {
  path: string;
  parent: string | null;
  entries: Entry[];
  user: string;
  role: UserRole;
  total?: number;
  page?: number;
  pageSize?: number;
};

export type TrashResponse = {
  items: TrashItem[];
  user: string;
  role: UserRole;
};

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

export type TypeFilter =
  | "all"
  | "dir"
  | "file"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "archive"
  | "other";
export type DateFilter = "any" | "24h" | "7d" | "30d" | "90d";
export type SortMode =
  | "default"
  | "name-asc"
  | "name-desc"
  | "date-desc"
  | "date-asc"
  | "size-desc"
  | "size-asc"
  | "type-asc"
  | "type-desc";
export type Theme = "dawn" | "coast" | "slate";
export type ViewMode = "list" | "grid";

export type Breadcrumb = {
  label: string;
  path: string;
};
