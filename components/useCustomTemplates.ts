"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubtitleStyle } from "@/lib/types";
import {
  STORAGE_KEY,
  createCustomTemplate,
  parseTemplates,
  serializeTemplates,
} from "@/lib/templates";

// Persist user-saved subtitle templates in localStorage.
export function useCustomTemplates() {
  const [templates, setTemplates] = useState<SubtitleStyle[]>([]);

  // load once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTemplates(parseTemplates(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((list: SubtitleStyle[]) => {
    setTemplates(list);
    try {
      localStorage.setItem(STORAGE_KEY, serializeTemplates(list));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const save = useCallback(
    (name: string, style: SubtitleStyle) => {
      const tpl = createCustomTemplate(name, style);
      persist([...templates, tpl]);
      return tpl;
    },
    [templates, persist]
  );

  const remove = useCallback(
    (id: string) => persist(templates.filter((t) => t.id !== id)),
    [templates, persist]
  );

  return { templates, save, remove };
}
