import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function sendSubscription(sub: PushSubscription) {
  const subJson = sub.toJSON() as any;
  const keys = subJson.keys || {};
  fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: keys.p256dh || "",
        auth: keys.auth || "",
      },
    }),
    credentials: "include",
  }).catch(() => {});
}

export function PushSetup() {
  const { user } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!user || attempted.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;
    attempted.current = true;

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.ready;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          sendSubscription(existing);
          return;
        }

        if (Notification.permission !== "granted") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }

        const keyRes = await fetch("/api/vapid-public-key");
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        sendSubscription(sub);
      } catch {}
    }

    setup();
  }, [user]);

  return null;
}
