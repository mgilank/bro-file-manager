import { Home } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Header } from "./components/Header";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { LoginForm } from "./components/LoginForm";
import { FileList } from "./components/FileList";
import { TextPreviewModal } from "./components/TextPreviewModal";
import { Toasts } from "./components/Toasts";
import { Toolbar } from "./components/Toolbar";
import {
  API_BASE,
  DATE_RANGE_MS,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SHORTCUTS_ENABLED,
} from "./constants";
import { useContentSearch } from "./hooks/useContentSearch";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTheme } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { apiFetch, readJson } from "./services/api";
import type {
  AuthState,
  Breadcrumb,
  ClipboardItem,
  DateFilter,
  Entry,
  ListResponse,
  Preview,
  SortMode,
  TrashItem,
  TrashResponse,
  TypeFilter,
  UserRole,
} from "./types";
import { parseSizeInput } from "./utils/filters";
import { isImagePreviewable, isTextPreviewableName, matchesTypeFilter } from "./utils/fileTypes";
import { joinPath, normalizeInputPath } from "./utils/path";
import { sortEntries } from "./utils/sort";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("unknown");
  const [path, setPath] = useState("/");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadPath = useCallback(async (targetPath: string) => {
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

    const response = await apiFetch(`/list?path=${encodeURIComponent(targetPath)}`);
    if (response.status === 401) {
      setAuth("logged_out");
      setLoading(false);
      return;
    }

    if (!response.ok) {
      const data = await readJson(response);
      setError(data?.error ?? "Failed to load directory.");
      setLoading(false);
      return;
    }

    const data = (await response.json()) as ListResponse;
    setEntries(data.entries);
    setPath(data.path);
    setParent(data.parent);
    setUsername(data.user);
    setUserRole(data.role);
    setAuth("authed");
    setLoading(false);
  }, []);

  const loadTrash = useCallback(async () => {
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
  }, []);

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

  const handleLogout = useCallback(async () => {
    await apiFetch("/logout", { method: "POST" });
    setAuth("logged_out");
    setEntries([]);
    setSelected(null);
    setPreview(null);
    setTextPreviewOpen(false);
    setImagePreviewPath(null);
    setImagePreviewName(null);
    setSelectedNames([]);
    setClipboard(null);
    setShowTrash(false);
    setTrashItems([]);
    setUsername("");
    setUserRole("read-write");
    pushToast("Signed out.", "info");
  }, [pushToast]);

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
        if (isImagePreviewable(entry.name)) {
          setImagePreviewPath(joinPath(path, entry.name));
          setImagePreviewName(entry.name);
        }
      }
    },
    [path, loadPath]
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

  const refreshView = useCallback(async () => {
    if (showTrash) {
      await loadTrash();
    } else {
      await loadPath(path);
    }
  }, [showTrash, loadTrash, loadPath, path]);

  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => selectedNames.includes(entry.name));
  }, [entries, selectedNames]);

  const selectionTargets = selectedEntries.length > 0 ? selectedEntries : selected ? [selected] : [];
  const selectionCount = selectionTargets.length;
  const canWrite = userRole !== "read-only";

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
      if (files.length === 0) {
        return;
      }
      setActionLoading(true);
      setError(null);

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
    [path, refreshView, canWrite, notifyError, pushToast]
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

    await refreshView();
    setActionLoading(false);
    pushToast("Folder created.", "success");
  }, [path, refreshView, requireWrite, notifyError, pushToast]);

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
    const confirmation = window.confirm(`Move ${selectionTargets.length} item(s) to Trash?`);
    if (!confirmation) {
      return;
    }
    setActionLoading(true);
    setError(null);

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
  }, [path, selectionTargets, refreshView, requireWrite, notifyError, pushToast]);

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
    if (showTrash) {
      loadPath(path);
    } else {
      loadTrash();
    }
  }, [showTrash, loadPath, loadTrash, path]);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (showTrash || !canWrite) {
        return;
      }
      event.preventDefault();
      setDragActive(true);
    },
    [showTrash, canWrite]
  );

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (showTrash || !canWrite) {
        return;
      }
      event.preventDefault();
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

  const filtersActive =
    typeFilter !== "all" ||
    sizeMinMb !== "" ||
    sizeMaxMb !== "" ||
    dateFilter !== "any" ||
    sortMode !== "default" ||
    contentSearch;

  useKeyboardShortcuts({
    enabled: SHORTCUTS_ENABLED,
    showTrash,
    selectionTargets,
    handlers: {
      onSelectAll: toggleSelectAll,
      onCopy: handleCopy,
      onPaste: handlePaste,
      onCreateFolder: handleCreateFolder,
      onUpload: handleUploadClick,
      onRename: handleRename,
      onDelete: handleDelete,
      onToggleTrash: handleToggleTrash,
      onOpenSelection: handleEntryClick,
      onClearSelection: handleClearSelection,
    },
  });

  useEffect(() => {
    if (auth === "unknown") {
      loadPath("/");
    }
  }, [auth, loadPath]);

  return (
    <div className="app">
      <Toasts toasts={toasts} />
      <ImagePreviewModal
        path={imagePreviewPath}
        name={imagePreviewName}
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
        />

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
              selectedNames={selectedNames}
              allSelected={allSelected}
              dragActive={dragActive}
              actionLoading={actionLoading}
              canWrite={canWrite}
              sortMode={sortMode}
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
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>
        )}
      </div>
    </div>
  );
}
