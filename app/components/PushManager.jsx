"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushManager() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot capability check on mount
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "ready");
    });
  }, []);

  const subscribe = async () => {
    setStatus("requesting");
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("misconfigured");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  };

  if (status === "unsupported" || status === "checking") return null;

  const label =
    status === "subscribed" ? "push notifications on" :
    status === "requesting" ? "requesting…" :
    status === "denied" ? "notifications blocked — enable in browser settings" :
    status === "misconfigured" ? "push not configured yet" :
    status === "error" ? "push registration failed — try again" :
    "enable push notifications";

  return (
    <button
      onClick={status === "ready" || status === "error" ? subscribe : undefined}
      disabled={status !== "ready" && status !== "error"}
      style={{
        background: "none",
        border: "1px solid #3A2F1C",
        color: status === "subscribed" ? "#FFB347" : "#A08A62",
        fontFamily: 'ui-monospace, "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, monospace',
        fontSize: 11,
        padding: "4px 10px",
        cursor: status === "ready" || status === "error" ? "pointer" : "default",
        marginBottom: 12,
      }}
    >
      {label}
    </button>
  );
}
