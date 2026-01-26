Sponsored by [Jetorbit.com](https://jetorbit.com)

![Bro File Manager](public/brofm.jpg)

# Bro File Manager



👨🏻 Lightweight file manager built with Bun + Hono + React. It ships with cookie-based auth, safe path resolution, and a tidy UI for browsing server folders.

## Features
- Read/write file operations (upload, download, create, rename, delete/restore, copy/paste).
- Drag-and-drop upload across the app surface.
- Batch downloads as zip or tar.gz, with large zips switching to store mode.
- Search, filters, sorting, pagination, and a recent view for large directories.
- Image preview popup and text preview (first 200 KB).
- Grid/thumbnail view toggle for browsing files and folders.
- Built-in code editor (Ace) for common web files with syntax highlighting, fullscreen, and new-tab editing.
- Local users with roles and per-share roots; stateless signed session cookie.
- Audit logging for file actions.
- Safe path normalization with symlink avoidance to prevent traversal.
- **S3 integration** - Manage files on AWS S3, Cloudflare R2, Backblaze B2, MinIO, and other S3-compatible services.

## Recent improvements
- Header logo and selection-aware toolbar with clear selection.
- Restore the last visited folder on refresh.
- Session cookies set `Secure` based on request scheme (supports HTTP in local Docker).
- Docker Compose host mounts can be overridden via `HOST_DATA_PATH` and `HOST_LOGS_PATH`.
- Added grid view thumbnails and an in-app editor for HTML/PHP/JS/CSS/JSON/Markdown.

## Requirements
- Bun >= 1.1

## Setup

```sh
bun install
```

## Configure
Copy `.env.example` to `.env` (Bun loads it automatically) and update values:

```sh
cp .env.example .env
```

```sh
ADMIN_PASSWORD=change-me           # legacy single-user mode
FILE_ROOT=.                        # optional, defaults to process cwd
SESSION_SECRET=change-me           # optional but recommended
PORT=3033                          # optional
ARCHIVE_LARGE_MB=100               # optional, zip switches to store mode at/above this size
```

Tip: avoid trailing spaces or hidden characters in `.env` values.

### Local users (recommended)
Define multiple users with roles and per-share roots via JSON:

```sh
USERS_FILE=/path/to/users.json
```

You can also inline it with `USERS_JSON` if you prefer:

```sh
USERS_JSON='[{"username":"admin","password":"change-me","role":"admin","root":"/"}]'
```

Example `users.json`:

```json
[
  { "username": "admin", "password": "change-me", "role": "admin", "root": "/" },
  { "username": "viewer", "passwordHash": "scrypt$<salt>$<hash>", "role": "read-only", "root": "/public" },
  { "username": "editor", "password": "edit-me", "role": "read-write", "root": "/team" }
]
```

Password hash format is `scrypt$<base64 salt>$<base64 hash>`. You can generate one with:

```sh
bun -e 'const { randomBytes, scryptSync } = require("crypto"); const salt = randomBytes(16); const hash = scryptSync(process.argv[1], salt, 32); console.log(`scrypt$${salt.toString("base64")}$${hash.toString("base64")}`);' "your-password"
```

## Build the frontend 👷🏻

```sh
bun run build
```

## Run 🏃🏼‍♂️

```sh
bun run start
```

Visit `http://localhost:3033` and sign in with your configured user.
If you are using `ADMIN_PASSWORD`, the default username is `admin` (or leave the username blank).

## S3 Integration ☁️

Bro File Manager supports managing files on S3-compatible storage services including:
- **AWS S3** - Amazon Simple Storage Service
- **Cloudflare R2** - Zero-egress object storage
- **Backblaze B2** - Cloud storage with S3-compatible API
- **MinIO** - Self-hosted object storage
- Any other S3-compatible service

### Configuration (Admin only)

1. Log in as an admin user
2. Click the cloud icon in the header to open S3 Settings
3. Click "Add New Configuration"
4. Choose a preset (AWS S3, Cloudflare R2, Backblaze B2, MinIO) or configure manually:
   - **Configuration Name**: A friendly name for this connection
   - **Bucket Name**: Your S3 bucket name
   - **Region**: AWS region (e.g., `us-east-1`, `auto` for Cloudflare R2)
   - **Access Key ID**: Your S3 access key
   - **Secret Access Key**: Your S3 secret key
   - **Custom Endpoint**: Required for non-AWS services (e.g., `https://<account_id>.r2.cloudflarestorage.com`)
   - **Optional Prefix**: Prefix all keys with a path (e.g., `folder/`)

5. Click "Test Connection" to verify
6. Click "Create" to save

### Using S3 Storage

1. Switch between **Local Files** and **S3 Storage** using the toggle in the header
2. When switching to S3 mode, you'll be prompted to select a configuration
3. All file operations (list, upload, download, edit, delete, move, copy) work the same way
4. Each user session can connect to a different S3 configuration

### Supported Operations on S3

| Operation | Support |
|-----------|----------|
| List files/folders | ✅ |
| Upload files | ✅ |
| Download files | ✅ |
| Delete files/folders | ✅ |
| Rename/Move | ✅ |
| Copy | ✅ |
| Create folders | ✅ |
| Edit text files | ✅ |
| Preview files | ✅ |
| Image preview | ✅ |

### Notes

- Large file uploads are streamed directly to S3
- S3 "directories" are simulated using key prefixes
- Delete operations on folders will delete all objects with that prefix
- S3 credentials are stored in `data/settings.json` on the server
- All S3 operations are logged to the audit log

## Dev mode
Run the server and Vite (HMR) together:

```sh
bun run dev
```

The Vite dev server proxies `/api` to `http://localhost:3033` and supports hot reload.

## Deployment 🚀

### Docker
Build and run the container with Docker Compose:

```sh
docker compose up --build
```

The default compose file maps `3033:3033` and mounts `./data` into `/data` for `FILE_ROOT`.
Set `HOST_DATA_PATH` and `HOST_LOGS_PATH` in `.env` to override host mount paths without editing
`docker-compose.yml`. If you use `USERS_FILE`, mount it into the container and set the path
accordingly.

### PM2
Build the frontend once, then run the server with PM2:

```sh
bun run build
pm2 start "bun run start" --name bro-file-manager
pm2 save
```

Tip: run `pm2 startup` to auto-start on boot (follow the printed instructions).

## Versioning
This project follows SemVer. The current version is tracked in `package.json`.

## Changelog
See `CHANGELOG.md` for release notes.

## Notes
- Symbolic links are skipped to avoid path escapes.
- Preview returns plain text only and is capped at 200 KB.
- Archive downloads stream `.zip` by default via system `zip` (use `format=targz` for `.tar.gz` via `tar`).
- Deletes move items into `/.trash`; restore requires the original parent path to exist.
- Audit logs are written to `./audit.log` by default (override with `AUDIT_LOG_PATH`).

Build with ❤️ from Jogja & Jetorbit

Sponsored by [Jetorbit.com](https://jetorbit.com)
