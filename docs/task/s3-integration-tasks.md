# S3 Integration Task List

> **Reference:** [Implementation Plan](../plan/2025-01-24-s3-integration.md)

**Goal:** Add S3 service compatibility (AWS S3, Cloudflare R2) to Bro File Manager with separated local/S3 views and admin-configurable credentials.

---

## Updates

- Fixed S3 API client paths to avoid `/api/api` and aligned toast usage in `S3SettingsPage`.
- Refined S3 settings action button colors and ensured test errors surface even with success toasts.
- Routed S3 settings toasts through the global toast renderer so errors show in UI.
- Fixed S3 uploads to use the S3 API when in S3 mode.
- Prevented unnecessary S3 connection modal when switching to S3 if already connected.
- Added `/s3` route so S3 file manager stays on refresh.
- Normalized S3 list entries to app entry shape to prevent "Invalid Date".
- Routed folder creation to S3 API when in S3 mode.
- Avoided local trash/image endpoints in S3 mode and wired S3 image previews.
- Tightened S3 settings header spacing to reduce scroll.
- Guarded invalid endpoint values when rendering hostname in S3 settings list.
- Prefill access/secret keys on edit by fetching full config details.
- Added a plus action in the storage switcher for opening the S3 connection modal and boosted switcher contrast.
- Removed switcher shadows/scale animations for a lighter look.
- Disabled hover shadows on the storage switcher buttons; color only.
- Allowed switching between S3 configs from the connection modal while already connected.
- Added multi-connection S3 support with `/s3/:configId` routing and max connections via `S3_MAX_CONNECTIONS`.
- Added activate/deactivate control for saved S3 configs without deleting.
- Tightened saved config action row layout in S3 settings cards.
- Moved delete control to the card header for saved configs.
- Refreshes S3 connection state when configs are deactivated to avoid broken views.
- Fallback to another connected S3 or local when the active config is deactivated.
- Keep users on S3 settings page when deactivating the active config from settings.
- Force settings route and local storage mode when active S3 config is deactivated in settings.
- Include user/role in S3 list responses so settings access doesn't disappear in S3-only flows.
- Hydrate username/role from S3 connection refreshes so settings access stays stable after deactivation.

---

## Backend Tasks

### [ ] Task 1: Create Storage Abstraction Layer

**Files to create/modify:**
- `server/storage/types.ts` - Storage adapter interfaces
- `server/storage/adapters.ts` - LocalStorageAdapter and S3StorageAdapter
- `tests/storage/adapters.test.ts` - Unit tests

**Key actions:**
- Create `StorageAdapter` interface with methods: list, stat, read, write, delete, move, copy, mkdir, exists, getPublicUrl
- Implement `LocalStorageAdapter` wrapping existing fs operations
- Implement `S3StorageAdapter` using @aws-sdk/client-s3
- Write unit tests for both adapters

**Commit message:** `feat(storage): add storage abstraction layer with local and S3 adapters`

---

### [ ] Task 2: Create S3 Settings Management System

**Files to create/modify:**
- `server/storage/settings.ts` - Settings CRUD functions
- `server.ts` - S3 configuration API endpoints

**Key actions:**
- Create settings JSON storage at `data/settings.json`
- Implement CRUD operations: addS3Config, updateS3Config, deleteS3Config, getS3Config, getAllS3Configs
- Add API endpoints (admin only):
  - `GET /api/s3/configs` - List all configs
  - `GET /api/s3/configs/:id` - Get specific config
  - `POST /api/s3/configs` - Create config
  - `PUT /api/s3/configs/:id` - Update config
  - `DELETE /api/s3/configs/:id` - Delete config
  - `POST /api/s3/configs/:id/test` - Test connection

**Commit message:** `feat(s3): add S3 configuration management endpoints`

---

### [ ] Task 3: Create S3 API Endpoints

**Files to modify:**
- `server.ts` - Add S3 session management and file operation endpoints

**Key actions:**
- Add S3 session storage: `s3Sessions` Map
- Add session management endpoints:
  - `POST /api/s3/connect` - Connect to S3 config
  - `POST /api/s3/disconnect` - Disconnect
  - `GET /api/s3/current` - Get connection status
- Add file operation endpoints:
  - `GET /api/s3/list` - List S3 objects
  - `GET /api/s3/download` - Download object
  - `GET /api/s3/preview` - Text preview
  - `GET /api/s3/image` - Image preview
  - `GET /api/s3/edit` - Get file for editing
  - `PUT /api/s3/edit` - Save edited file
  - `POST /api/s3/upload` - Upload file
  - `DELETE /api/s3/delete` - Delete object
  - `POST /api/s3/move` - Move/rename
  - `POST /api/s3/copy` - Copy object
  - `POST /api/s3/mkdir` - Create directory

**Commit message:** `feat(s3): add S3 file operation endpoints`

---

## Frontend Tasks

### [ ] Task 4: Update Frontend Types

**Files to modify:**
- `src/types.ts`

**Key actions:**
- Add `StorageMode = "local" | "s3"`
- Add `S3Config` interface
- Add `S3ConnectionState` interface
- Add `S3ConfigForm` interface

**Commit message:** `feat(s3): add S3 types to frontend`

---

### [ ] Task 5: Update API Service Layer

**Files to modify:**
- `src/services/api.ts`

**Key actions:**
- Add S3 configuration API functions: s3ListConfigs, s3GetConfig, s3CreateConfig, s3UpdateConfig, s3DeleteConfig, s3TestConnection
- Add S3 session API functions: s3Connect, s3Disconnect, s3GetCurrentConnection
- Add S3 file operation functions: s3List, s3Download, s3Preview, s3GetImage, s3GetEdit, s3SaveEdit, s3Upload, s3Delete, s3Move, s3Copy, s3Mkdir

**Commit message:** `feat(s3): add S3 API service functions`

---

### [ ] Task 6: Create Storage Mode Switcher Component

**Files to create:**
- `src/components/StorageSwitcher.tsx`
- `src/components/S3ConnectionModal.tsx`

**Key actions:**
- Create `StorageSwitcher` - Toggle between Local/S3 modes with connection status indicator
- Create `S3ConnectionModal` - Modal for connecting/disconnecting S3 configurations

**Commit message:** `feat(s3): add storage mode switcher and S3 connection modal components`

---

### [ ] Task 7: Create S3 Configuration Management Modal

**Files to create:**
- `src/components/S3SettingsModal.tsx`

**Key actions:**
- Create admin-only modal for S3 configuration CRUD
- Include quick setup presets: AWS S3, Cloudflare R2, Backblaze B2, MinIO
- Add test connection button
- Add create, edit, delete functionality

**Commit message:** `feat(s3): add S3 settings modal for admin configuration management`

---

### [ ] Task 8: Update App.tsx for Storage Mode Switching

**Files to modify:**
- `src/App.tsx`

**Key actions:**
- Add storage mode state (localStorage persisted)
- Add S3 connection state
- Update `loadFiles` to handle both local and S3 modes
- Update file operations (download, upload, delete, etc.) to route to correct API
- Integrate `StorageSwitcher` component
- Integrate `S3ConnectionModal` and `S3SettingsModal`
- Add S3 settings button to admin menu

**Commit message:** `feat(s3): integrate storage mode switcher into main app`

---

### [ ] Task 9: Update Constants File

**Files to modify:**
- `src/constants.ts`

**Key actions:**
- Add S3 presets configuration

**Commit message:** `feat(s3): add S3 preset constants`

---

### [ ] Task 10: Install AWS SDK Dependency

**Files to modify:**
- `package.json`

**Key actions:**
```bash
bun add @aws-sdk/client-s3
```

**Commit message:** `feat(s3): add AWS SDK client dependency`

---

### [ ] Task 11: Update Styles and Visual Indicators

**Files to modify:**
- `src/components/Header.tsx`
- `src/index.css` (if needed)

**Key actions:**
- Add visual indicator for current storage mode
- Ensure storage switcher is responsive on mobile

**Commit message:** `feat(s3): add visual indicators and responsive styles for storage mode`

---

## Testing & Documentation

### [ ] Task 12: Add Unit Tests for Storage Adapters

**Files to create:**
- `tests/storage/adapters.integration.test.ts`

**Key actions:**
- Write integration tests for S3 adapter (using mock/localstack)
- Run: `bun test tests/storage/`

**Commit message:** `test(s3): add integration tests for storage adapters`

---

### [ ] Task 13: Update Documentation

**Files to modify:**
- `README.md`
- `CLAUDE.md`

**Key actions:**
- Document S3 integration feature in README
- Update architecture documentation in CLAUDE.md
- Add configuration examples for AWS S3, Cloudflare R2, Backblaze B2, MinIO

**Commit message:** `docs: add S3 integration documentation`

---

### [ ] Task 14: Final Integration Testing

**Testing checklist:**
1. Test local storage mode - all file operations
2. Test S3 configuration - create, test connection, switch to S3 mode
3. Test S3 file operations - list, upload, download, edit, delete, move, copy
4. Test connection persistence - refresh page
5. Test role permissions - read-only users cannot modify S3 files
6. Test error handling - invalid credentials, network errors
7. Test all S3-compatible services (AWS S3, R2, B2, MinIO)

**Commit message:** `test(s3): complete integration testing`

---

## Summary

**Total Tasks:** 14
**Estimated Files Changed/Created:** ~20 files

**Supported S3-Compatible Services:**
- Amazon S3
- Cloudflare R2
- Backblaze B2
- MinIO (self-hosted)
- Any other S3-compatible service

**Key Features:**
- Storage abstraction layer for unified interface
- Admin-only S3 configuration management
- Separated local/S3 views with independent navigation
- Session-based S3 connections
- Role-based access control
- Audit logging for all S3 operations
- Connection testing before saving
