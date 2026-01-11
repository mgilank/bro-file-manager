import type { Entry, SortMode } from "../types";
import { getFileExtension } from "./path";

const compareStrings = (left: string, right: string) =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const compareNumbers = (left: number, right: number) => {
  if (left === right) {
    return 0;
  }
  return left > right ? 1 : -1;
};

const getTypeKey = (entry: Entry) => {
  if (entry.type === "dir") {
    return "0-folder";
  }
  const ext = getFileExtension(entry.name);
  const label = ext ? ext.slice(1) : "file";
  return `1-${label}`;
};

export function sortEntries(entries: Entry[], sortMode: SortMode) {
  if (sortMode === "default") {
    return entries;
  }

  const sorted = [...entries];

  sorted.sort((left, right) => {
    switch (sortMode) {
      case "name-asc":
        return compareStrings(left.name, right.name);
      case "name-desc":
        return compareStrings(right.name, left.name);
      case "date-desc": {
        const byDate = compareNumbers(right.mtime, left.mtime);
        return byDate !== 0 ? byDate : compareStrings(left.name, right.name);
      }
      case "date-asc": {
        const byDate = compareNumbers(left.mtime, right.mtime);
        return byDate !== 0 ? byDate : compareStrings(left.name, right.name);
      }
      case "size-desc": {
        const bySize = compareNumbers(right.size, left.size);
        return bySize !== 0 ? bySize : compareStrings(left.name, right.name);
      }
      case "size-asc": {
        const bySize = compareNumbers(left.size, right.size);
        return bySize !== 0 ? bySize : compareStrings(left.name, right.name);
      }
      case "type-asc": {
        const byType = compareStrings(getTypeKey(left), getTypeKey(right));
        return byType !== 0 ? byType : compareStrings(left.name, right.name);
      }
      case "type-desc": {
        const byType = compareStrings(getTypeKey(right), getTypeKey(left));
        return byType !== 0 ? byType : compareStrings(left.name, right.name);
      }
      default:
        return 0;
    }
  });

  return sorted;
}
