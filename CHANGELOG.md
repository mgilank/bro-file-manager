# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows SemVer.

## [Unreleased]

### Added
- **S3 Integration** - Support for AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other S3-compatible services
  - Storage mode switcher to toggle between Local Files and S3 Storage
  - Admin-only S3 configuration management with connection testing
  - Session-based S3 connections (each user can connect to different S3 configs)
  - Quick setup presets for common S3-compatible services
  - All file operations (list, upload, download, edit, delete, move, copy, mkdir) work with S3

## [0.2.2] - 2026-01-20
### Added
- List/grid view toggle with thumbnail cards for files and folders.
- In-app code editor for supported web files (Ace) with syntax highlighting, undo, and fullscreen mode.
- New tab editor option via query param.
### Changed
- Compatible files open directly in the editor when clicked and remember view mode.
- Docker Compose host mount paths can be overridden via `HOST_DATA_PATH` and `HOST_LOGS_PATH`.
### Fixed
- Editor modal sizing and Ace container rendering in fullscreen.

## [0.2.1] - 2026-01-13
### Added
- Header logo displayed alongside the brand title.
- Clear selection action in the toolbar when items are selected.
- Drag-and-drop upload across the entire app surface.
- Restore the last visited folder path on refresh.
### Changed
- Docker Compose now mounts `./logs` and writes audit logs to `/app/logs/audit.log`.
- Session cookies set `Secure` based on request scheme (supports HTTP in local Docker).
### Fixed
- Selection state can be cleared after clicking a row entry.
- Image preview/download headers handle non-ASCII filenames.

## [0.2.0] - 2026-01-12
### Added
- Zip archive downloads for selected files/folders (archive endpoint supports `format=zip` or `format=targz`).
- Archive action now provides a direct download link.
- Large zip archives switch to store mode at/above 100 MB (`ARCHIVE_LARGE_MB`).
### Changed
- Reset filters buttons now use icon-only controls.
- Logout button now uses an icon-only control.

## [0.1.0] - 2026-01-12
### Added
- Auth with admin password and local user support.
- Read/write file operations (browse, upload, download, rename, delete/restore, copy/paste).
- Safe path resolution with symlink and traversal protections.
- Text preview with size cap and image preview popup.
- Search, filters, sorting, and pagination for large directories.
- Audit logging and configurable root paths.
