import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

const VISITOR_COOKIE = "r508_visitor";
const ENGAGED_COOKIE = "r508_engaged_date";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax; Secure`;
}

function getVisitorId(): string {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const visitorId = crypto.randomUUID();
  writeCookie(VISITOR_COOKIE, visitorId, 90 * 24 * 60 * 60);
  return visitorId;
}

function localDate(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function LikelyHumanTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    const userAgent = navigator.userAgent || "";
    const excluded =
      path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/kb/admin" ||
      path.startsWith("/kb/admin/") ||
      params.get("qa") === "1" ||
      params.get("test") === "1" ||
      navigator.webdriver ||
      /HeadlessChrome|Playwright|Puppeteer|bot|crawler|spider/i.test(userAgent);
    if (excluded || readCookie(ENGAGED_COOKIE) === localDate()) return;

    let interacted = false;
    let visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
    let visibleMs = 0;
    let sent = false;

    const markInteraction = () => {
      interacted = true;
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince = Date.now();
      } else if (visibleSince) {
        visibleMs += Date.now() - visibleSince;
        visibleSince = 0;
      }
    };
    const timer = window.setInterval(async () => {
      const currentVisibleMs = visibleMs + (visibleSince ? Date.now() - visibleSince : 0);
      if (sent || !interacted || currentVisibleMs < 3000) return;
      sent = true;
      try {
        await apiRequest("POST", "/api/likely-human-visit", {
          visitorId: getVisitorId(),
          path: window.location.pathname,
          engagedMs: Math.round(currentVisibleMs),
          interaction: true,
        });
        writeCookie(ENGAGED_COOKIE, localDate(), 2 * 24 * 60 * 60);
      } catch {
        sent = false;
      }
    }, 1000);

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markInteraction, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, markInteraction));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
