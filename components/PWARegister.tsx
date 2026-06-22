"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable (PWA).
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
