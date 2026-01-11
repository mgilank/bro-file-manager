# Bro File Manager

A small file manager inspired by tinyfilemanager, rebuilt with Bun + Hono + React. It ships with cookie-based auth, safe path resolution, and a tidy UI for browsing server folders.

## Features
- Read/write directory listing and file operations.
- Stateless auth with signed session cookie.
- Optional text preview (first 200 KB).
- Safe path normalization to prevent directory traversal.

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

## Build the frontend

```sh
bun run build
```

## Run

```sh
bun run start
```

Visit `http://localhost:3033` and sign in with your configured user.
If you are using `ADMIN_PASSWORD`, the default username is `admin` (or leave the username blank).

## Dev mode
Run the server and Vite (HMR) together:

```sh
bun run dev
```

The Vite dev server proxies `/api` to `http://localhost:3033` and supports hot reload.

## Notes
- Symbolic links are skipped to avoid path escapes.
- Preview returns plain text only and is capped at 200 KB.
- Batch download uses the system `tar` binary to stream `.tar.gz` files.
- Deletes move items into `/.trash`; restore requires the original parent path to exist.
- Audit logs are written to `./audit.log` by default (override with `AUDIT_LOG_PATH`).
