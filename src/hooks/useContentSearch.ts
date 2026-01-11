import { useCallback, useEffect, useState } from "react";
import { CONTENT_SEARCH_DEBOUNCE_MS } from "../constants";
import { apiFetch, readJson } from "../services/api";

type ContentSearchOptions = {
  enabled: boolean;
  query: string;
  path: string;
  showTrash: boolean;
  onUnauthorized: () => void;
  onError: (message: string) => void;
};

export function useContentSearch({
  enabled,
  query,
  path,
  showTrash,
  onUnauthorized,
  onError,
}: ContentSearchOptions) {
  const [matches, setMatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setMatches(new Set());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || showTrash) {
      reset();
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      reset();
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiFetch(
          `/search?path=${encodeURIComponent(path)}&query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) {
          const data = await readJson(response);
          onError(data?.error ?? "Content search failed.");
          setMatches(new Set());
          return;
        }
        const data = (await response.json()) as { matches: Array<{ name: string }> };
        setMatches(new Set(data.matches.map((match) => match.name)));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          onError("Content search failed.");
          setMatches(new Set());
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, showTrash, query, path, onUnauthorized, onError, reset]);

  return { matches, loading, reset };
}
