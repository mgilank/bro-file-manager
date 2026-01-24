export interface StorageEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: Date;
  key?: string; // S3 object key
}

export interface StorageConfig {
  type: "local" | "s3";
}

export interface LocalStorageConfig extends StorageConfig {
  type: "local";
  root: string;
}

export interface S3StorageConfig extends StorageConfig {
  type: "s3";
  region: string;
  endpoint?: string; // For Cloudflare R2 and other S3-compatible services
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix?: string; // Optional prefix for all keys
}

export interface StorageAdapter {
  list(path: string, options?: { limit?: number; offset?: number }): Promise<{ entries: StorageEntry[]; total: number }>;
  stat(path: string): Promise<StorageEntry | null>;
  read(path: string): Promise<Buffer>;
  write(path: string, content: Buffer): Promise<void>;
  delete(path: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getPublicUrl(path: string): string;
}
