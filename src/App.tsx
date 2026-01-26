import { Home } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Header } from "./components/Header";
import { EditorModal } from "./components/EditorModal";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { LoginForm } from "./components/LoginForm";
import { FileList } from "./components/FileList";
import { TextPreviewModal } from "./components/TextPreviewModal";
import { Toasts } from "./components/Toasts";
import { Toolbar } from "./components/Toolbar";
import { StorageSwitcher } from "./components/StorageSwitcher";
import { S3ConnectionModal } from "./components/S3ConnectionModal";
import { Footer } from "./components/Footer";
import { S3SettingsPage } from "./components/S3SettingsPage";
import {
  API_BASE,
  DATE_RANGE_MS,
  DEFAULT_PAGE_SIZE,
  LAST_PATH_STORAGE_KEY,
  PAGE_SIZE_OPTIONS,
  SHORTCUTS_ENABLED,
  DEFAULT_VIEW_MODE,
  VIEW_MODE_STORAGE_KEY,
} from "./constants";
import { useContentSearch } from "./hooks/useContentSearch";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { apiFetch, readJson } from "./services/api";
import * as s3Api from "./services/api";
import type {
  AuthState,
  Breadcrumb,
  ClipboardItem,
  DateFilter,
  EditorFile,
  Entry,
  ListResponse,
  Preview,
  S3Config,
  S3ConnectionState,
  SortMode,
  StorageMode,
  TrashItem,
  TrashResponse,
  TypeFilter,
  UserRole,
  ViewMode,
} from "./types";
import { parseSizeInput } from "./utils/filters";
import {
  isImagePreviewable,
  isTextEditableName,
  isTextPreviewableName,
  matchesTypeFilter,
} from "./utils/fileTypes";
import { joinPath, normalizeInputPath } from "./utils/path";
import { sortEntries } from "./utils/sort";

function getStoredPath() {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(LAST_PATH_STORAGE_KEY);
  if (!stored || !stored.startsWith("/")) {
    return null;
  }
  return stored;
}

function setStoredPath(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_PATH_STORAGE_KEY, value);
  } catch { }
}

function clearStoredPath() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LAST_PATH_STORAGE_KEY);
  } catch { }
}

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return DEFAULT_VIEW_MODE;
  }
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (stored === "list" || stored === "grid") {
    return stored;
  }
  return DEFAULT_VIEW_MODE;
}

function setStoredViewMode(value: ViewMode) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, value);
  } catch { }
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [path, setPath] = useState("/");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editorFile, setEditorFile] = useState<EditorFile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [editorInitialContent, setEditorInitialContent] = useState("");
  const [pendingEditorPath, setPendingEditorPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("read-write");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem[] | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sizeMinMb, setSizeMinMb] = useState("");
  const [sizeMaxMb, setSizeMaxMb] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [contentSearch, setContentSearch] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [imagePreviewPath, setImagePreviewPath] = useState<string | null>(null);
  const [imagePreviewName, setImagePreviewName] = useState<string | null>(null);
  const [textPreviewOpen, setTextPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getStoredViewMode());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  // S3-related state
  const [storageMode, setStorageMode] = useState<StorageMode>(() => {
    if (typeof window === "undefined") return "local";
    const stored = window.localStorage.getItem("storageMode");
    return (stored === "s3" ? "s3" : "local") as StorageMode;
  });
  const [showS3Connection, setShowS3Connection] = useState(false);
  const [s3Connection, setS3Connection] = useState<S3ConnectionState>({ connected: false, configs: [] });
  const [activeS3ConfigId, setActiveS3ConfigId] = useState<string | null>(null);
  const [s3Paths, setS3Paths] = useState<Record<string, string>>({});
  const [pendingS3Connect, setPendingS3Connect] = useState(false);
  const [route, setRoute] = useState<"files" | "s3" | "s3-settings">(() => {
    if (typeof window === "undefined") return "files";
    if (window.location.pathname === "/s3-settings") return "s3-settings";
    if (window.location.pathname.startsWith("/s3/") || window.location.pathname === "/s3") return "s3";
    return "files";
  });
  const [routeS3ConfigId, setRouteS3ConfigId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (window.location.pathname.startsWith("/s3/")) {
      const [, , configId] = window.location.pathname.split("/");
      return configId || null;
    }
    return null;
  });

  const [theme, setTheme] = useTheme();
  const { toasts, pushToast } = useToasts();

  const handleUnauthorized = useCallback(() => {
    setAuth("logged_out");
  }, []);

  const notifyError = useCallback(
    (message: string) => {
      setError(message);
      pushToast(message, "error");
    },
    [pushToast]
  );

  const {
    matches: contentMatches,
    loading: contentLoading,
    reset: resetContentSearch,
  } = useContentSearch({
    enabled: contentSearch,
    query,
    path,
    showTrash,
    onUnauthorized: handleUnauthorized,
    onError: notifyError,
  });

  const loadPath = useCallback(
    async (
      targetPath: string,
      modeOverride?: StorageMode,
      s3ConnectedOverride?: boolean,
      s3ConfigIdOverride?: string | null
    ) => {
      setLoading(true);
      setError(null);
      setSelected(null);
      setPreview(null);
      setTextPreviewOpen(false);
      setImagePreviewPath(null);
      setImagePreviewName(null);
      setSelectedNames([]);
      setShowTrash(false);
      setDragActive(false);

      let activeMode = modeOverride ?? storageMode;
      const activeConfigId = s3ConfigIdOverride ?? activeS3ConfigId ?? routeS3ConfigId;
      const isS3Connected = Boolean(
        activeConfigId && s3Connection.configs.some((config) => config.id === activeConfigId)
      );
      const s3Connected = s3ConnectedOverride ?? isS3Connected;
      if (activeMode === "s3" && !s3Connected) {
        setError("Connect to S3 to continue.");
        setLoading(false);
        return false;
      }

      if (activeMode === "s3") {
        if (!activeConfigId) {
          setError("Select an S3 configuration.");
          setLoading(false);
          return false;
        }
        // S3 mode
        const params = new URLSearchParams({
          path: targetPath,
          configId: activeConfigId,
          limit: pageSize.toString(),
          offset: ((page - 1) * pageSize).toString(),
        });

        try {
          const response = await fetch(`${API_BASE}/s3/list?${params}`, {
            credentials: "include",
          });

          if (response.status === 401) {
            setAuth("logged_out");
            setLoading(false);
            return false;
          }

          if (!response.ok) {
            const data = await readJson(response);
            setError(data?.error ?? "Failed to load S3 directory.");
            setLoading(false);
            return false;
          }

          const data = await response.json();
          const mappedEntries = (data.entries || []).map((entry: any) => {
            const rawDate = entry.modified ?? entry.mtime;
            const parsed = rawDate ? new Date(rawDate).getTime() : Date.now();
            return {
              name: entry.name,
              type: entry.type === "directory" ? "dir" : "file",
              size: entry.size ?? 0,
              mtime: Number.isNaN(parsed) ? Date.now() : parsed,
            };
          });
          setEntries(mappedEntries);
          setPath(targetPath);
          setS3Paths((prev) => ({ ...prev, [activeConfigId]: targetPath }));
          if (data.user) {
            setUsername(data.user);
          }
          if (data.role) {
            setUserRole(data.role);
          }
          setAuth("authed");
          // Calculate parent path for S3
          const segments = targetPath.split("/").filter(Boolean);
          segments.pop();
          setParent(segments.length > 0 ? `/${segments.join("/")}` : null);
          setLoading(false);
          return true;
        } catch (err) {
          setError("Failed to load S3 directory.");
          setLoading(false);
          return false;
        }
      }

      // Local mode - existing code
      const response = await apiFetch(`/list?path=${encodeURIComponent(targetPath)}&limit=${pageSize}&offset=${(page - 1) * pageSize}`);
      if (response.status === 401) {
        setAuth("logged_out");
        setLoading(false);
        return false;
      }

      if (!response.ok) {
        const data = await readJson(response);
        setError(data?.error ?? "Failed to load directory.");
        setLoading(false);
        return false;
      }

      const data = (await response.json()) as ListResponse;
      setEntries(data.entries);
      setPath(data.path);
      setParent(data.parent);
      setUsername(data.user);
      setUserRole(data.role);
      setAuth("authed");
      setLoading(false);
      setStoredPath(data.path);
      return true;
    },
    [storageMode, s3Connection.configs, activeS3ConfigId, routeS3ConfigId, page, pageSize]
  );

  const loadTrash = useCallback(async () => {
    if (storageMode === "s3") {
      notifyError("Trash is not available for S3 storage.");
      return;
    }
    setLoading(true);
    setError(null);
    setSelected(null);
    setPreview(null);
    setTextPreviewOpen(false);
    setImagePreviewPath(null);
    setImagePreviewName(null);
    setSelectedNames([]);

    const response = await apiFetch("/trash");
    if (response.status === 401) {
      setAuth("logged_out");
      setLoading(false);
      return;
    }

    if (!response.ok) {
      const data = await readJson(response);
      setError(data?.error ?? "Failed to load trash.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as TrashResponse;
    setTrashItems(data.items ?? []);
    setUsername(data.user);
    setUserRole(data.role);
    setShowTrash(true);
    setAuth("authed");
    setLoading(false);
  }, [storageMode, notifyError]);

  const handleLogin = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);

      const response = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Login failed.");
        return;
      }

      setPassword("");
      setAuth("authed");
      pushToast("Signed in.", "success");
      loadPath("/");
    },
    [password, loginUsername, loadPath, notifyError, pushToast]
  );

  const resetEditorState = useCallback(() => {
    setEditorOpen(false);
    setEditorFile(null);
    setEditorContent("");
    setEditorInitialContent("");
    setEditorLoading(false);
    setEditorSaving(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await apiFetch("/logout", { method: "POST" });
    setAuth("logged_out");
    setEntries([]);
    setSelected(null);
    setPreview(null);
    setTextPreviewOpen(false);
    setImagePreviewPath(null);
    setImagePreviewName(null);
    resetEditorState();
    setSelectedNames([]);
    setClipboard(null);
    setShowTrash(false);
    setTrashItems([]);
    setUsername("");
    setUserRole("read-write");
    pushToast("Signed out.", "info");
  }, [pushToast, resetEditorState]);

  const openEditorByPath = useCallback(
    async (targetPath: string, targetName?: string) => {
      if (editorOpen && editorContent !== editorInitialContent) {
        const confirmClose = window.confirm("Discard unsaved changes?");
        if (!confirmClose) {
          return;
        }
      }

      setEditorLoading(true);
      setError(null);
      setEditorOpen(true);
      setEditorFile({
        name: targetName ?? targetPath.split("/").filter(Boolean).pop() ?? "untitled",
        path: targetPath,
        content: "",
        size: 0,
        mtime: Date.now(),
      });

      const response = await apiFetch(`/edit?path=${encodeURIComponent(targetPath)}`);

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Failed to open editor.");
        setEditorLoading(false);
        return;
      }

      const data = (await response.json()) as EditorFile;
      setEditorFile(data);
      setEditorContent(data.content);
      setEditorInitialContent(data.content);
      setEditorLoading(false);
    },
    [editorOpen, editorContent, editorInitialContent, notifyError]
  );

  const handleEntryClick = useCallback(
    (entry: Entry) => {
      if (entry.type === "dir") {
        loadPath(joinPath(path, entry.name));
      } else {
        setSelected(entry);
        setPreview(null);
        setTextPreviewOpen(false);
        setImagePreviewPath(null);
        setImagePreviewName(null);
        if (isTextEditableName(entry.name)) {
          void openEditorByPath(joinPath(path, entry.name), entry.name);
          return;
        }
        if (isImagePreviewable(entry.name)) {
          setImagePreviewPath(joinPath(path, entry.name));
          setImagePreviewName(entry.name);
        }
      }
    },
    [path, loadPath, openEditorByPath]
  );

  const handlePreview = useCallback(async () => {
    if (!selected || selected.type !== "file") {
      return;
    }
    if (!isTextPreviewableName(selected.name)) {
      notifyError("Preview available for .txt, .php, .js, .html only.");
      return;
    }

    setPreviewLoading(true);
    setError(null);

    const response = await apiFetch(
      `/preview?path=${encodeURIComponent(joinPath(path, selected.name))}`
    );

    if (!response.ok) {
      const data = await readJson(response);
      notifyError(data?.error ?? "Preview failed.");
      setPreviewLoading(false);
      return;
    }

    const data = (await response.json()) as Preview;
    setPreview(data);
    setTextPreviewOpen(true);
    setPreviewLoading(false);
  }, [path, selected, notifyError]);

  const handleImagePreview = useCallback(() => {
    if (!selected || selected.type !== "file") {
      return;
    }
    if (!isImagePreviewable(selected.name)) {
      notifyError("Image preview not available for this file type.");
      return;
    }
    setImagePreviewPath(joinPath(path, selected.name));
    setImagePreviewName(selected.name);
  }, [path, selected, notifyError]);

  const closeImagePreview = useCallback(() => {
    setImagePreviewPath(null);
    setImagePreviewName(null);
  }, []);

  const closeTextPreview = useCallback(() => {
    setPreview(null);
    setTextPreviewOpen(false);
  }, []);

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => selectedNames.includes(entry.name));
  }, [entries, selectedNames]);

  const selectionTargets = selectedEntries;
  const selectionCount = selectedEntries.length;
  const canWrite = userRole !== "read-only";
  const editTarget = selectionTargets.length === 1 ? selectionTargets[0] : null;
  const canEditTarget =
    !showTrash &&
    editTarget?.type === "file" &&
    isTextEditableName(editTarget.name);
  const editDisabled =
    actionLoading || editorLoading || editorSaving || !canWrite || !canEditTarget;

  const refreshView = useCallback(async () => {
    if (showTrash) {
      await loadTrash();
    } else {
      await loadPath(path);
    }
  }, [showTrash, loadTrash, loadPath, path]);

  const closeEditor = useCallback(() => {
    if (editorOpen && editorContent !== editorInitialContent) {
      const confirmClose = window.confirm("Discard unsaved changes?");
      if (!confirmClose) {
        return;
      }
    }
    resetEditorState();
  }, [editorOpen, editorContent, editorInitialContent, resetEditorState]);

  const handleOpenEditor = useCallback(async () => {
    if (!editTarget || editTarget.type !== "file") {
      notifyError("Select a single file to edit.");
      return;
    }
    if (!isTextEditableName(editTarget.name)) {
      notifyError("Editor supports common web file types only.");
      return;
    }

    await openEditorByPath(joinPath(path, editTarget.name), editTarget.name);
  }, [editTarget, path, notifyError, openEditorByPath]);

  const openEditorInNewTab = useCallback(() => {
    if (!editorFile || typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("edit", editorFile.path);
    const next = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (next) {
      next.opener = null;
    }
  }, [editorFile]);

  const handleSaveEditor = useCallback(async () => {
    if (!editorFile) {
      return;
    }
    if (!canWrite) {
      notifyError("Read-only account.");
      return;
    }

    setEditorSaving(true);
    setError(null);

    const response = await apiFetch("/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: editorFile.path, content: editorContent }),
    });

    if (!response.ok) {
      const data = await readJson(response);
      notifyError(data?.error ?? "Save failed.");
      setEditorSaving(false);
      return;
    }

    setEditorInitialContent(editorContent);
    setEditorSaving(false);
    pushToast("File saved.", "success");
    await refreshView();
  }, [editorFile, editorContent, canWrite, notifyError, pushToast, refreshView]);

  const handleImageError = useCallback(() => {
    notifyError("Image preview failed to load.");
    closeImagePreview();
  }, [notifyError, closeImagePreview]);

  const handleClearSelection = useCallback(() => {
    setSelectedNames([]);
    setSelected(null);
    setPreview(null);
    setTextPreviewOpen(false);
    setImagePreviewPath(null);
    setImagePreviewName(null);
  }, []);

  const requireWrite = useCallback(() => {
    if (!canWrite) {
      notifyError("Read-only account.");
      return false;
    }
    return true;
  }, [canWrite, notifyError]);

  const toggleSelect = useCallback((entry: Entry) => {
    setSelectedNames((prev) =>
      prev.includes(entry.name) ? prev.filter((name) => name !== entry.name) : [...prev, entry.name]
    );
  }, []);

  const handleUploadClick = useCallback(() => {
    if (showTrash || !requireWrite()) {
      return;
    }
    fileInputRef.current?.click();
  }, [showTrash, requireWrite]);

  const uploadFiles = useCallback(
    async (files: File[], overwrite = false) => {
      if (!canWrite) {
        notifyError("Read-only account.");
        return;
      }
      if (storageMode === "s3") {
        const isConnected = Boolean(
          activeS3ConfigId && s3Connection.configs.some((config) => config.id === activeS3ConfigId)
        );
        if (!isConnected) {
          notifyError("Connect to S3 before uploading.");
          return;
        }
      }
      if (files.length === 0) {
        return;
      }
      setActionLoading(true);
      setError(null);

      if (storageMode === "s3") {
        if (!activeS3ConfigId) {
          notifyError("Select an S3 configuration.");
          setActionLoading(false);
          return;
        }
        const targetPath = path.endsWith("/") ? path : `${path}/`;
        for (const file of files) {
          const result = await s3Api.s3Upload(activeS3ConfigId, file, targetPath);
          if (result?.error) {
            notifyError(result.error ?? "Upload failed.");
            setActionLoading(false);
            return;
          }
        }
        await refreshView();
        setActionLoading(false);
        pushToast(`Uploaded ${files.length} file(s).`, "success");
        return;
      }

      const form = new FormData();
      form.set("path", path);
      if (overwrite) {
        form.set("overwrite", "1");
      }
      for (const file of files) {
        form.append("files", file, file.name);
      }

      const response = await apiFetch("/upload", {
        method: "POST",
        body: form,
      });

      if (response.status === 409 && !overwrite) {
        const data = await readJson(response);
        setActionLoading(false);
        if (window.confirm(`${data?.error ?? "File exists."} Overwrite?`)) {
          await uploadFiles(files, true);
        }
        return;
      }

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Upload failed.");
        setActionLoading(false);
        return;
      }

      await refreshView();
      setActionLoading(false);
      pushToast(`Uploaded ${files.length} file(s).`, "success");
    },
    [path, refreshView, canWrite, notifyError, pushToast, storageMode, s3Connection.configs, activeS3ConfigId]
  );

  const handleUploadChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      await uploadFiles(files);
      event.target.value = "";
    },
    [uploadFiles]
  );

  const handleCreateFolder = useCallback(async () => {
    if (!requireWrite()) {
      return;
    }
    const name = window.prompt("New folder name");
    if (!name) {
      return;
    }
    setActionLoading(true);
    setError(null);

    if (storageMode === "s3") {
      const isConnected = Boolean(
        activeS3ConfigId && s3Connection.configs.some((config) => config.id === activeS3ConfigId)
      );
      if (!isConnected) {
        notifyError("Connect to S3 before creating folders.");
        setActionLoading(false);
        return;
      }
      if (!activeS3ConfigId) {
        notifyError("Select an S3 configuration.");
        setActionLoading(false);
        return;
      }
      const targetPath = joinPath(path, name);
      const result = await s3Api.s3Mkdir(activeS3ConfigId, targetPath);
      if (result?.error) {
        notifyError(result.error ?? "Failed to create folder.");
        setActionLoading(false);
        return;
      }
    } else {
      const response = await apiFetch("/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, name }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Failed to create folder.");
        setActionLoading(false);
        return;
      }
    }

    await refreshView();
    setActionLoading(false);
    pushToast("Folder created.", "success");
  }, [path, refreshView, requireWrite, notifyError, pushToast, storageMode, s3Connection.configs, activeS3ConfigId]);

  const handleRename = useCallback(async () => {
    if (!requireWrite()) {
      return;
    }
    const renameTarget = selectionTargets.length === 1 ? selectionTargets[0] : null;
    if (!renameTarget) {
      notifyError("Select a single item to rename.");
      return;
    }
    const name = window.prompt("Rename to", renameTarget.name);
    if (!name || name === renameTarget.name) {
      return;
    }
    setActionLoading(true);
    setError(null);

    const response = await apiFetch("/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: joinPath(path, renameTarget.name),
        to: joinPath(path, name),
      }),
    });

    if (!response.ok) {
      const data = await readJson(response);
      notifyError(data?.error ?? "Rename failed.");
      setActionLoading(false);
      return;
    }

    await refreshView();
    setActionLoading(false);
    pushToast("Item renamed.", "success");
  }, [path, selectionTargets, refreshView, requireWrite, notifyError, pushToast]);

  const handleMove = useCallback(async () => {
    if (!requireWrite()) {
      return;
    }
    if (selectionTargets.length === 0) {
      notifyError("Select items to move.");
      return;
    }
    const destination = window.prompt("Move to folder (absolute or relative path)", path);
    if (!destination) {
      return;
    }
    const targetFolder = normalizeInputPath(destination, path);

    setActionLoading(true);
    setError(null);

    for (const entry of selectionTargets) {
      const response = await apiFetch("/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: joinPath(path, entry.name),
          to: joinPath(targetFolder, entry.name),
        }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Move failed.");
        setActionLoading(false);
        return;
      }
    }

    await refreshView();
    setActionLoading(false);
    pushToast(`Moved ${selectionTargets.length} item(s).`, "success");
  }, [path, selectionTargets, refreshView, requireWrite, notifyError, pushToast]);

  const handleCopy = useCallback(() => {
    if (selectionTargets.length === 0) {
      notifyError("Select items to copy.");
      return;
    }
    const items = selectionTargets.map((entry) => ({
      name: entry.name,
      path: joinPath(path, entry.name),
    }));
    setClipboard(items);
    pushToast(`Copied ${items.length} item(s).`, "info");
  }, [path, selectionTargets, notifyError, pushToast]);

  const handlePaste = useCallback(async () => {
    if (!requireWrite()) {
      return;
    }
    if (!clipboard || clipboard.length === 0) {
      notifyError("Clipboard is empty.");
      return;
    }
    setActionLoading(true);
    setError(null);

    for (const item of clipboard) {
      const response = await apiFetch("/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: item.path,
          to: joinPath(path, item.name),
        }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Copy failed.");
        setActionLoading(false);
        return;
      }
    }

    await refreshView();
    setActionLoading(false);
    pushToast(`Pasted ${clipboard.length} item(s).`, "success");
  }, [clipboard, path, refreshView, requireWrite, notifyError, pushToast]);

  const handleDelete = useCallback(async () => {
    if (!requireWrite()) {
      return;
    }
    if (selectionTargets.length === 0) {
      notifyError("Select items to delete.");
      return;
    }
    const confirmation = window.confirm(
      storageMode === "s3"
        ? `Permanently delete ${selectionTargets.length} item(s)?`
        : `Move ${selectionTargets.length} item(s) to Trash?`
    );
    if (!confirmation) {
      return;
    }
    setActionLoading(true);
    setError(null);

    if (storageMode === "s3") {
      const isConnected = Boolean(
        activeS3ConfigId && s3Connection.configs.some((config) => config.id === activeS3ConfigId)
      );
      if (!isConnected) {
        notifyError("Connect to S3 before deleting.");
        setActionLoading(false);
        return;
      }
      if (!activeS3ConfigId) {
        notifyError("Select an S3 configuration.");
        setActionLoading(false);
        return;
      }
      for (const entry of selectionTargets) {
        const result = await s3Api.s3Delete(activeS3ConfigId, joinPath(path, entry.name));
        if (result?.error) {
          notifyError(result.error ?? "Delete failed.");
          setActionLoading(false);
          return;
        }
      }

      await refreshView();
      setActionLoading(false);
      pushToast(`Deleted ${selectionTargets.length} item(s).`, "success");
      return;
    }

    for (const entry of selectionTargets) {
      const response = await apiFetch("/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: joinPath(path, entry.name) }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Delete failed.");
        setActionLoading(false);
        return;
      }
    }

    await refreshView();
    setActionLoading(false);
    pushToast(`Moved ${selectionTargets.length} item(s) to trash.`, "success");
  }, [path, selectionTargets, refreshView, requireWrite, notifyError, pushToast, storageMode, s3Connection.configs, activeS3ConfigId]);

  const archiveHref = useMemo(() => {
    if (selectionTargets.length === 0) {
      return null;
    }
    const params = new URLSearchParams();
    for (const entry of selectionTargets) {
      params.append("path", joinPath(path, entry.name));
    }
    params.set("format", "zip");
    return `${API_BASE}/archive?${params.toString()}`;
  }, [path, selectionTargets]);

  const handleArchiveClick = useCallback(() => {
    if (selectionTargets.length === 0) {
      notifyError("Select items to zip.");
      return;
    }
    pushToast("Zip download started.", "info");
  }, [selectionTargets, notifyError, pushToast]);

  const handleRestore = useCallback(
    async (item: TrashItem) => {
      if (!requireWrite()) {
        return;
      }
      setActionLoading(true);
      setError(null);
      const response = await apiFetch("/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });

      if (!response.ok) {
        const data = await readJson(response);
        notifyError(data?.error ?? "Restore failed.");
        setActionLoading(false);
        return;
      }

      await loadTrash();
      setActionLoading(false);
      pushToast(`Restored ${item.name}.`, "success");
    },
    [loadTrash, requireWrite, notifyError, pushToast]
  );

  const handleToggleTrash = useCallback(() => {
    if (storageMode === "s3") {
      notifyError("Trash is not available for S3 storage.");
      return;
    }
    if (showTrash) {
      loadPath(path);
    } else {
      loadTrash();
    }
  }, [showTrash, loadPath, loadTrash, path, storageMode, notifyError]);

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (showTrash || !canWrite) {
        return;
      }
      event.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    },
    [showTrash, canWrite]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (showTrash || !canWrite) {
        return;
      }
      event.preventDefault();
    },
    [showTrash, canWrite]
  );

  const handleDragLeave = useCallback(() => {
    if (dragDepth.current === 0) {
      return;
    }
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (showTrash || !canWrite) {
        return;
      }
      event.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      const files = Array.from(event.dataTransfer.files);
      await uploadFiles(files);
    },
    [showTrash, uploadFiles, canWrite]
  );

  const handleClearFilters = useCallback(() => {
    setTypeFilter("all");
    setSizeMinMb("");
    setSizeMaxMb("");
    setDateFilter("any");
    setSortMode("default");
    setContentSearch(false);
    resetContentSearch();
  }, [resetContentSearch]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const hasQuery = trimmed.length > 0;
    const minBytes = parseSizeInput(sizeMinMb);
    const maxBytes = parseSizeInput(sizeMaxMb);
    const dateRange = DATE_RANGE_MS[dateFilter];
    const now = Date.now();

    let results = entries.filter((entry) => {
      if (hasQuery) {
        const nameMatch = entry.name.toLowerCase().includes(trimmed);
        const contentMatch =
          contentSearch && contentMatches.size > 0 && contentMatches.has(entry.name);
        if (contentSearch) {
          if (!nameMatch && !contentMatch) {
            return false;
          }
        } else if (!nameMatch) {
          return false;
        }
      }

      if (!matchesTypeFilter(entry, typeFilter)) {
        return false;
      }

      if (entry.type === "file") {
        if (minBytes !== null && entry.size < minBytes) {
          return false;
        }
        if (maxBytes !== null && entry.size > maxBytes) {
          return false;
        }
      }

      if (dateRange !== null && now - entry.mtime > dateRange) {
        return false;
      }

      return true;
    });

    return sortEntries(results, sortMode);
  }, [
    entries,
    query,
    typeFilter,
    sizeMinMb,
    sizeMaxMb,
    dateFilter,
    sortMode,
    contentSearch,
    contentMatches,
  ]);

  const totalItems = showTrash ? trashItems.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;

  const pagedEntries = useMemo(() => {
    if (showTrash) {
      return [];
    }
    return filtered.slice(pageStart, pageEnd);
  }, [showTrash, filtered, pageStart, pageEnd]);

  const pagedTrashItems = useMemo(() => {
    if (!showTrash) {
      return trashItems;
    }
    return trashItems.slice(pageStart, pageEnd);
  }, [showTrash, trashItems, pageStart, pageEnd]);

  const selectedNameSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const filteredNames = useMemo(() => filtered.map((entry) => entry.name), [filtered]);
  const filteredNameSet = useMemo(() => new Set(filteredNames), [filteredNames]);

  const allSelected =
    filteredNames.length > 0 && filteredNames.every((name) => selectedNameSet.has(name));

  const toggleSelectAll = useCallback(() => {
    setSelectedNames((prev) => {
      if (filteredNames.length === 0) {
        return prev;
      }
      const prevSet = new Set(prev);
      const hasAll = filteredNames.every((name) => prevSet.has(name));
      if (hasAll) {
        return prev.filter((name) => !filteredNameSet.has(name));
      }
      const merged = new Set(prev);
      for (const name of filteredNames) {
        merged.add(name);
      }
      return Array.from(merged);
    });
  }, [filteredNames, filteredNameSet]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const clamped = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(clamped);
    },
    [totalPages]
  );

  const handlePageSizeChange = useCallback((nextSize: number) => {
    setPageSize(nextSize);
    setPage(1);
  }, []);

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [page, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [path, showTrash]);

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    if (path === "/") {
      return [{ label: "Home", path: "/" }];
    }

    const parts = path.split("/").filter(Boolean);
    const crumbs: Breadcrumb[] = [{ label: "Home", path: "/" }];
    let current = "";
    for (const part of parts) {
      current = `${current}/${part}`;
      crumbs.push({ label: part, path: current });
    }
    return crumbs;
  }, [path]);
  const currentPathLabel = breadcrumbs[breadcrumbs.length - 1]?.label ?? "Home";
  const imageBasePath = storageMode === "s3" ? `${API_BASE}/s3/image` : `${API_BASE}/image`;
  const imageConfigId = storageMode === "s3" ? activeS3ConfigId : null;

  const filtersActive =
    typeFilter !== "all" ||
    sizeMinMb !== "" ||
    sizeMaxMb !== "" ||
    dateFilter !== "any" ||
    sortMode !== "default" ||
    contentSearch;

  const showS3SettingsPage =
    auth === "authed" &&
    userRole === "admin" &&
    (route === "s3-settings" ||
      (typeof window !== "undefined" && window.location.pathname === "/s3-settings"));

  const refreshS3Connections = useCallback(async () => {
    try {
      const response = await s3Api.s3ListConnections();
      if (response?.user) {
        setUsername(response.user);
      }
      if (response?.role) {
        setUserRole(response.role);
        setAuth("authed");
      }
      setS3Connection({
        connected: Boolean(response?.connected),
        configs: response?.configs ?? [],
        maxConnections: response?.maxConnections,
      });
      return response;
    } catch {
      setS3Connection({ connected: false, configs: [] });
      return null;
    }
  }, []);

  const setFilesRoute = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
    }
    setRoute("files");
    setRouteS3ConfigId(null);
  }, []);

  const setS3Route = useCallback((configId: string | null) => {
    if (typeof window !== "undefined") {
      const target = configId ? `/s3/${configId}` : "/s3";
      window.history.pushState(null, "", target);
    }
    setRoute("s3");
    setRouteS3ConfigId(configId);
  }, []);

  const switchToLocal = useCallback(() => {
    setPendingS3Connect(false);
    setStorageMode("local");
    setActiveS3ConfigId(null);
    setPath("/");
    setPage(1);
    setSelected(null);
    setSelectedNames([]);
    setFilesRoute();
    void loadPath("/", "local");
  }, [loadPath, setFilesRoute]);

  const switchToS3 = useCallback(
    (configId: string) => {
      setPendingS3Connect(false);
      setStorageMode("s3");
      setActiveS3ConfigId(configId);
      setPath("/");
      setPage(1);
      setSelected(null);
      setSelectedNames([]);
      setS3Route(configId);
      const nextPath = s3Paths[configId] ?? "/";
      void loadPath(nextPath, "s3", true, configId);
    },
    [loadPath, setS3Route, s3Paths]
  );

  const handleStorageModeChange = useCallback(
    (mode: StorageMode) => {
      if (mode === "local") {
        switchToLocal();
        return;
      }
      setPendingS3Connect(true);
      refreshS3Connections().then((response) => {
        const configs = (response?.configs ?? s3Connection.configs) as S3Config[];
        const nextId = activeS3ConfigId ?? routeS3ConfigId ?? configs[0]?.id;
        if (nextId && configs.some((config) => config.id === nextId)) {
          switchToS3(nextId);
          return;
        }
        setShowS3Connection(true);
      });
    },
    [activeS3ConfigId, routeS3ConfigId, refreshS3Connections, s3Connection.configs, switchToLocal, switchToS3]
  );

  useEffect(() => {
    if (auth !== "authed") {
      return;
    }
    if (route === "s3") {
      const nextId = routeS3ConfigId ?? activeS3ConfigId;
      if (nextId && s3Connection.configs.some((config) => config.id === nextId)) {
        if (storageMode !== "s3" || activeS3ConfigId !== nextId) {
          switchToS3(nextId);
        }
        return;
      }
      setPendingS3Connect(true);
      setShowS3Connection(true);
      return;
    }
    if (route === "files" && storageMode !== "local") {
      switchToLocal();
    }
  }, [route, routeS3ConfigId, activeS3ConfigId, s3Connection.configs, storageMode, auth, switchToS3, switchToLocal]);

  useEffect(() => {
    if (!activeS3ConfigId) {
      return;
    }
    const stillConnected = s3Connection.configs.some((config) => config.id === activeS3ConfigId);
    if (stillConnected) {
      return;
    }
    const inSettings =
      route === "s3-settings" ||
      (typeof window !== "undefined" && window.location.pathname === "/s3-settings");
    const fallbackConfigId = s3Connection.configs[0]?.id ?? null;
    setActiveS3ConfigId(null);
    setRouteS3ConfigId(null);
    setEntries([]);
    setPath("/");
    setParent(null);

    if (inSettings) {
      setPendingS3Connect(false);
      setShowS3Connection(false);
      setStorageMode("local");
      setRoute("s3-settings");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("storageMode", "local");
      }
      if (typeof window !== "undefined" && window.location.pathname !== "/s3-settings") {
        window.history.replaceState(null, "", "/s3-settings");
      }
      pushToast("Active S3 config was deactivated.", "info");
      return;
    }

    if (route === "s3") {
      if (fallbackConfigId) {
        switchToS3(fallbackConfigId);
        pushToast("Active S3 config was deactivated. Switched to another connection.", "info");
        return;
      }
      switchToLocal();
      pushToast("Active S3 config was deactivated. Switched to local files.", "error");
      return;
    }

    if (storageMode === "s3") {
      setPendingS3Connect(false);
      setShowS3Connection(false);
      if (route === "s3-settings") {
        setStorageMode("local");
        void loadPath("/", "local");
      } else {
        switchToLocal();
      }
    }

    pushToast("Active S3 config was deactivated.", "info");
  }, [activeS3ConfigId, s3Connection.configs, route, storageMode, pushToast, switchToLocal, switchToS3]);

  useKeyboardShortcuts({
    enabled: SHORTCUTS_ENABLED && !showS3SettingsPage,
    showTrash,
    selectionTargets,
    handlers: {
      onSelectAll: toggleSelectAll,
      onCopy: handleCopy,
      onPaste: handlePaste,
      onCreateFolder: handleCreateFolder,
      onUpload: handleUploadClick,
      onEdit: handleOpenEditor,
      onRename: handleRename,
      onDelete: handleDelete,
      onToggleTrash: handleToggleTrash,
      onOpenSelection: handleEntryClick,
      onClearSelection: handleClearSelection,
    },
  });

  useEffect(() => {
    if (auth !== "unknown") {
      return;
    }
    const initialPath = getStoredPath() ?? "/";
    const loadInitialPath = async () => {
      if (route === "s3" || storageMode === "s3") {
        if (route !== "s3") {
          setRoute("s3");
          setRouteS3ConfigId(routeS3ConfigId ?? null);
          if (typeof window !== "undefined") {
            const target = routeS3ConfigId ? `/s3/${routeS3ConfigId}` : "/s3";
            window.history.replaceState(null, "", target);
          }
        }
        const response = await refreshS3Connections();
        const configs = (response?.configs ?? []) as S3Config[];
        const nextId = routeS3ConfigId ?? activeS3ConfigId ?? configs[0]?.id ?? null;
        if (nextId && configs.some((config) => config.id === nextId)) {
          switchToS3(nextId);
          return;
        }
        setStorageMode("s3");
        setPendingS3Connect(true);
        setShowS3Connection(true);
        return;
      }
      const ok = await loadPath(initialPath);
      if (!ok && initialPath !== "/") {
        clearStoredPath();
        await loadPath("/");
      }
    };
    void loadInitialPath();
  }, [auth, activeS3ConfigId, loadPath, refreshS3Connections, route, routeS3ConfigId, storageMode, switchToS3]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const editPath = params.get("edit");
    if (editPath) {
      setPendingEditorPath(editPath);
    }
  }, []);

  useEffect(() => {
    if (auth !== "authed" || !pendingEditorPath) {
      return;
    }
    void openEditorByPath(pendingEditorPath);
    setPendingEditorPath(null);
  }, [auth, pendingEditorPath, openEditorByPath]);

  useEffect(() => {
    if (auth === "logged_out") {
      resetEditorState();
    }
  }, [auth, resetEditorState]);

  useEffect(() => {
    setStoredViewMode(viewMode);
  }, [viewMode]);

  // Sync storage mode to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("storageMode", storageMode);
    } catch { }
  }, [storageMode]);

  // Sync S3 connection status
  useEffect(() => {
    if (auth === "authed") {
      void refreshS3Connections();
      return;
    }
    setS3Connection({ connected: false, configs: [] });
  }, [auth, refreshS3Connections]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      if (window.location.pathname === "/s3-settings") {
        setRoute("s3-settings");
        setRouteS3ConfigId(null);
      } else if (window.location.pathname.startsWith("/s3/")) {
        const [, , configId] = window.location.pathname.split("/");
        setRoute("s3");
        setRouteS3ConfigId(configId || null);
      } else if (window.location.pathname === "/s3") {
        setRoute("s3");
        setRouteS3ConfigId(null);
      } else {
        setRoute("files");
        setRouteS3ConfigId(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (auth === "authed" && route === "s3-settings" && userRole !== "admin") {
      setRoute("files");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/");
      }
    }
  }, [route, userRole, auth]);

  const navigateToFiles = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/");
    }
    setRoute("files");
    setRouteS3ConfigId(null);
  }, []);

  const navigateToS3Settings = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", "/s3-settings");
    }
    setRoute("s3-settings");
    setRouteS3ConfigId(null);
  }, []);

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Toasts toasts={toasts} />
      <EditorModal
        open={editorOpen}
        file={editorFile}
        dirty={editorOpen && editorContent !== editorInitialContent}
        loading={editorLoading}
        saving={editorSaving}
        canWrite={canWrite}
        onOpenInNewTab={openEditorInNewTab}
        onChange={setEditorContent}
        onSave={handleSaveEditor}
        onClose={closeEditor}
      />
      <ImagePreviewModal
        path={imagePreviewPath}
        name={imagePreviewName}
        imageBasePath={imageBasePath}
        imageConfigId={imageConfigId}
        onClose={closeImagePreview}
        onError={handleImageError}
      />
      <TextPreviewModal preview={preview} open={textPreviewOpen} onClose={closeTextPreview} />
      <div className="shell">
        <Header
          auth={auth}
          username={username}
          userRole={userRole}
          theme={theme}
          showTrash={showTrash}
          filtersOpen={filtersOpen}
          filtersActive={filtersActive}
          typeFilter={typeFilter}
          sizeMinMb={sizeMinMb}
          sizeMaxMb={sizeMaxMb}
          dateFilter={dateFilter}
          onThemeChange={setTheme}
          onLogout={handleLogout}
          onToggleFilters={() => setFiltersOpen((prev) => !prev)}
          onTypeFilterChange={setTypeFilter}
          onSizeMinChange={setSizeMinMb}
          onSizeMaxChange={setSizeMaxMb}
          onDateFilterChange={setDateFilter}
          onClearFilters={handleClearFilters}
          onOpenS3Settings={navigateToS3Settings}
          onNavigateHome={() => {
            navigateToFiles();
            loadPath("/");
          }}
        />

        {auth === "authed" && (
          <StorageSwitcher
            mode={storageMode}
            onModeChange={handleStorageModeChange}
            onSelectS3={(configId) => {
              if (!s3Connection.configs.some((config) => config.id === configId)) {
                setPendingS3Connect(true);
                setShowS3Connection(true);
                setRouteS3ConfigId(configId);
                return;
              }
              switchToS3(configId);
            }}
            onAddS3={() => {
              setPendingS3Connect(false);
              setShowS3Connection(true);
            }}
            s3Configs={s3Connection.configs}
            activeS3ConfigId={activeS3ConfigId}
            maxS3Connections={s3Connection.maxConnections}
          />
        )}

        {auth === "logged_out" ? (
          <LoginForm
            loginUsername={loginUsername}
            password={password}
            error={error}
            onUsernameChange={setLoginUsername}
            onPasswordChange={setPassword}
            onSubmit={handleLogin}
          />
        ) : (
          <div className="stack">
            {showS3SettingsPage ? (
              <S3SettingsPage
                onBack={navigateToFiles}
                onToast={pushToast}
                onConfigsChanged={refreshS3Connections}
              />
            ) : (
              <>
                <Toolbar
                  query={query}
                  currentPathLabel={currentPathLabel}
                  onQueryChange={setQuery}
                  onUp={() => parent && loadPath(parent)}
                  onRefresh={() => loadPath(path)}
                  onUploadClick={handleUploadClick}
                  onCreateFolder={handleCreateFolder}
                  onToggleTrash={handleToggleTrash}
                  showTrash={showTrash}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  showEdit={canEditTarget}
                  editDisabled={editDisabled}
                  editLoading={editorLoading}
                  onEdit={handleOpenEditor}
                  actionLoading={actionLoading}
                  canWrite={canWrite}
                  selectionCount={selectionCount}
                  clipboardCount={clipboard?.length ?? 0}
                  archiveHref={archiveHref}
                  parent={parent}
                  fileInputRef={fileInputRef}
                  onUploadChange={handleUploadChange}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  onRename={handleRename}
                  onMove={handleMove}
                  onArchiveClick={handleArchiveClick}
                  onDelete={handleDelete}
                  onClearSelection={handleClearSelection}
                />

                <div className=" py-2 px-1 flex items-center">
                  <div className="breadcrumbs">
                    <button
                      type="button"
                      className="crumb crumb-home"
                      onClick={() => loadPath("/")}
                      aria-label="Back to Home"
                    >
                      <Home size={16} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                    {breadcrumbs.map((crumb, index) => (
                      <button
                        key={crumb.path}
                        type="button"
                        className="crumb"
                        onClick={() => loadPath(crumb.path)}
                      >
                        {crumb.label}
                        {index < breadcrumbs.length - 1 ? <span>/</span> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <FileList
                  showTrash={showTrash}
                  loading={loading}
                  trashItems={pagedTrashItems}
                  filtered={pagedEntries}
                  path={path}
                  viewMode={viewMode}
                  selectedNames={selectedNames}
                  allSelected={allSelected}
                  dragActive={dragActive}
                  actionLoading={actionLoading}
                  canWrite={canWrite}
                  sortMode={sortMode}
                  imageBasePath={imageBasePath}
                  imageConfigId={imageConfigId}
                  onSortModeChange={setSortMode}
                  pagination={{
                    page,
                    pageSize,
                    totalItems,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange,
                  }}
                  showPaginationTop
                  onToggleSelectAll={toggleSelectAll}
                  onToggleSelect={toggleSelect}
                  onEntryClick={handleEntryClick}
                  onRestore={handleRestore}
                />
              </>
            )}
          </div>
        )}
      </div>

      <S3ConnectionModal
        isOpen={showS3Connection}
        onClose={() => {
          setShowS3Connection(false);
          setPendingS3Connect(false);
        }}
        initialConfigId={routeS3ConfigId}
        onConnected={async (configId) => {
          const response = await refreshS3Connections();
          const nextId = configId ?? routeS3ConfigId ?? response?.configs?.[0]?.id ?? null;
          if (nextId) {
            switchToS3(nextId);
          } else if (storageMode !== "local" || pendingS3Connect) {
            switchToLocal();
          }
          setPendingS3Connect(false);
        }}
        userRole={userRole}
        onOpenS3Settings={() => {
          setShowS3Connection(false);
          navigateToS3Settings();
        }}
      />

      <Footer />
    </div>
  );
}
