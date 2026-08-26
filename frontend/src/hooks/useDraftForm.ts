"use client";

import { useCallback } from "react";
import { z } from "zod";

const META_KEY_PREFIX = "drafts:meta:"; // meta per-namespace
const DRAFT_KEY_PREFIX = "draft:";
const MAX_DRAFTS = 10;
const MAX_DRAFT_BYTES = 50 * 1024;

export type DraftMeta = {
  id: string;
  key: string;
  createdAt: string;
  updatedAt: string;
  size: number;
};

export function useDraftForm<T>(namespace: string, schema: z.ZodSchema<T>) {
  const metaKey = `${META_KEY_PREFIX}${namespace}`;

  const list = useCallback((): DraftMeta[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(metaKey);
      if (!raw) return [];
      return JSON.parse(raw) as DraftMeta[];
    } catch {
      return [];
    }
  }, [metaKey]);

  const save = useCallback(
    (data: T): string | null => {
      if (typeof window === "undefined") return null;
      try {
        const payload = JSON.stringify(data);
        const size = new Blob([payload]).size;
        if (size > MAX_DRAFT_BYTES) return null;

        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        const key = `${DRAFT_KEY_PREFIX}${namespace}:${id}`;
        localStorage.setItem(key, payload);

        const now = new Date().toISOString();
        const meta = list();
        meta.push({ id, key, createdAt: now, updatedAt: now, size });

        // Evict oldest if over limit
        if (meta.length > MAX_DRAFTS) {
          meta.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
          while (meta.length > MAX_DRAFTS) {
            const evicted = meta.shift();
            if (evicted) localStorage.removeItem(evicted.key);
          }
        }

        localStorage.setItem(metaKey, JSON.stringify(meta));
        return id;
      } catch {
        return null;
      }
    },
    [list, metaKey, namespace],
  );

  const load = useCallback((id?: string): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const meta = list();
      if (meta.length === 0) return null;
      const entry = id ? meta.find((m) => m.id === id) : meta.reduce((a,b) => a.updatedAt > b.updatedAt ? a : b);
      if (!entry) return null;
      const raw = localStorage.getItem(entry.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const validated = schema.parse(parsed);
      return validated;
    } catch {
      return null;
    }
  }, [list, schema]);

  const clear = useCallback((id?: string) => {
    if (typeof window === "undefined") return;
    try {
      const meta = list();
      if (id) {
        const idx = meta.findIndex((m) => m.id === id);
        if (idx !== -1) {
          localStorage.removeItem(meta[idx].key);
          meta.splice(idx, 1);
        }
      } else {
        // clear all for this namespace
        for (const m of meta) localStorage.removeItem(m.key);
        meta.splice(0, meta.length);
      }
      localStorage.setItem(metaKey, JSON.stringify(meta));
    } catch {
      // ignore
    }
  }, [list, metaKey]);

  return { save, load, clear, list };
}
