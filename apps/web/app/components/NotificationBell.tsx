"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NotificationScope = "customer" | "technician" | "admin";

type NotificationBellProps = {
  scope: NotificationScope;
  href: string;
  label?: string;
};

export default function NotificationBell({ scope, href, label = "Notificaciones" }: NotificationBellProps) {
  const [unread, setUnread] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    const loadUnread = async () => {
      try {
        const response = await fetch(`/api/notifications/unread-count?scope=${scope}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) setVisible(false);
          return;
        }
        const data = await response.json() as { unread?: number };
        if (!disposed) {
          setUnread(Math.max(0, Number(data.unread ?? 0)));
          setVisible(true);
        }
      } catch {}
    };

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/notifications/realtime?scope=${scope}`);
      socket.addEventListener("open", () => {
        attempt.current = 0;
        void loadUnread();
      });
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          if (payload.type === "notification") {
            setUnread((value) => value + 1);
            setVisible(true);
          }
        } catch {}
      });
      socket.addEventListener("close", () => {
        if (disposed) return;
        const delay = Math.min(30000, 500 * 2 ** attempt.current);
        attempt.current += 1;
        timer.current = setTimeout(connect, delay + Math.floor(Math.random() * Math.max(1, delay)));
      });
      socket.addEventListener("error", () => socket?.close());
    };

    void loadUnread();
    connect();

    return () => {
      disposed = true;
      if (timer.current) clearTimeout(timer.current);
      socket?.close();
    };
  }, [scope]);

  if (!visible) return null;

  return (
    <Link className="notification-bell" href={href} aria-label={label}>
      <span aria-hidden="true">♢</span>
      {unread > 0 ? <b>{unread > 99 ? "99+" : unread}</b> : null}
    </Link>
  );
}
