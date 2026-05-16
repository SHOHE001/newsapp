"use client";

import { useState, useEffect } from "react";
import { subscribeUser, unsubscribeUser } from "@/app/actions";

// ---- PushNotificationManager ----------------------------------------

function PushNotificationManager() {
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] =
    useState<PushSubscription | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then(setSubscription);
      });
    }
  }, []);

  async function subscribe() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      setSubscription(sub);
      await subscribeUser(sub.toJSON());
      setStatus("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "購読に失敗しました");
      setStatus("error");
    }
  }

  async function unsubscribe() {
    setStatus("loading");
    setErrorMsg("");
    try {
      if (!subscription) return;
      await subscription.unsubscribe();
      await unsubscribeUser(subscription.endpoint);
      setSubscription(null);
      setStatus("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "解除に失敗しました");
      setStatus("error");
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-zinc-500">
        このブラウザはプッシュ通知に対応していません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {subscription
          ? "プッシュ通知は有効です。"
          : "プッシュ通知を有効にすると最新ニュースをお届けします。"}
      </p>
      {status === "error" && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}
      {subscription ? (
        <button
          onClick={unsubscribe}
          disabled={status === "loading"}
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          {status === "loading" ? "処理中…" : "通知を解除する"}
        </button>
      ) : (
        <button
          onClick={subscribe}
          disabled={status === "loading"}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {status === "loading" ? "処理中…" : "通知を有効にする"}
        </button>
      )}
    </div>
  );
}

// ---- InstallPrompt (iOS 向け案内) -------------------------------------

function InstallPrompt() {
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(/iphone|ipad|ipod/.test(ua));
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches
    );
  }, []);

  if (!isIos || isStandalone) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
        ホーム画面に追加できます
      </p>
      <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
        Safari の共有ボタン（
        <span aria-label="共有">⎙</span>
        ）をタップして「ホーム画面に追加」を選択してください。
      </p>
    </div>
  );
}

// ---- Page -------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const uint8 = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  return uint8.buffer as ArrayBuffer;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
      <header>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          設定
        </h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          プッシュ通知
        </h2>
        <PushNotificationManager />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          アプリをインストール
        </h2>
        <InstallPrompt />
      </section>
    </div>
  );
}
