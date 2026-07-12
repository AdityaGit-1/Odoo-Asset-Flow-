"use client";

import { useEffect, useState } from "react";

/**
 * Read a query param client-side after mount — avoids the Suspense boundary
 * `useSearchParams` demands in fully client-rendered pages.
 */
export function useQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
