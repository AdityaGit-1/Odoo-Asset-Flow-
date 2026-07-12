"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR of the asset tag — scanning yields the tag, which is just the `tag=` filter. */
export function TagQr({ value, size = 96 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: "#17191F", light: "#FFFFFF" } })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return <div aria-hidden style={{ width: size, height: size }} className="rounded-md bg-hover" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR code for ${value}`} width={size} height={size} className="rounded-md border border-hairline" />;
}
