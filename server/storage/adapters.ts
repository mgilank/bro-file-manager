import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { promises as fs } from "fs";
import { join, normalize } from "path";
import type { StorageAdapter, StorageEntry, S3StorageConfig } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private root: string) {
    this.root = normalize(root);
  }

  private resolvePath(path: string): string {
    const resolved = normalize(join(this.root, path));
    if (!resolved.startsWith(this.root)) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  }

  async list(path: string, options: { limit?: number; offset?: number } = {}): Promise<{ entries: StorageEntry[]; total: number }> {
    const fullPath = this.resolvePath(path);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const mapped: StorageEntry[] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(fullPath, entry.name);
        const stats = await fs.stat(entryPath);
        return {
          name: entry.name,
          path: join(path, entry.name).replace(/\\/g, "/"),
          type: entry.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime,
        };
      })
    );

    // Sort: directories first, then by name
    mapped.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const { limit, offset = 0 } = options;
    const total = mapped.length;
    const paginated = limit ? mapped.slice(offset, offset + limit) : mapped;

    return { entries: paginated, total };
  }

  async stat(path: string): Promise<StorageEntry | null> {
    const fullPath = this.resolvePath(path);
    try {
      const stats = await fs.stat(fullPath);
      return {
        name: path.split("/").pop() || "",
        path,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.size,
        modified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  async read(path: string): Promise<Buffer> {
    const fullPath = this.resolvePath(path);
    return await fs.readFile(fullPath);
  }

  async write(path: string, content: Buffer): Promise<void> {
    const fullPath = this.resolvePath(path);
    await fs.mkdir(this.resolvePath(path.split("/").slice(0, -1).join("/")), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.resolvePath(path);
    await fs.rm(fullPath, { recursive: true });
  }

  async move(source: string, destination: string): Promise<void> {
    const srcPath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);
    await fs.mkdir(this.resolvePath(destination.split("/").slice(0, -1).join("/")), { recursive: true });
    await fs.rename(srcPath, destPath);
  }

  async copy(source: string, destination: string): Promise<void> {
    const srcPath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);
    await fs.mkdir(this.resolvePath(destination.split("/").slice(0, -1).join("/")), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }

  async mkdir(path: string): Promise<void> {
    const fullPath = this.resolvePath(path);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(path: string): string {
    return `/api/download?path=${encodeURIComponent(path)}`;
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || "";

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private normalizeKey(path: string): string {
    // Remove leading slash and add prefix
    const cleanPath = path.replace(/^\//, "").replace(/\/$/, "");
    return this.prefix ? `${this.prefix}/${cleanPath}` : cleanPath;
  }

  private stripPrefix(key: string): string {
    if (this.prefix && key.startsWith(`${this.prefix}/`)) {
      return key.slice(this.prefix.length + 1);
    }
    return key;
  }

  async list(path: string, options: { limit?: number; offset?: number } = {}): Promise<{ entries: StorageEntry[]; total: number }> {
    const prefix = this.normalizeKey(path);
    const delimiter = "/";

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: options.limit || 1000,
    });

    const response = await this.client.send(command);

    const entries: StorageEntry[] = [];

    // Add directories (CommonPrefixes)
    for (const prefixItem of response.CommonPrefixes || []) {
      const name = this.stripPrefix(prefixItem.Prefix || "").split("/").filter(Boolean).pop() || "";
      entries.push({
        name,
        path: `/${this.stripPrefix(prefixItem.Prefix || "")}`,
        type: "directory",
        size: 0,
        modified: new Date(),
      });
    }

    // Add files (Contents)
    for (const object of response.Contents || []) {
      if (object.Key && object.Key !== prefix) {
        const name = this.stripPrefix(object.Key).split("/").pop() || "";
        entries.push({
          name,
          path: `/${this.stripPrefix(object.Key)}`,
          type: "file",
          size: object.Size || 0,
          modified: object.LastModified || new Date(),
        });
      }
    }

    // Sort: directories first, then by name
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      entries: options.offset ? entries.slice(options.offset) : entries,
      total: entries.length,
    };
  }

  async stat(path: string): Promise<StorageEntry | null> {
    const key = this.normalizeKey(path);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        name: path.split("/").pop() || "",
        path,
        type: "file",
        size: response.ContentLength || 0,
        modified: response.LastModified || new Date(),
      };
    } catch {
      // Check if it's a "directory" by listing its contents
      const listCmd = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${key}/`,
        MaxKeys: 1,
      });

      try {
        const listResponse = await this.client.send(listCmd);
        if (listResponse.Contents && listResponse.Contents.length > 0) {
          return {
            name: path.split("/").pop() || "",
            path,
            type: "directory",
            size: 0,
            modified: new Date(),
          };
        }
      } catch {}

      return null;
    }
  }

  async read(path: string): Promise<Buffer> {
    const key = this.normalizeKey(path);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error("Empty response body");
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async write(path: string, content: Buffer): Promise<void> {
    const key = this.normalizeKey(path);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
    });

    await this.client.send(command);
  }

  async delete(path: string): Promise<void> {
    const key = this.normalizeKey(path);

    // Check if it's a directory with contents
    const listCmd = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: `${key}/`,
    });

    const listResponse = await this.client.send(listCmd);

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      // Delete all objects with this prefix
      for (const object of listResponse.Contents) {
        if (object.Key) {
          const deleteCmd = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: object.Key,
          });
          await this.client.send(deleteCmd);
        }
      }
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async move(source: string, destination: string): Promise<void> {
    await this.copy(source, destination);
    await this.delete(source);
  }

  async copy(source: string, destination: string): Promise<void> {
    const sourceKey = this.normalizeKey(source);
    const destKey = this.normalizeKey(destination);

    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destKey,
    });

    await this.client.send(command);
  }

  async mkdir(path: string): Promise<void> {
    // S3 doesn't have directories, create a placeholder object
    const key = this.normalizeKey(path).replace(/\/$/, "") + "/";

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: "",
    });

    await this.client.send(command);
  }

  async exists(path: string): Promise<boolean> {
    const stat = await this.stat(path);
    return stat !== null;
  }

  getPublicUrl(path: string): string {
    return `/api/s3/download?path=${encodeURIComponent(path)}`;
  }
}
