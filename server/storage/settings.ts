import { promises as fs } from "fs";
import { join } from "path";
import type { S3StorageConfig } from "./types";

export interface AppSettings {
  s3Configs: S3ConfigProfile[];
}

export interface S3ConfigProfile {
  id: string;
  name: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix?: string;
  isDefault?: boolean;
  active?: boolean;
}

const SETTINGS_PATH = join(process.cwd(), "data", "settings.json");

function normalizeConfig(config: S3ConfigProfile): S3ConfigProfile {
  return { ...config, active: config.active !== false };
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const content = await fs.readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    // Return default settings if file doesn't exist
    return { s3Configs: [] };
  }
}

export async function writeSettings(settings: AppSettings): Promise<void> {
  const dir = join(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function addS3Config(config: Omit<S3ConfigProfile, "id">): Promise<S3ConfigProfile> {
  const settings = await readSettings();
  const newConfig: S3ConfigProfile = {
    ...config,
    active: config.active !== false,
    id: crypto.randomUUID(),
  };
  settings.s3Configs.push(newConfig);
  await writeSettings(settings);
  return normalizeConfig(newConfig);
}

export async function updateS3Config(id: string, updates: Partial<S3ConfigProfile>): Promise<S3ConfigProfile | null> {
  const settings = await readSettings();
  const index = settings.s3Configs.findIndex((c) => c.id === id);
  if (index === -1) return null;

  settings.s3Configs[index] = normalizeConfig({ ...settings.s3Configs[index], ...updates });
  await writeSettings(settings);
  return settings.s3Configs[index];
}

export async function deleteS3Config(id: string): Promise<boolean> {
  const settings = await readSettings();
  const index = settings.s3Configs.findIndex((c) => c.id === id);
  if (index === -1) return false;

  settings.s3Configs.splice(index, 1);
  await writeSettings(settings);
  return true;
}

export async function getS3Config(id: string): Promise<S3ConfigProfile | null> {
  const settings = await readSettings();
  const config = settings.s3Configs.find((c) => c.id === id) || null;
  return config ? normalizeConfig(config) : null;
}

export async function getAllS3Configs(): Promise<S3ConfigProfile[]> {
  const settings = await readSettings();
  return settings.s3Configs.map(normalizeConfig);
}

export function s3ConfigToStorageConfig(config: S3ConfigProfile): S3StorageConfig {
  return {
    type: "s3",
    region: config.region,
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    prefix: config.prefix,
  };
}
