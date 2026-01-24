import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "fs";
import { join } from "path";
import { LocalStorageAdapter } from "../../server/storage/adapters";
import { S3StorageAdapter } from "../../server/storage/adapters";

describe("LocalStorageAdapter", () => {
  let testDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    testDir = `/tmp/bro-filemanager-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    adapter = new LocalStorageAdapter(testDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("should list files in a directory", async () => {
    // Create test files
    await fs.writeFile(join(testDir, "test.txt"), "hello");
    await fs.mkdir(join(testDir, "subdir"));

    const { entries, total } = await adapter.list("/");
    expect(total).toBe(2);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.name === "test.txt")?.type).toBe("file");
    expect(entries.find((e) => e.name === "subdir")?.type).toBe("directory");
  });

  it("should sort directories before files", async () => {
    await fs.writeFile(join(testDir, "a.txt"), "hello");
    await fs.mkdir(join(testDir, "z-folder"));

    const { entries } = await adapter.list("/");
    expect(entries[0].type).toBe("directory");
    expect(entries[0].name).toBe("z-folder");
    expect(entries[1].type).toBe("file");
    expect(entries[1].name).toBe("a.txt");
  });

  it("should read file stats", async () => {
    await fs.writeFile(join(testDir, "test.txt"), "hello world");

    const stat = await adapter.stat("/test.txt");
    expect(stat).toBeTruthy();
    expect(stat?.name).toBe("test.txt");
    expect(stat?.type).toBe("file");
    expect(stat?.size).toBe(11);
  });

  it("should return null for non-existent file stat", async () => {
    const stat = await adapter.stat("/non-existent.txt");
    expect(stat).toBeNull();
  });

  it("should read file content", async () => {
    await fs.writeFile(join(testDir, "test.txt"), "hello world");

    const content = await adapter.read("/test.txt");
    expect(content.toString()).toBe("hello world");
  });

  it("should write file content", async () => {
    await adapter.write("/test.txt", Buffer.from("hello"));

    const content = await fs.readFile(join(testDir, "test.txt"));
    expect(content.toString()).toBe("hello");
  });

  it("should delete file", async () => {
    await fs.writeFile(join(testDir, "test.txt"), "hello");

    await adapter.delete("/test.txt");

    const exists = await adapter.exists("/test.txt");
    expect(exists).toBe(false);
  });

  it("should move file", async () => {
    await fs.writeFile(join(testDir, "source.txt"), "hello");

    await adapter.move("/source.txt", "/dest.txt");

    expect(await adapter.exists("/source.txt")).toBe(false);
    expect(await adapter.exists("/dest.txt")).toBe(true);
  });

  it("should copy file", async () => {
    await fs.writeFile(join(testDir, "source.txt"), "hello");

    await adapter.copy("/source.txt", "/copy.txt");

    expect(await adapter.exists("/source.txt")).toBe(true);
    expect(await adapter.exists("/copy.txt")).toBe(true);
  });

  it("should create directory", async () => {
    await adapter.mkdir("/new-dir");

    const stat = await adapter.stat("/new-dir");
    expect(stat?.type).toBe("directory");
  });

  it("should check file existence", async () => {
    expect(await adapter.exists("/test.txt")).toBe(false);

    await fs.writeFile(join(testDir, "test.txt"), "hello");

    expect(await adapter.exists("/test.txt")).toBe(true);
  });

  it("should prevent path traversal", async () => {
    await expect(adapter.stat("../../../etc/passwd")).rejects.toThrow();
  });

  it("should handle pagination", async () => {
    // Create multiple files
    for (let i = 1; i <= 5; i++) {
      await fs.writeFile(join(testDir, `file${i}.txt`), `content${i}`);
    }

    const { entries, total } = await adapter.list("/", { limit: 2, offset: 1 });
    expect(total).toBe(5);
    expect(entries).toHaveLength(2);
  });

  it("should generate public URL", async () => {
    const url = adapter.getPublicUrl("/test/file.txt");
    expect(url).toBe("/api/download?path=%2Ftest%2Ffile.txt");
  });
});

describe("S3StorageAdapter", () => {
  it("should connect to S3 with credentials", () => {
    const adapter = new S3StorageAdapter({
      region: "auto",
      endpoint: "https://example.com",
      accessKeyId: "test",
      secretAccessKey: "test",
      bucket: "test-bucket",
    });
    expect(adapter).toBeDefined();
  });

  // Note: Full integration tests would require a mock S3 server or localstack
  // These would be added in Task 12
});
