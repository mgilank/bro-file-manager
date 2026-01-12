# Bro File Manager Task Checklist (Prioritized)

This checklist reorganizes the existing feature list by execution priority. It starts with the smallest, easiest auth and a read-only baseline so the system works early, then expands into full NAS operations.

Status legend:
- [x] implemented in the current build
- [ ] pending

Current implementation notes:
- Read/write file manager with login gate (single admin password or local user list).
- Session cookies rotate on activity and expire after 8 hours.
- Default port is 3033; Vite dev uses 5173 with API proxy.
- Symlinks are skipped to prevent escaping the root path.
- Preview is text-only and capped at 200 KB.
- Uploads use multipart form data and may buffer large files in memory.
- Archive downloads stream `.zip` by default via system `zip` (download link in Actions; `format=targz` for `.tar.gz` via `tar`); totals >= 100 MB switch to store mode (configurable via `ARCHIVE_LARGE_MB`).
- Deleted items move into a hidden `/.trash` folder; restore requires the original parent path to exist.
- Local users can be scoped to a subfolder of `FILE_ROOT` for per-share access.
- Audit events are written as JSON lines to `./audit.log` by default.
- `.env` is supported for configuration (Bun loads it automatically).
- `.env.example` is provided; `.env` is ignored via `.gitignore`.
- Frontend files live in the repo root (`index.html`, `src/`, `vite.config.ts`).
- Default `FILE_ROOT` in `.env` is `.`; set it to your NAS share path in production.
- Legacy single-user login uses username `admin` (or leave username blank).
- Tailwind CSS pipeline is enabled (config via `@config`, sources via `@source`, theme import for color/shadow utilities).
- From this point forward, UI work should prefer Tailwind utilities for new changes.
- Branding updated to Bro File Manager.
- Deployment docs added for Docker and PM2.
- README includes featured image (brofm.jpg).
- Changelog and versioning docs added.

## P0 - Easy auth + read-only baseline (function first)
- [x] Authentication: local admin password
- [x] Secure sessions (cookie flags, rotation, expiry)
- [x] Safe path handling (no traversal, symlink policy)
- [x] Browse folders and files
- [x] Download (single)
- [x] Text preview with size cap
- [x] Breadcrumb navigation
- [x] Responsive layout (desktop + mobile)
- [x] Empty/error states

## P1 - Core file operations
- [x] Upload files (single + batch)
- [x] Download (batch as archive)
- [x] Create folders
- [x] Rename/move files and folders
- [x] Delete and restore (trash)
- [x] Copy/paste operations
- [x] Drag and drop

## P2 - Access control expansion
- [x] Authentication: local users
- [ ] Authentication: SSO/OAuth
- [ ] Authentication: LDAP/AD
- [x] Role-based access control (read-only, read/write, admin)
- [x] Per-share permissions and path scoping
- [x] Audit logs for file actions (view, download, delete, rename)

## P3 - UI/UX enhancements
- [x] Left-align file/folder icons and names in list rows
- [x] Keyboard shortcuts (configurable via env)
- [x] Status toasts for actions
- [x] Theming/branding (theme switcher in header)
- [x] Selection actions integrated into the current path card and stick on scroll
- [x] Collapsible filters panel (animated, custom expand/collapse icon)
- [x] Toolbar actions swap to copy/paste/rename/move/zip/delete when selection is active
- [x] Search input hides when items are selected
- [x] Sort controls moved to list header arrows (removed from Filters card)
- [x] Breadcrumbs moved between the toolbar card and the file list table
- [x] Home icon button added to breadcrumbs to jump back to root
- [x] Filters panel relocated under the theme chooser in the header
- [x] Header filters spacing and controls compacted
- [x] Header filters laid out in a single wide row on desktop
- [x] Filters dropdown no longer pushes the table (header toggle panel)
- [x] Reset filters buttons use icon-only control
- [x] Logout button uses icon-only control
- [x] Tailwind utilities use the default (unprefixed) class names
- [x] Tailwind utilities load after custom styles to allow overrides
- [x] Tailwind sources declared via `@source` and theme import enables color/shadow utilities
- [x] Hover states for file/folder rows
- [x] Filters card placed above the current path card
- [x] Removed selection detail card
- [x] Fixed filters expand/collapse icon visibility
- [x] Action buttons use Lucide icons
- [x] Toolbar buttons use Lucide icons
- [x] Dropdown arrows aligned for filter and theme selects
- [x] App favicon set to `favicon.jpeg`

## P4 - Search and indexing
- [x] Filename search
- [x] Full-text search (optional)
- [x] File type filters
- [x] Size/date filters
- [x] Recently modified view

## P5 - Preview and metadata
- [x] Image preview (popup, extension-based, click-to-open)
- [x] Text preview popup (.txt/.php/.js/.html)
- [ ] Audio, video preview
- [ ] File metadata (size, owner, permissions, hashes)
- [ ] Thumbnail generation and caching

## P6 - Performance and scale
- [x] Pagination for large dirs (page size selector)
- [x] Server-side pagination for list API (page/pageSize query params)
- [x] Sorting options (name, date, size, type)
- [x] Pagination controls (prev/next + page size) shown above the list
- [x] Pagination page-size select arrow repositioned
- [ ] Background tasks for heavy ops
- [ ] Rate limiting and throttling
- [ ] Streaming uploads/downloads

## P7 - Security and compliance
- [ ] HTTPS support and HSTS
- [ ] CSRF protection for mutating endpoints
- [ ] Brute-force protection for login
- [ ] IP allowlist/denylist
- [ ] Configurable retention for logs
- [ ] Secrets management

## P8 - Operations and observability
- [ ] Health checks
- [ ] Metrics (request latency, I/O, errors)
- [ ] Structured logging
- [x] Configurable root paths
- [x] Modular frontend architecture (components/hooks/services)
- [ ] Backup/restore of configuration

## P9 - NAS-specific capabilities
- [ ] Mounts/shares selector
- [ ] Storage usage by share and quota tracking
- [ ] RAID/volume status overview
- [ ] Snapshot browsing and restore
- [ ] SMB/NFS permissions awareness
- [ ] Support for large files and slow disks
