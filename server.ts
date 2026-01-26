import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { S3StorageAdapter } from "./server/storage/adapters.js";
import {
  getS3Config,
  s3ConfigToStorageConfig,
  addS3Config,
  updateS3Config,
  deleteS3Config,
  getAllS3Configs,
} from "./server/storage/settings.js";

type UserRole = "read-only" | "read-write" | "admin";

type UserConfig = {
  username: string;
  password?: string;
  passwordHash?: string;
  role?: UserRole;
  root?: string;
};

type UserRecord = {
  username: string;
  role: UserRole;
  rootPath: string;
  rootReal: string;
  password?: string;
  passwordHash?: string;
};

type SessionPayload = {
  exp: number;
  nonce: string;
  user: string;
};

type SessionContext = SessionPayload & {
  role: UserRole;
  rootPath: string;
  rootReal: string;
};

const ROOT = (process.env.FILE_ROOT ?? "").trim() || process.cwd();
const ROOT_REAL = await fs.realpath(ROOT);
const PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();
const USERS_FILE = process.env.USERS_FILE?.trim();
const USERS_JSON = process.env.USERS_JSON?.trim();
const SESSION_SECRET = (process.env.SESSION_SECRET ?? randomUUID()).trim();
const SESSION_COOKIE = "fm_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const SESSION_ROTATE_MS = 1000 * 60 * 30;
const MAX_PREVIEW_BYTES = 200 * 1024;
const MAX_EDIT_BYTES = 1024 * 1024;
const SEARCH_MAX_BYTES_RAW = process.env.SEARCH_MAX_BYTES?.trim();
const SEARCH_MAX_BYTES = Number.parseInt(SEARCH_MAX_BYTES_RAW ?? "", 10);
const MAX_SEARCH_BYTES = Number.isNaN(SEARCH_MAX_BYTES) ? MAX_PREVIEW_BYTES : SEARCH_MAX_BYTES;
const ARCHIVE_LARGE_MB_RAW = process.env.ARCHIVE_LARGE_MB?.trim();
const ARCHIVE_LARGE_MB = Number.parseInt(ARCHIVE_LARGE_MB_RAW ?? "", 10);
const ARCHIVE_LARGE_BYTES =
  Number.isFinite(ARCHIVE_LARGE_MB) && ARCHIVE_LARGE_MB > 0
    ? ARCHIVE_LARGE_MB * 1024 * 1024
    : 100 * 1024 * 1024;
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH?.trim() ?? path.join(process.cwd(), "audit.log");
const S3_MAX_CONNECTIONS = Math.max(1, Number(process.env.S3_MAX_CONNECTIONS ?? "5") || 5);
const SESSION_COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  sameSite: "Strict",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
  path: "/",
} as const;
const TEXT_PREVIEW_EXTS = new Set([".txt", ".php", ".js", ".html"]);
const TEXT_EDIT_EXTS = new Set([
  ".txt",
  ".php",
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".less",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".xml",
  ".svg",
]);
const IMAGE_PREVIEW_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
]);
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

const USERS = await loadUsers();
const USER_MAP = new Map(USERS.map((user) => [user.username, user]));

// S3 session storage (multiple configs per user session)
type S3SessionEntry = { configId: string; adapter: S3StorageAdapter };
const s3Sessions = new Map<string, Map<string, S3SessionEntry>>();

function getSessionS3(sessionId: string): Map<string, S3SessionEntry> | undefined {
  return s3Sessions.get(sessionId);
}

function ensureSessionS3(sessionId: string): Map<string, S3SessionEntry> {
  let sessionMap = s3Sessions.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map();
    s3Sessions.set(sessionId, sessionMap);
  }
  return sessionMap;
}

function setSessionS3(sessionId: string, configId: string, adapter: S3StorageAdapter) {
  const sessionMap = ensureSessionS3(sessionId);
  sessionMap.set(configId, { configId, adapter });
}

function clearSessionS3(sessionId: string, configId?: string) {
  if (!configId) {
    s3Sessions.delete(sessionId);
    return;
  }
  const sessionMap = s3Sessions.get(sessionId);
  if (!sessionMap) return;
  sessionMap.delete(configId);
  if (sessionMap.size === 0) {
    s3Sessions.delete(sessionId);
  }
}

async function getConnectedS3Configs(sessionId: string) {
  const sessionMap = s3Sessions.get(sessionId);
  if (!sessionMap) return [];
  const configs = await getAllS3Configs();
  const configsById = new Map(configs.map((config) => [config.id, config]));
  const connected: typeof configs = [];
  for (const configId of sessionMap.keys()) {
    const config = configsById.get(configId);
    if (config && config.active !== false) {
      connected.push(config);
    } else {
      sessionMap.delete(configId);
    }
  }
  if (sessionMap.size === 0) {
    s3Sessions.delete(sessionId);
  }
  return connected;
}

function getS3ConfigIdFromRequest(c: any, fallback?: { configId?: string }) {
  return fallback?.configId ?? c.req.query("configId") ?? c.req.header("x-s3-config-id");
}

async function getS3Adapter(configId: string): Promise<S3StorageAdapter | null> {
  const config = await getS3Config(configId);
  if (!config) return null;
  if (config.active === false) return null;
  return new S3StorageAdapter(s3ConfigToStorageConfig(config));
}

const app = new Hono<{ Variables: { session: SessionContext } }>();

app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  await next();
});

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/login") {
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE);
  const session = verifySession(token);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = USER_MAP.get(session.user);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", {
    ...session,
    role: user.role,
    rootPath: user.rootPath,
    rootReal: user.rootReal,
  });

  if (session.exp - Date.now() <= SESSION_ROTATE_MS) {
    setSessionCookie(c, createSession(session.user));
  }

  await next();
});

app.post("/api/login", async (c) => {
  let body: { username?: string; password?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  if (USER_MAP.size === 0) {
    return c.json({ error: "No users configured." }, 500);
  }

  const username = (body.username ?? "").trim();
  const user = resolveLoginUser(username);
  if (!user) {
    await auditLog(c, "login_failed", { username, reason: "user_not_found" });
    return c.json({ error: "Invalid credentials." }, 401);
  }

  if (username && username !== user.username && USER_MAP.size === 1) {
    await auditLog(c, "login_fallback", {
      username,
      resolved: user.username,
      reason: "single_user_fallback",
    });
  }

  const provided = (body.password ?? "").trim();
  if (!verifyUserPassword(user, provided)) {
    await auditLog(c, "login_failed", { username: user.username, reason: "bad_password" });
    return c.json({ error: "Invalid credentials." }, 401);
  }

  setSessionCookie(c, createSession(user.username));
  await auditLog(c, "login_success", { username: user.username, role: user.role });

  return c.json({ ok: true, user: user.username, role: user.role });
});

app.post("/api/logout", async (c) => {
  const session = c.get("session");
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  await auditLog(c, "logout", { username: session.user });
  return c.json({ ok: true });
});

app.get("/api/list", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path") ?? "/";
  const requestedPage = parsePositiveInt(c.req.query("page"));
  const pageSize = parsePositiveInt(c.req.query("pageSize"));

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch (error) {
    return c.json({ error: "Path not found." }, 404);
  }

  let stats;
  try {
    stats = await fs.stat(resolved.fullPath);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  if (!stats.isDirectory()) {
    return c.json({ error: "Path is not a directory." }, 400);
  }

  const dirents = await fs.readdir(resolved.fullPath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      if (dirent.isSymbolicLink()) {
        return null;
      }
      if (resolved.normalized === "/" && dirent.name === ".trash") {
        return null;
      }

      const entryPath = path.join(resolved.fullPath, dirent.name);
      try {
        const entryStat = await fs.stat(entryPath);
        return {
          name: dirent.name,
          type: dirent.isDirectory() ? "dir" : "file",
          size: entryStat.isFile() ? entryStat.size : 0,
          mtime: entryStat.mtimeMs,
        };
      } catch {
        return null;
      }
    })
  );

  const filtered = entries.filter(Boolean) as Array<{
    name: string;
    type: "dir" | "file";
    size: number;
    mtime: number;
  }>;

  filtered.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const totalEntries = filtered.length;
  let pagedEntries = filtered;
  let page = 1;

  if (pageSize !== null) {
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    page = Math.min(Math.max(requestedPage ?? 1, 1), totalPages);
    const startIndex = (page - 1) * pageSize;
    pagedEntries = filtered.slice(startIndex, startIndex + pageSize);
  }

  const parent = resolved.normalized === "/" ? null : path.posix.dirname(resolved.normalized);

  await auditLog(c, "list", { path: resolved.normalized, username: session.user });

  const response: {
    path: string;
    parent: string | null;
    entries: typeof filtered;
    user: string;
    role: UserRole;
    total?: number;
    page?: number;
    pageSize?: number;
  } = {
    path: resolved.normalized,
    parent,
    entries: pagedEntries,
    user: session.user,
    role: session.role,
  };

  if (pageSize !== null) {
    response.total = totalEntries;
    response.page = page;
    response.pageSize = pageSize;
  }

  return c.json(response);
});

app.get("/api/search", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path") ?? "/";
  const query = (c.req.query("query") ?? "").trim();

  if (!query) {
    return c.json({ matches: [] });
  }

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  let stats;
  try {
    stats = await fs.stat(resolved.fullPath);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  if (!stats.isDirectory()) {
    return c.json({ error: "Path is not a directory." }, 400);
  }

  const dirents = await fs.readdir(resolved.fullPath, { withFileTypes: true });
  const needle = query.toLowerCase();
  const matches: Array<{ name: string }> = [];

  for (const dirent of dirents) {
    if (dirent.isSymbolicLink() || !dirent.isFile()) {
      continue;
    }

    const entryPath = path.join(resolved.fullPath, dirent.name);
    let entryStat;
    try {
      entryStat = await fs.stat(entryPath);
    } catch {
      continue;
    }

    if (!entryStat.isFile() || entryStat.size > MAX_SEARCH_BYTES) {
      continue;
    }

    let content: string;
    try {
      content = await Bun.file(entryPath).text();
    } catch {
      continue;
    }

    if (content.includes("\0")) {
      continue;
    }

    if (content.toLowerCase().includes(needle)) {
      matches.push({ name: dirent.name });
    }
  }

  await auditLog(c, "search", {
    path: resolved.normalized,
    username: session.user,
    query,
    matches: matches.length,
  });

  return c.json({ matches });
});

app.get("/api/image", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path");
  if (!requestPath) {
    return c.json({ error: "Path is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    return c.json({ error: "Path is not a file." }, 400);
  }

  if (!isImagePreviewable(resolved.fullPath)) {
    return c.json({ error: "Image preview not available." }, 400);
  }

  const file = Bun.file(resolved.fullPath);
  const ext = path.extname(resolved.fullPath).toLowerCase();
  const mime = file.type || IMAGE_MIME_BY_EXT[ext] || "application/octet-stream";
  const filename = path.basename(resolved.fullPath);
  c.header("Content-Type", mime);
  c.header("Content-Disposition", formatContentDisposition("inline", filename));

  await auditLog(c, "image_preview", { path: resolved.normalized, username: session.user });

  return c.body(file);
});

app.get("/api/edit", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path");
  if (!requestPath) {
    return c.json({ error: "Path is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    return c.json({ error: "Path is not a file." }, 400);
  }

  if (!isTextEditable(resolved.fullPath)) {
    return c.json({ error: "Editor not available for this file type." }, 400);
  }

  if (stats.size > MAX_EDIT_BYTES) {
    return c.json({ error: "File is too large to edit." }, 413);
  }

  const file = Bun.file(resolved.fullPath);
  const text = await file.text();

  await auditLog(c, "edit_open", { path: resolved.normalized, username: session.user });

  return c.json({
    name: path.basename(resolved.fullPath),
    size: stats.size,
    mtime: stats.mtimeMs,
    path: resolved.normalized,
    content: text,
  });
});

app.get("/api/preview", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path");
  if (!requestPath) {
    return c.json({ error: "Path is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    return c.json({ error: "Path is not a file." }, 400);
  }

  if (!isTextPreviewable(resolved.fullPath)) {
    return c.json({ error: "Preview not available for this file type." }, 400);
  }

  if (stats.size > MAX_PREVIEW_BYTES) {
    return c.json({ error: "File is too large to preview." }, 413);
  }

  const file = Bun.file(resolved.fullPath);
  const text = await file.text();

  await auditLog(c, "preview", { path: resolved.normalized, username: session.user });

  return c.json({
    name: path.basename(resolved.fullPath),
    size: stats.size,
    mtime: stats.mtimeMs,
    content: text,
  });
});

app.post("/api/edit", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ path?: string; content?: string }>(c);
  if (!body.path) {
    return c.json({ error: "Path is required." }, 400);
  }
  if (typeof body.content !== "string") {
    return c.json({ error: "Content is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(body.path, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    return c.json({ error: "Path is not a file." }, 400);
  }

  if (!isTextEditable(resolved.fullPath)) {
    return c.json({ error: "Editor not available for this file type." }, 400);
  }

  const bytes = Buffer.byteLength(body.content, "utf8");
  if (bytes > MAX_EDIT_BYTES) {
    return c.json({ error: "File is too large to save." }, 413);
  }

  await fs.writeFile(resolved.fullPath, body.content, "utf8");

  await auditLog(c, "edit_save", { path: resolved.normalized, username: session.user, bytes });

  return c.json({ ok: true });
});

app.get("/api/download", async (c) => {
  const session = c.get("session");
  const requestPath = c.req.query("path");
  if (!requestPath) {
    return c.json({ error: "Path is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(requestPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    return c.json({ error: "Path is not a file." }, 400);
  }

  const file = Bun.file(resolved.fullPath);
  const filename = path.basename(resolved.fullPath);

  c.header("Content-Type", file.type || "application/octet-stream");
  c.header("Content-Disposition", formatContentDisposition("attachment", filename));

  await auditLog(c, "download", { path: resolved.normalized, username: session.user });

  return c.body(file);
});

app.post("/api/mkdir", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ path?: string; name?: string }>(c);
  if (!body) {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  const parentPath = typeof body.path === "string" ? body.path : "/";
  const name = sanitizeName(body.name ?? "");
  if (!name) {
    return c.json({ error: "Folder name is required." }, 400);
  }

  let parent;
  try {
    parent = await resolveSafePath(parentPath, session.rootReal);
  } catch {
    return c.json({ error: "Parent path not found." }, 404);
  }

  const parentStat = await fs.stat(parent.fullPath);
  if (!parentStat.isDirectory()) {
    return c.json({ error: "Parent path is not a directory." }, 400);
  }

  const fullPath = path.join(parent.fullPath, name);
  if (!isWithinRoot(fullPath, session.rootReal)) {
    return c.json({ error: "Invalid path." }, 400);
  }

  if (await pathExists(fullPath)) {
    return c.json({ error: "Folder already exists." }, 409);
  }

  await fs.mkdir(fullPath);
  const createdPath = parent.normalized === "/" ? `/${name}` : `${parent.normalized}/${name}`;
  await auditLog(c, "mkdir", { path: createdPath, username: session.user });
  return c.json({ ok: true });
});

app.post("/api/upload", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const form = await c.req.formData();
  const targetPath = form.get("path");
  if (typeof targetPath !== "string") {
    return c.json({ error: "Path is required." }, 400);
  }

  const overwrite = form.get("overwrite") === "1";

  let resolved;
  try {
    resolved = await resolveSafePath(targetPath, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  const dirStat = await fs.stat(resolved.fullPath);
  if (!dirStat.isDirectory()) {
    return c.json({ error: "Path is not a directory." }, 400);
  }

  const files = Array.from(form.entries())
    .filter(([key, value]) => key === "files" && value instanceof File)
    .map(([, value]) => value as File);

  if (files.length === 0) {
    return c.json({ error: "No files provided." }, 400);
  }

  const uploaded: string[] = [];
  for (const file of files) {
    const fileName = sanitizeName(file.name);
    if (!fileName) {
      return c.json({ error: "Invalid file name." }, 400);
    }

    const destPath = path.join(resolved.fullPath, fileName);
    if (!isWithinRoot(destPath, session.rootReal)) {
      return c.json({ error: "Invalid file path." }, 400);
    }

    if (!overwrite && (await pathExists(destPath))) {
      return c.json({ error: `File exists: ${fileName}` }, 409);
    }

    await Bun.write(destPath, file);
    uploaded.push(fileName);
  }

  await auditLog(c, "upload", {
    path: resolved.normalized,
    files: uploaded,
    username: session.user,
  });

  return c.json({ ok: true });
});

app.post("/api/move", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ from?: string; to?: string }>(c);
  if (!body) {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.from !== "string" || typeof body.to !== "string") {
    return c.json({ error: "From and to paths are required." }, 400);
  }

  let fromResolved;
  try {
    fromResolved = await resolveSafePath(body.from, session.rootReal);
  } catch {
    return c.json({ error: "Source path not found." }, 404);
  }

  if (fromResolved.normalized === "/") {
    return c.json({ error: "Cannot move the root." }, 400);
  }

  const dest = await resolveDestinationPath(body.to, session.rootReal);
  if (!dest) {
    return c.json({ error: "Destination path is invalid." }, 400);
  }

  if (!isWithinRoot(dest.fullPath, session.rootReal)) {
    return c.json({ error: "Destination path is invalid." }, 400);
  }

  if (dest.fullPath === fromResolved.fullPath) {
    return c.json({ error: "Destination matches source." }, 400);
  }

  if (await pathExists(dest.fullPath)) {
    return c.json({ error: "Destination already exists." }, 409);
  }

  if (dest.fullPath.startsWith(`${fromResolved.fullPath}${path.sep}`)) {
    return c.json({ error: "Cannot move a folder into itself." }, 400);
  }

  await fs.rename(fromResolved.fullPath, dest.fullPath);
  await auditLog(c, "move", {
    from: fromResolved.normalized,
    to: dest.normalized,
    username: session.user,
  });
  return c.json({ ok: true });
});

app.post("/api/copy", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ from?: string; to?: string }>(c);
  if (!body) {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.from !== "string" || typeof body.to !== "string") {
    return c.json({ error: "From and to paths are required." }, 400);
  }

  let fromResolved;
  try {
    fromResolved = await resolveSafePath(body.from, session.rootReal);
  } catch {
    return c.json({ error: "Source path not found." }, 404);
  }

  const dest = await resolveDestinationPath(body.to, session.rootReal);
  if (!dest) {
    return c.json({ error: "Destination path is invalid." }, 400);
  }

  if (await pathExists(dest.fullPath)) {
    return c.json({ error: "Destination already exists." }, 409);
  }

  if (dest.fullPath.startsWith(`${fromResolved.fullPath}${path.sep}`)) {
    return c.json({ error: "Cannot copy a folder into itself." }, 400);
  }

  await copyPath(fromResolved.fullPath, dest.fullPath);
  await auditLog(c, "copy", {
    from: fromResolved.normalized,
    to: dest.normalized,
    username: session.user,
  });
  return c.json({ ok: true });
});

app.post("/api/trash", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ path?: string }>(c);
  if (!body) {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.path !== "string") {
    return c.json({ error: "Path is required." }, 400);
  }

  let resolved;
  try {
    resolved = await resolveSafePath(body.path, session.rootReal);
  } catch {
    return c.json({ error: "Path not found." }, 404);
  }

  if (resolved.normalized === "/") {
    return c.json({ error: "Cannot delete the root." }, 400);
  }

  const stats = await fs.stat(resolved.fullPath);

  const { trashDir, metaDir } = getTrashPaths(session.rootReal);
  await ensureTrashDirs(metaDir);
  const id = randomUUID();
  const fileName = sanitizeName(path.basename(resolved.fullPath)) ?? "item";
  const trashName = `${Date.now()}-${fileName}-${id}`;
  const trashPath = path.join(trashDir, trashName);

  await fs.rename(resolved.fullPath, trashPath);

  const record: TrashRecord = {
    id,
    name: fileName,
    originalPath: resolved.normalized,
    deletedAt: Date.now(),
    type: stats.isDirectory() ? "dir" : "file",
    size: stats.isFile() ? stats.size : 0,
    trashName,
  };

  await fs.writeFile(path.join(metaDir, `${id}.json`), JSON.stringify(record));
  await auditLog(c, "trash", {
    path: resolved.normalized,
    username: session.user,
  });

  return c.json({ ok: true, item: record });
});

app.get("/api/trash", async (c) => {
  const session = c.get("session");
  const { metaDir } = getTrashPaths(session.rootReal);
  await ensureTrashDirs(metaDir);
  const records = await readTrashRecords(metaDir);
  await auditLog(c, "trash_list", { username: session.user });
  return c.json({ items: records, user: session.user, role: session.role });
});

app.post("/api/trash/restore", async (c) => {
  const session = c.get("session");
  if (!canWrite(session.role)) {
    return c.json({ error: "Read-only account." }, 403);
  }

  const body = await readJsonBody<{ id?: string }>(c);
  if (!body) {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  if (typeof body.id !== "string" || !body.id) {
    return c.json({ error: "Trash id is required." }, 400);
  }

  const { trashDir, metaDir } = getTrashPaths(session.rootReal);
  await ensureTrashDirs(metaDir);
  const record = await readTrashRecord(metaDir, body.id);
  if (!record) {
    return c.json({ error: "Trash record not found." }, 404);
  }

  const normalized = normalizeRequestPath(record.originalPath);
  if (normalized === "/" || normalized.startsWith("/.trash")) {
    return c.json({ error: "Invalid restore path." }, 400);
  }

  const parentNormalized = path.posix.dirname(normalized);
  let parent;
  try {
    parent = await resolveSafePath(parentNormalized, session.rootReal);
  } catch {
    return c.json({ error: "Restore location no longer exists." }, 409);
  }

  const destPath = path.join(parent.fullPath, path.posix.basename(normalized));
  if (await pathExists(destPath)) {
    return c.json({ error: "Restore target already exists." }, 409);
  }

  const trashPath = path.join(trashDir, record.trashName);
  if (!(await pathExists(trashPath))) {
    return c.json({ error: "Trash item not found." }, 404);
  }

  await fs.rename(trashPath, destPath);
  await fs.unlink(path.join(metaDir, `${record.id}.json`));
  await auditLog(c, "restore", {
    path: normalized,
    username: session.user,
  });

  return c.json({ ok: true });
});

app.get("/api/archive", async (c) => {
  const session = c.get("session");
  const url = new URL(c.req.url);
  const requested = url.searchParams.getAll("path");
  if (requested.length === 0) {
    return c.json({ error: "No paths provided." }, 400);
  }

  const formatParam = url.searchParams.get("format");
  const formatRaw = formatParam ? formatParam.toLowerCase() : "zip";
  const format =
    formatRaw === "zip"
      ? "zip"
      : formatRaw === "targz" || formatRaw === "tar.gz" || formatRaw === "tgz"
        ? "targz"
        : null;
  if (!format) {
    return c.json({ error: "Invalid archive format." }, 400);
  }

  const resolved: string[] = [];
  const resolvedFullPaths: string[] = [];
  const isSingle = requested.length === 1;
  let singleName: string | null = null;
  const archiveRoot = session.rootReal;
  for (const item of requested) {
    let resolvedItem;
    try {
      resolvedItem = await resolveSafePath(item, archiveRoot);
    } catch {
      return c.json({ error: "Path not found." }, 404);
    }

    if (resolvedItem.normalized === "/") {
      return c.json({ error: "Cannot archive the root." }, 400);
    }

    resolved.push(path.relative(archiveRoot, resolvedItem.fullPath));
    resolvedFullPaths.push(resolvedItem.fullPath);
    if (isSingle) {
      singleName = path.basename(resolvedItem.fullPath);
    }
  }

  if (resolved.length === 0) {
    return c.json({ error: "No valid paths provided." }, 400);
  }

  const totalBytes =
    format === "zip"
      ? await getArchiveTotalBytes(resolvedFullPaths, ARCHIVE_LARGE_BYTES)
      : 0;
  const useStore = format === "zip" && totalBytes >= ARCHIVE_LARGE_BYTES;
  const compression = format === "zip" ? (useStore ? "store" : "normal") : "gzip";

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const baseName = singleName ?? `bundle-${timestamp}`;
  const safeBaseName = baseName.replace(/[\r\n"]/g, "") || "bundle";
  const archiveName = format === "zip" ? `${safeBaseName}.zip` : `${safeBaseName}.tar.gz`;

  let process;
  try {
    const cmd =
      format === "zip"
        ? ["zip", "-q", "-r", "-y", ...(useStore ? ["-0"] : []), "-", ...resolved]
        : ["tar", "-czf", "-", ...resolved];
    process = Bun.spawn({
      cmd,
      cwd: archiveRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch {
    return c.json({ error: "Archive tool is not available." }, 500);
  }

  process.exited.then((code) => {
    if (code !== 0) {
      process.stderr
        ?.text()
        .then((text) => console.error("Archive failed:", text.trim()))
        .catch(() => {});
    }
  });

  c.header("Content-Type", format === "zip" ? "application/zip" : "application/gzip");
  c.header("Content-Disposition", formatContentDisposition("attachment", archiveName));
  await auditLog(c, "archive", { paths: requested, format, compression, username: session.user });
  return c.body(process.stdout);
});

// ============================================================================
// S3 Configuration Endpoints (Admin only)
// ============================================================================

app.get("/api/s3/configs", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const configs = await getAllS3Configs();
  // Return configs without secrets for list view
  const safeConfigs = configs.map(({ secretAccessKey: _, ...rest }) => rest);
  return c.json({ configs: safeConfigs });
});

app.get("/api/s3/configs/:id", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const config = await getS3Config(id);
  if (!config) {
    return c.json({ error: "Configuration not found" }, 404);
  }

  return c.json({ config });
});

app.post("/api/s3/configs", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { name, region, endpoint, accessKeyId, secretAccessKey, bucket, prefix } = body;

  if (!name || !region || !accessKeyId || !secretAccessKey || !bucket) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  try {
    const config = await addS3Config({
      name,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucket,
      prefix,
    });

    await auditLog(c, "s3_config_added", { username: session.user, configId: config.id, name });

    return c.json({ config: { ...config, secretAccessKey: "***" } }, 201);
  } catch (error) {
    return c.json({ error: "Failed to create configuration" }, 500);
  }
});

app.put("/api/s3/configs/:id", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const updated = await updateS3Config(id, body);
    if (!updated) {
      return c.json({ error: "Configuration not found" }, 404);
    }

    await auditLog(c, "s3_config_updated", { username: session.user, configId: id });

    return c.json({ config: { ...updated, secretAccessKey: "***" } });
  } catch (error) {
    return c.json({ error: "Failed to update configuration" }, 500);
  }
});

app.delete("/api/s3/configs/:id", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const deleted = await deleteS3Config(id);
  if (!deleted) {
    return c.json({ error: "Configuration not found" }, 404);
  }

  await auditLog(c, "s3_config_deleted", { username: session.user, configId: id });

  return c.json({ success: true });
});

app.post("/api/s3/configs/:id/test", async (c) => {
  const session = c.get("session");
  if (session.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const config = await getS3Config(id);
  if (!config) {
    return c.json({ error: "Configuration not found" }, 404);
  }

  try {
    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    // Try to list objects (with max 1) to test connection
    await client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      MaxKeys: 1,
    }));

    await auditLog(c, "s3_config_tested", { username: session.user, configId: id, success: true });

    return c.json({ success: true, message: "Connection successful" });
  } catch (error: any) {
    await auditLog(c, "s3_config_tested", { username: session.user, configId: id, success: false, error: error.message });
    return c.json({ success: false, error: error.message }, 400);
  }
});

// ============================================================================
// S3 Session Management
// ============================================================================

app.post("/api/s3/connect", async (c) => {
  const session = c.get("session");

  const { configId } = await c.req.json();
  if (!configId) {
    return c.json({ error: "Missing configId" }, 400);
  }

  const sessionKey = session.user + ":" + session.role;
  const sessionMap = ensureSessionS3(sessionKey);
  if (sessionMap.has(configId)) {
    const connectedConfigs = await getConnectedS3Configs(sessionKey);
    const safeConfigs = connectedConfigs.map(({ secretAccessKey: _, ...rest }) => rest);
    return c.json({ connected: safeConfigs.length > 0, configs: safeConfigs, maxConnections: S3_MAX_CONNECTIONS });
  }
  if (sessionMap.size >= S3_MAX_CONNECTIONS) {
    return c.json({ error: "Maximum S3 connections reached", maxConnections: S3_MAX_CONNECTIONS }, 400);
  }

  const adapter = await getS3Adapter(configId);
  if (!adapter) {
    return c.json({ error: "Configuration not found" }, 404);
  }

  setSessionS3(sessionKey, configId, adapter);

  await auditLog(c, "s3_connected", { username: session.user, configId });

  const connectedConfigs = await getConnectedS3Configs(sessionKey);
  const safeConfigs = connectedConfigs.map(({ secretAccessKey: _, ...rest }) => rest);
  return c.json({
    connected: safeConfigs.length > 0,
    configs: safeConfigs,
    maxConnections: S3_MAX_CONNECTIONS,
    user: session.user,
    role: session.role,
  });
});

app.post("/api/s3/disconnect", async (c) => {
  const session = c.get("session");
  const body = await readJsonBody<{ configId?: string }>(c);
  const configId = getS3ConfigIdFromRequest(c, body ?? undefined);

  clearSessionS3(session.user + ":" + session.role, configId);

  const connectedConfigs = await getConnectedS3Configs(session.user + ":" + session.role);
  const safeConfigs = connectedConfigs.map(({ secretAccessKey: _, ...rest }) => rest);
  return c.json({
    connected: safeConfigs.length > 0,
    configs: safeConfigs,
    maxConnections: S3_MAX_CONNECTIONS,
    user: session.user,
    role: session.role,
  });
});

app.get("/api/s3/current", async (c) => {
  const session = c.get("session");

  const connectedConfigs = await getConnectedS3Configs(session.user + ":" + session.role);
  const safeConfigs = connectedConfigs.map(({ secretAccessKey: _, ...rest }) => rest);
  return c.json({
    connected: safeConfigs.length > 0,
    configs: safeConfigs,
    maxConnections: S3_MAX_CONNECTIONS,
    user: session.user,
    role: session.role,
  });
});

app.get("/api/s3/connections", async (c) => {
  const session = c.get("session");
  const connectedConfigs = await getConnectedS3Configs(session.user + ":" + session.role);
  const safeConfigs = connectedConfigs.map(({ secretAccessKey: _, ...rest }) => rest);
  return c.json({
    connected: safeConfigs.length > 0,
    configs: safeConfigs,
    maxConnections: S3_MAX_CONNECTIONS,
    user: session.user,
    role: session.role,
  });
});

// ============================================================================
// S3 File Operations
// ============================================================================

// Helper to verify S3 session
async function requireS3Session(
  c: any,
  session: SessionContext,
  configId?: string
): Promise<{ adapter: S3StorageAdapter; configId: string } | { error: string; status: number }> {
  const sessionKey = session.user + ":" + session.role;
  const targetId = configId ?? getS3ConfigIdFromRequest(c);
  if (!targetId) {
    return { error: "Missing configId", status: 400 };
  }
  const s3Session = getSessionS3(sessionKey);
  const entry = s3Session?.get(targetId);
  if (!entry) {
    return { error: "Not connected to S3", status: 400 };
  }

  return { adapter: entry.adapter, configId: targetId };
}

app.get("/api/s3/list", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  const path = c.req.query("path") || "/";
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  try {
    const { entries, total } = await adapter.list(path, { limit, offset });
    return c.json({ entries, total, user: session.user, role: session.role });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/s3/download", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  const path = c.req.query("path");
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    const content = await adapter.read(path);
    const stat = await adapter.stat(path);
    const filename = path.split("/").pop() || "download";

    return c.body(content, 200, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": stat?.size.toString() || "0",
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/s3/preview", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  const path = c.req.query("path");
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    const stat = await adapter.stat(path);
    if (!stat || stat.type === "directory") {
      return c.json({ error: "Not a file" }, 400);
    }

    const content = await adapter.read(path);
    const text = content.toString("utf-8");

    return c.json({ content: text.slice(0, MAX_PREVIEW_BYTES), size: stat.size });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/s3/image", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  const path = c.req.query("path");
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    const content = await adapter.read(path);
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mimeType = IMAGE_MIME_BY_EXT[ext] || "image/jpeg";

    return c.body(content, 200, {
      "Content-Type": mimeType,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get("/api/s3/edit", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot edit files" }, 403);
  }

  const path = c.req.query("path");
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    const stat = await adapter.stat(path);
    if (!stat) {
      return c.json({ error: "File not found" }, 404);
    }

    if (stat.size > MAX_EDIT_BYTES) {
      return c.json({ error: "File too large to edit" }, 400);
    }

    const content = await adapter.read(path);
    return c.json({ content: content.toString("utf-8") });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.put("/api/s3/edit", async (c) => {
  const session = c.get("session");
  const body = await c.req.json();
  const configId = getS3ConfigIdFromRequest(c, body ?? undefined);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot edit files" }, 403);
  }

  const { path, content } = body;
  if (!path || content === undefined) {
    return c.json({ error: "Missing path or content" }, 400);
  }

  try {
    await adapter.write(path, Buffer.from(content));
    await auditLog(c, "s3_file_edited", { username: session.user, path });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/s3/upload", async (c) => {
  const session = c.get("session");
  const formData = await c.req.formData();
  const configId = getS3ConfigIdFromRequest(c, { configId: formData.get("configId") as string });
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot upload files" }, 403);
  }

  const file = formData.get("file") as File;
  const path = formData.get("path") as string;

  if (!file || !path) {
    return c.json({ error: "Missing file or path" }, 400);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const targetPath = path.endsWith("/") ? path + file.name : path;
    await adapter.write(targetPath, buffer);

    await auditLog(c, "s3_file_uploaded", { username: session.user, path: targetPath, size: buffer.length });

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/api/s3/delete", async (c) => {
  const session = c.get("session");
  const configId = getS3ConfigIdFromRequest(c);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot delete files" }, 403);
  }

  const path = c.req.query("path");
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    await adapter.delete(path);
    await auditLog(c, "s3_file_deleted", { username: session.user, path });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/s3/move", async (c) => {
  const session = c.get("session");
  const body = await c.req.json();
  const configId = getS3ConfigIdFromRequest(c, body ?? undefined);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot move files" }, 403);
  }

  const { source, destination } = body;
  if (!source || !destination) {
    return c.json({ error: "Missing source or destination" }, 400);
  }

  try {
    await adapter.move(source, destination);
    await auditLog(c, "s3_file_moved", { username: session.user, source, destination });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/s3/copy", async (c) => {
  const session = c.get("session");
  const body = await c.req.json();
  const configId = getS3ConfigIdFromRequest(c, body ?? undefined);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot copy files" }, 403);
  }

  const { source, destination } = body;
  if (!source || !destination) {
    return c.json({ error: "Missing source or destination" }, 400);
  }

  try {
    await adapter.copy(source, destination);
    await auditLog(c, "s3_file_copied", { username: session.user, source, destination });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/s3/mkdir", async (c) => {
  const session = c.get("session");
  const body = await c.req.json();
  const configId = getS3ConfigIdFromRequest(c, body ?? undefined);
  const result = await requireS3Session(c, session, configId);
  if ("error" in result) return c.json({ error: result.error }, result.status);

  const { adapter } = result;
  if (session.role === "read-only") {
    return c.json({ error: "Read-only users cannot create directories" }, 403);
  }

  const { path } = body;
  if (!path) return c.json({ error: "Missing path" }, 400);

  try {
    await adapter.mkdir(path);
    await auditLog(c, "s3_directory_created", { username: session.user, path });
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.use("/*", serveStatic({ root: "./dist" }));

app.get("/*", async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found." }, 404);
  }

  const file = Bun.file("./dist/index.html");
  if (!(await file.exists())) {
    return c.text("Frontend build not found. Run 'bun run build' from the repo root.", 500);
  }

  return c.html(await file.text());
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error." }, 500);
});

const PORT = process.env.PORT === undefined ? 3033 : Number(process.env.PORT);
const PORT_VALUE = Number.isNaN(PORT) ? 3033 : PORT;

Bun.serve({
  fetch: app.fetch,
  port: PORT_VALUE,
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function createSession(user: string) {
  const payload: SessionPayload = {
    exp: Date.now() + SESSION_TTL_MS,
    nonce: randomUUID(),
    user,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function verifySession(token?: string): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  if (!safeEqual(expected, signature)) {
    return null;
  }

  const decoded = base64UrlDecode(payload);
  if (!decoded) {
    return null;
  }

  try {
    const data = JSON.parse(decoded) as { exp?: number; nonce?: string; user?: string };
    if (
      typeof data.exp !== "number" ||
      typeof data.nonce !== "string" ||
      typeof data.user !== "string"
    ) {
      return null;
    }
    if (data.exp <= Date.now()) {
      return null;
    }
    return { exp: data.exp, nonce: data.nonce, user: data.user };
  } catch {
    return null;
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function isSecureRequest(c: Parameters<typeof setCookie>[0]) {
  const forwardedProto = c.req.header("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }
  return c.req.url.startsWith("https://");
}

function setSessionCookie(c: Parameters<typeof setCookie>[0], value: string) {
  setCookie(c, SESSION_COOKIE, value, {
    ...SESSION_COOKIE_BASE_OPTIONS,
    secure: isSecureRequest(c),
  });
}

function canWrite(role: UserRole) {
  return role !== "read-only";
}

function resolveLoginUser(username: string) {
  if (username) {
    const direct = USER_MAP.get(username);
    if (direct) {
      return direct;
    }
  }
  if (USER_MAP.size === 1) {
    return USER_MAP.values().next().value ?? null;
  }
  return null;
}

function verifyUserPassword(user: UserRecord, password: string) {
  if (user.passwordHash) {
    return verifyPasswordHash(user.passwordHash, password);
  }
  if (typeof user.password === "string") {
    return safeEqual(user.password, password);
  }
  return false;
}

function verifyPasswordHash(hash: string, password: string) {
  if (!hash.startsWith("scrypt$")) {
    return false;
  }
  const [, saltB64, hashB64] = hash.split("$");
  if (!saltB64 || !hashB64) {
    return false;
  }
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const derived = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, derived);
}

function normalizeUserRole(role?: string): UserRole {
  const normalized = (role ?? "read-write").toLowerCase();
  if (normalized === "admin" || normalized === "read-only" || normalized === "read-write") {
    return normalized;
  }
  throw new Error(`Invalid role: ${role}`);
}

async function loadUsers(): Promise<UserRecord[]> {
  let configs: UserConfig[] = [];

  if (USERS_JSON) {
    configs = JSON.parse(USERS_JSON) as UserConfig[];
  } else if (USERS_FILE) {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    configs = JSON.parse(raw) as UserConfig[];
  } else if (PASSWORD) {
    configs = [
      {
        username: "admin",
        password: PASSWORD,
        role: "admin",
        root: "/",
      },
    ];
  }

  if (!Array.isArray(configs) || configs.length === 0) {
    return [];
  }

  const records: UserRecord[] = [];
  const seen = new Set<string>();
  for (const config of configs) {
    const username = (config.username ?? "").trim();
    if (!username) {
      throw new Error("User is missing a username.");
    }
    if (seen.has(username)) {
      throw new Error(`Duplicate username: ${username}`);
    }
    seen.add(username);

    const role = normalizeUserRole(config.role);
    const root = config.root ?? "/";
    const { rootPath, rootReal } = await resolveUserRoot(root);

    if (!config.password && !config.passwordHash) {
      throw new Error(`User ${username} is missing a password.`);
    }

    records.push({
      username,
      role,
      rootPath,
      rootReal,
      password: config.password,
      passwordHash: config.passwordHash,
    });
  }

  return records;
}

async function resolveUserRoot(rootPath: string) {
  const normalized = normalizeRequestPath(rootPath);
  if (normalized === "/.trash" || normalized.startsWith("/.trash/")) {
    throw new Error("User root cannot be .trash");
  }
  const joined = path.resolve(ROOT_REAL, `.${normalized}`);
  const real = await fs.realpath(joined);
  if (!isWithinRoot(real, ROOT_REAL)) {
    throw new Error("User root escapes FILE_ROOT");
  }
  const stats = await fs.stat(real);
  if (!stats.isDirectory()) {
    throw new Error("User root must be a directory");
  }
  return { rootPath: normalized, rootReal: real };
}

function getTrashPaths(rootReal: string) {
  const trashDir = path.join(rootReal, ".trash");
  const metaDir = path.join(trashDir, ".meta");
  return { trashDir, metaDir };
}

function getRequestIp(c: Parameters<typeof setCookie>[0]) {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return c.req.header("x-real-ip") ?? "unknown";
}

async function auditLog(
  c: Parameters<typeof setCookie>[0],
  action: string,
  meta: Record<string, unknown>
) {
  const record = {
    ts: new Date().toISOString(),
    ip: getRequestIp(c),
    action,
    ...meta,
  };
  try {
    await fs.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(record)}\n`);
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}

type TrashRecord = {
  id: string;
  name: string;
  originalPath: string;
  deletedAt: number;
  type: "dir" | "file";
  size: number;
  trashName: string;
};

async function readJsonBody<T>(c: Parameters<typeof setCookie>[0]) {
  try {
    return (await c.req.json()) as T;
  } catch {
    return null;
  }
}

function parsePositiveInt(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function encodeContentDispositionFilename(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

function formatContentDisposition(type: "inline" | "attachment", filename: string) {
  const base = filename.replace(/[\r\n"]/g, "").replace(/[\\/]/g, "_");
  const fallback = base.replace(/[^\x20-\x7E]+/g, "_").trim() || "file";
  const encoded = encodeContentDispositionFilename(filename);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function sanitizeName(value: string) {
  const trimmed = value.trim().replace(/\0/g, "");
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  if (trimmed === "." || trimmed === "..") {
    return null;
  }
  return trimmed;
}

function isTextPreviewable(filePath: string) {
  return TEXT_PREVIEW_EXTS.has(path.extname(filePath).toLowerCase());
}

function isTextEditable(filePath: string) {
  return TEXT_EDIT_EXTS.has(path.extname(filePath).toLowerCase());
}

function isImagePreviewable(filePath: string) {
  return IMAGE_PREVIEW_EXTS.has(path.extname(filePath).toLowerCase());
}

async function pathExists(target: string) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

async function getArchiveTotalBytes(paths: string[], limit: number) {
  if (limit <= 0) {
    return 0;
  }
  let total = 0;
  for (const item of paths) {
    if (total >= limit) {
      break;
    }
    total += await sumPathBytes(item, limit - total);
  }
  return total;
}

async function sumPathBytes(root: string, limit: number) {
  if (limit <= 0) {
    return 0;
  }
  const stack = [root];
  let total = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let stats;
    try {
      stats = await fs.lstat(current);
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) {
      continue;
    }
    if (stats.isFile()) {
      total += stats.size;
    } else if (stats.isDirectory()) {
      try {
        const dirents = await fs.readdir(current, { withFileTypes: true });
        for (const dirent of dirents) {
          if (dirent.isSymbolicLink()) {
            continue;
          }
          stack.push(path.join(current, dirent.name));
        }
      } catch {
        continue;
      }
    }
    if (total >= limit) {
      break;
    }
  }
  return total;
}

async function resolveDestinationPath(target: string, rootReal: string) {
  const normalized = normalizeRequestPath(target);
  if (normalized === "/" || normalized.startsWith("/.trash")) {
    return null;
  }
  const parentNormalized = path.posix.dirname(normalized);
  const name = sanitizeName(path.posix.basename(normalized));
  if (!name) {
    return null;
  }
  const parent = await resolveSafePath(parentNormalized, rootReal);
  const fullPath = path.join(parent.fullPath, name);
  return { normalized, fullPath };
}

async function copyPath(source: string, destination: string) {
  const stats = await fs.stat(source);
  if (stats.isDirectory()) {
    await fs.mkdir(destination);
    const dirents = await fs.readdir(source, { withFileTypes: true });
    for (const dirent of dirents) {
      if (dirent.isSymbolicLink()) {
        continue;
      }
      const src = path.join(source, dirent.name);
      const dest = path.join(destination, dirent.name);
      if (dirent.isDirectory()) {
        await copyPath(src, dest);
      } else if (dirent.isFile()) {
        await fs.copyFile(src, dest);
      }
    }
    return;
  }

  if (stats.isFile()) {
    await fs.copyFile(source, destination);
    return;
  }

  throw new Error("Unsupported file type");
}

async function ensureTrashDirs(metaDir: string) {
  await fs.mkdir(metaDir, { recursive: true });
}

async function readTrashRecord(metaDir: string, id: string): Promise<TrashRecord | null> {
  try {
    const raw = await fs.readFile(path.join(metaDir, `${id}.json`), "utf8");
    const parsed = JSON.parse(raw) as TrashRecord;
    if (!parsed?.id || !parsed?.trashName || !parsed?.originalPath) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readTrashRecords(metaDir: string): Promise<TrashRecord[]> {
  const files = await fs.readdir(metaDir);
  const records: TrashRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const id = file.replace(/\.json$/, "");
    const record = await readTrashRecord(metaDir, id);
    if (record) {
      records.push(record);
    }
  }
  records.sort((a, b) => b.deletedAt - a.deletedAt);
  return records;
}

function normalizeRequestPath(input: string | undefined) {
  let raw = (input ?? "/").trim();
  if (!raw) {
    raw = "/";
  }

  raw = raw.replace(/\\/g, "/");
  if (!raw.startsWith("/")) {
    raw = `/${raw}`;
  }

  const normalized = path.posix.normalize(raw);
  if (!normalized.startsWith("/")) {
    return "/";
  }

  return normalized;
}

function isWithinRoot(candidate: string, rootReal: string) {
  if (candidate === rootReal) {
    return true;
  }

  const rootWithSep = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  return candidate.startsWith(rootWithSep);
}

async function resolveSafePath(requestPath: string, rootReal: string) {
  const normalized = normalizeRequestPath(requestPath);
  if (normalized === "/.trash" || normalized.startsWith("/.trash/")) {
    throw new Error("Path not allowed");
  }
  const joined = path.resolve(rootReal, `.${normalized}`);
  const real = await fs.realpath(joined);

  if (!isWithinRoot(real, rootReal)) {
    throw new Error("Path escapes root");
  }

  return { normalized, fullPath: real };
}
