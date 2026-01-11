import { FILE_TYPE_GROUPS, TEXT_PREVIEW_EXTS } from "../constants";
import type { Entry, TypeFilter } from "../types";
import { getFileExtension } from "./path";

export type FileCategory = (typeof FILE_TYPE_GROUPS)[number]["key"] | "other";

export function getFileCategory(name: string): FileCategory {
  const ext = getFileExtension(name);
  if (!ext) {
    return "other";
  }
  for (const group of FILE_TYPE_GROUPS) {
    if (group.exts.includes(ext)) {
      return group.key;
    }
  }
  return "other";
}

export function matchesTypeFilter(entry: Entry, filter: TypeFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "dir") {
    return entry.type === "dir";
  }
  if (filter === "file") {
    return entry.type === "file";
  }
  if (entry.type !== "file") {
    return false;
  }
  const category = getFileCategory(entry.name);
  if (filter === "other") {
    return category === "other";
  }
  return category === filter;
}

export function isTextPreviewableName(name: string) {
  return TEXT_PREVIEW_EXTS.has(getFileExtension(name));
}

export function isImagePreviewable(name: string) {
  return getFileCategory(name) === "image";
}
