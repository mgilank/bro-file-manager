import type { StorageMode } from "../types";

interface StorageSwitcherProps {
  mode: StorageMode;
  onModeChange: (mode: StorageMode) => void;
  s3Connected?: boolean;
  s3ConfigName?: string;
}

export function StorageSwitcher({ mode, onModeChange, s3Connected, s3ConfigName }: StorageSwitcherProps) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => onModeChange("local")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "local"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Local Files
        </span>
      </button>
      <button
        onClick={() => onModeChange("s3")}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          mode === "s3"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          S3 Storage
          {s3Connected && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              {s3ConfigName || "Connected"}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
