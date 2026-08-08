import React, { useEffect, useState, useCallback, useRef } from "react";
import { useUser } from "@clerk/clerk-react";
import { Redirect } from "wouter";
import logoFull from "@/assets/logo-hero.jpg";

const ADMIN_EMAIL = "amandathecarpenter@gmail.com";
const ADMIN_STATS_KEY = import.meta.env.VITE_ADMIN_STATS_KEY as string | undefined;
const REFRESH_MS = 45000;

// ── Types (mirrors /api/admin/dashboard response) ────────────────
interface DashboardData {
  generatedAt: string;
  analytics: {
    visitors7d: number | null;
    pageViews7d: number | null;
    dailyCounts7d: { date: string; visitors: number; pageViews: number }[];
    visitorsToday: number | null;
    pageViewsToday: number | null;
    visitorsLastHour: number | null;
    requestsLastHour: number | null;
    topPagesToday: { path: string; count: number }[];
    topCountriesToday: { country: string; count: number }[];
    trafficSourcesToday: { source: string; count: number }[];
    trafficSources7d: { source: string; count: number }[];
    error: string | null;
  };
  revenue: {
    mrr: number;
    mrrSource: "stripe" | "clerk_estimate";
    stripeMrr: number | null;
    stripeActiveSubscriptions: number;
    estimatedMrr: number;
    stripeError: string | null;
    individualSubscribers: number;
    teamSeatsActive: number;
    teamOrgs: number;
    totalUsers: number;
    newSignups7d: number;
    newSignups30d: number;
    note: string;
  };
  usageAndCost: {
    last30Days: {
      totalJobs: number;
      totalPages: number;
      totalCostUsd: number;
      avgCostPerPageUsd: number | null;
      byType: Record<string, { jobs: number; pages: number; inputTokens: number; outputTokens: number }>;
    };
    allTime: { totalJobs: number; totalPages: number; totalCostUsd: number };
    dailyCounts14d: { date: string; jobs: number; pages: number; failed: number }[];
  };
  health: {
    last24h: { total: number; failed: number; completed: number };
    last7d: { total: number; failed: number; completed: number };
    recentFailures: { id: number; type: string; inputName: string | null; errorMessage: string | null; createdAt: number }[];
  };
  checkerUsage: {
    last90Days: number;
    last30Days: number;
    completed: number;
    failed: number;
    recent: {
      id: number;
      fileName: string;
      fileType: string;
      status: string;
      score: number | null;
      criticalCount: number | null;
      warningCount: number | null;
      createdAt: number;
    }[];
  };
  recentActivity: { id: number; type: string; status: string; inputName: string | null; pageCount: number | null; creditsUsed: number | null; createdAt: number; submittedBy: string | null }[];
}

// ── Links data (unchanged from previous version) ──────────────────
const platforms = [
  { name: "Railway", desc: "App hosting & deployment", url: "https://railway.app", icon: "🚂", color: "#7c3aed" },
  { name: "GitHub", desc: "Code repository (acm-site)", url: "https://github.com/amandacarpenter/acm-site", icon: "🐙", color: "#24292e" },
  { name: "Cloudflare", desc: "DNS for all domains", url: "https://dash.cloudflare.com", icon: "🌩️", color: "#f6821f" },
  { name: "Clerk", desc: "User authentication", url: "https://dashboard.clerk.com", icon: "🔐", color: "#6c47ff" },
  { name: "Zoho Mail", desc: "hello@remedy508.com", url: "https://mail.zoho.com", icon: "📧", color: "#e42527" },
  { name: "Formspree", desc: "Contact & waitlist forms", url: "https://formspree.io", icon: "📋", color: "#e85d04" },
  { name: "Stripe", desc: "Payments", url: "https://dashboard.stripe.com", icon: "💳", color: "#635bff" },
  { name: "Anthropic", desc: "Claude API — powers the accessibility pipeline", url: "https://console.anthropic.com", icon: "🤖", color: "#d97757" },
  { name: "Namecheap", desc: "leftcoastlearningllc.com registrar", url: "https://namecheap.com", icon: "🌐", color: "#de3723" },
  { name: "Porkbun", desc: "remedy508.ai registrar", url: "https://porkbun.com", icon: "🐷", color: "#f472b6" },
  { name: "Google Analytics", desc: "remedy508.com traffic (GA4)", url: "https://analytics.google.com", icon: "📊", color: "#e8710a" },
];

const socials = [
  { name: "LinkedIn", desc: "linkedin.com/company/remedy508", url: "https://www.linkedin.com/company/remedy508", icon: "💼", color: "#0077b5" },
  { name: "Instagram", desc: "@remedy508app", url: "https://www.instagram.com/remedy508app/", icon: "📸", color: "#e1306c" },
  { name: "Buffer", desc: "Social media scheduling", url: "https://buffer.com", icon: "📅", color: "#168eea" },
  { name: "YouTube", desc: "@Remedy508", url: "https://www.youtube.com/@Remedy508", icon: "🎥", color: "#ff0000" },
];

const sites = [
  { name: "remedy508.com", desc: "Main site", url: "https://remedy508.com", status: "live" },
  { name: "remedy508.ai", desc: "AI domain", url: "https://remedy508.ai", status: "live" },
  { name: "leftcoastlearningllc.com", desc: "Parent company site", url: "https://leftcoastlearningllc.com", status: "live" },
  { name: "Railway (direct)", desc: "Direct app URL", url: "https://acm-site-production.up.railway.app", status: "live" },
];

// ── Shared components ──────────────────────────────────────────────
function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: "1.05rem", color: "#111827", margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: "0.78rem", color: "#6b7280", margin: "2px 0 0" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "14px 16px",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, border-color 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.borderColor = "#0d9488"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(13,148,136,0.12)"; }}}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneColor = tone === "good" ? "#0d9488" : tone === "bad" ? "#dc2626" : tone === "warn" ? "#d97706" : "#111827";
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: "1.55rem", fontWeight: 700, color: toneColor, fontFamily: "'Clash Display', sans-serif", marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>{children}</div>;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Mini bar chart (no chart library dependency — inline SVG) ──────
function MiniBarChart({ data }: { data: { date: string; jobs: number; failed: number }[] }) {
  if (!data.length) return <div style={{ fontSize: "0.78rem", color: "#9ca3af", padding: "12px 0" }}>No job data yet</div>;
  const max = Math.max(1, ...data.map(d => d.jobs));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80, overflowX: "auto", paddingBottom: 2 }}>
      {data.map(d => {
        const h = Math.max(3, (d.jobs / max) * 70);
        const hasFailed = d.failed > 0;
        return (
          <div key={d.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1 0 18px", minWidth: 18 }} title={`${d.date}: ${d.jobs} jobs, ${d.failed} failed`}>
            <div style={{ width: "100%", maxWidth: 20, height: h, background: hasFailed ? "#f59e0b" : "#0d9488", borderRadius: 3 }} />
            <div style={{ fontSize: "0.55rem", color: "#9ca3af", marginTop: 4, whiteSpace: "nowrap" }}>{d.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dashboard section ────────────────────────────────────────────
function LiveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!ADMIN_STATS_KEY) {
      setError("VITE_ADMIN_STATS_KEY is not configured for this build — dashboard data can't load.");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?key=${encodeURIComponent(ADMIN_STATS_KEY)}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastFetched(Date.now());
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = window.setInterval(() => fetchData(true), REFRESH_MS);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("admin-dashboard-refresh", handler);
    return () => window.removeEventListener("admin-dashboard-refresh", handler);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "32px 20px", textAlign: "center", color: "#6b7280", fontSize: "0.85rem" }}>
        Loading live dashboard…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "20px", color: "#991b1b", fontSize: "0.85rem" }}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { revenue, usageAndCost, health, checkerUsage, recentActivity, analytics } = data;
  const failRate24h = health.last24h.total > 0 ? (health.last24h.failed / health.last24h.total) * 100 : 0;

  return (
    <div>
      {error && (
        <div style={{ fontSize: "0.75rem", color: "#dc2626", marginBottom: 20 }}>refresh failed, showing last good data</div>
      )}

      {/* Revenue & Subscribers */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader
          title="Revenue & Subscribers"
          subtitle={revenue.mrrSource === "stripe" ? "Live from Stripe — active + past_due subscriptions, trials excluded" : "Stripe unavailable — estimated from Clerk plan metadata"}
        />
        <StatGrid>
          <StatCard
            label={revenue.mrrSource === "stripe" ? "MRR (Stripe)" : "Est. MRR"}
            value={`$${revenue.mrr.toLocaleString()}`}
            tone="good"
            sub={revenue.mrrSource === "stripe" ? `${revenue.stripeActiveSubscriptions} active subscription${revenue.stripeActiveSubscriptions === 1 ? "" : "s"}` : revenue.stripeError || undefined}
          />
          <StatCard label="Individual Subs" value={String(revenue.individualSubscribers)} />
          <StatCard label="Team Seats" value={String(revenue.teamSeatsActive)} sub={`${revenue.teamOrgs} team org${revenue.teamOrgs === 1 ? "" : "s"}`} />
          <StatCard label="Total Users" value={String(revenue.totalUsers)} />
          <StatCard label="New (7d)" value={String(revenue.newSignups7d)} />
          <StatCard label="New (30d)" value={String(revenue.newSignups30d)} />
        </StatGrid>
      </div>

      {/* Site Traffic (Google Analytics) */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Site Traffic" subtitle={analytics.error ? "Google Analytics unavailable" : "Live from Google Analytics (GA4) — remedy508.com"} />
        {analytics.error ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 16px", color: "#991b1b", fontSize: "0.8rem" }}>
            {analytics.error}
          </div>
        ) : (
          <>
            {/* Live Now — standalone callout, separate from the daily/7d stat grid */}
            <div style={{ background: "#111827", borderRadius: 12, padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 0 4px rgba(34,197,94,0.25)" }} />
                <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Live Now (Active Users)</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "1.7rem", fontWeight: 700, color: "#fff", fontFamily: "'Clash Display', sans-serif" }}>
                  {analytics.visitorsLastHour != null ? analytics.visitorsLastHour.toLocaleString() : "—"}
                </span>
                <span style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                  visitors right now
                </span>
              </div>
            </div>

            <StatGrid>
              <StatCard label="Visitors (7d)" value={analytics.visitors7d != null ? analytics.visitors7d.toLocaleString() : "—"} tone="good" sub="real users" />
              <StatCard label="Page Views (7d)" value={analytics.pageViews7d != null ? analytics.pageViews7d.toLocaleString() : "—"} />
              <StatCard label="Visitors Today" value={analytics.visitorsToday != null ? analytics.visitorsToday.toLocaleString() : "—"} tone="good" sub="real users" />
              <StatCard label="Page Views Today" value={analytics.pageViewsToday != null ? analytics.pageViewsToday.toLocaleString() : "—"} />
            </StatGrid>

            {analytics.dailyCounts7d.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>PAGE VIEWS PER DAY (7 DAYS)</div>
                <MiniBarChart data={analytics.dailyCounts7d.map(d => ({ date: d.date, jobs: d.pageViews, failed: 0 }))} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>TRAFFIC SOURCES TODAY</div>
                {analytics.trafficSourcesToday.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>No data</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analytics.trafficSourcesToday.map((s) => (
                      <div key={s.source} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: "#374151" }}>{s.source}</span>
                        <span style={{ color: "#111827", fontWeight: 600 }}>{s.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>TRAFFIC SOURCES (7 DAYS)</div>
                {analytics.trafficSources7d.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>No data</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analytics.trafficSources7d.map((s) => (
                      <div key={s.source} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: "#374151" }}>{s.source}</span>
                        <span style={{ color: "#111827", fontWeight: 600 }}>{s.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>TOP PAGES TODAY</div>
                {analytics.topPagesToday.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>No data</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analytics.topPagesToday.map((p) => (
                      <div key={p.path} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: "#374151", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{p.path}</span>
                        <span style={{ color: "#111827", fontWeight: 600, flexShrink: 0 }}>{p.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>TOP COUNTRIES TODAY</div>
                {analytics.topCountriesToday.length === 0 ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>No data</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analytics.topCountriesToday.map((c) => (
                      <div key={c.country} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <span style={{ color: "#374151" }}>{c.country}</span>
                        <span style={{ color: "#111827", fontWeight: 600 }}>{c.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Free Accessibility Checker */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader
          title="Free Checker Usage"
          subtitle="Filename and basic check metadata only — document contents stay in the visitor's browser"
        />
        <StatGrid>
          <StatCard label="Checks (90d)" value={String(checkerUsage.last90Days)} tone="good" />
          <StatCard label="Checks (30d)" value={String(checkerUsage.last30Days)} />
          <StatCard label="Completed" value={String(checkerUsage.completed)} />
          <StatCard label="Failed" value={String(checkerUsage.failed)} tone={checkerUsage.failed > 0 ? "warn" : "good"} />
        </StatGrid>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginTop: 12 }}>
          {checkerUsage.recent.length === 0 && (
            <div style={{ padding: "16px", fontSize: "0.8rem", color: "#9ca3af" }}>No checker activity yet</div>
          )}
          {checkerUsage.recent.map((event, index) => (
            <div
              key={event.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 14px",
                borderTop: index === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {event.fileName}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 2 }}>
                  {event.fileType}
                  {event.score != null ? ` · ${event.score}/100` : ""}
                  {event.criticalCount != null ? ` · ${event.criticalCount} critical` : ""}
                  {event.warningCount != null ? ` · ${event.warningCount} warnings` : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 20,
                  whiteSpace: "nowrap",
                  background: event.status === "completed" ? "#dcfce7" : "#fee2e2",
                  color: event.status === "completed" ? "#15803d" : "#991b1b",
                }}
              >
                {event.status.toUpperCase()}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af", whiteSpace: "nowrap" }}>{timeAgo(event.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage & Cost */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Usage & Cost" subtitle="Real logged Anthropic token usage, last 30 days" />
        <StatGrid>
          <StatCard label="Jobs (30d)" value={String(usageAndCost.last30Days.totalJobs)} />
          <StatCard label="Pages (30d)" value={String(usageAndCost.last30Days.totalPages)} />
          <StatCard label="API Cost (30d)" value={`$${usageAndCost.last30Days.totalCostUsd.toFixed(2)}`} />
          <StatCard label="Cost / Page" value={usageAndCost.last30Days.avgCostPerPageUsd != null ? `$${usageAndCost.last30Days.avgCostPerPageUsd.toFixed(4)}` : "—"} />
        </StatGrid>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginTop: 12 }}>
          <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>JOBS PER DAY (14 DAYS) — orange bars had failures</div>
          <MiniBarChart data={usageAndCost.dailyCounts14d} />
        </div>
      </div>

      {/* Errors & Health */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeader title="Errors & Health" subtitle="Failed jobs are logged automatically when processing errors out" />
        <StatGrid>
          <StatCard label="Jobs (24h)" value={String(health.last24h.total)} />
          <StatCard
            label="Failed (24h)"
            value={String(health.last24h.failed)}
            tone={health.last24h.failed > 0 ? "bad" : "good"}
            sub={health.last24h.total > 0 ? `${failRate24h.toFixed(0)}% fail rate` : undefined}
          />
          <StatCard label="Jobs (7d)" value={String(health.last7d.total)} />
          <StatCard label="Failed (7d)" value={String(health.last7d.failed)} tone={health.last7d.failed > 0 ? "warn" : "good"} />
        </StatGrid>
        {health.recentFailures.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {health.recentFailures.map(f => (
              <div key={f.id} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#991b1b" }}>{f.type} {f.inputName ? `· ${f.inputName}` : ""}</span>
                  <span style={{ fontSize: "0.7rem", color: "#b91c1c", whiteSpace: "nowrap" }}>{timeAgo(f.createdAt)}</span>
                </div>
                {f.errorMessage && <div style={{ fontSize: "0.72rem", color: "#7f1d1d", marginTop: 3, wordBreak: "break-word" }}>{f.errorMessage}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ marginBottom: 8 }}>
        <SectionHeader title="Recent Activity" />
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {recentActivity.length === 0 && <div style={{ padding: "16px", fontSize: "0.8rem", color: "#9ca3af" }}>No jobs yet</div>}
          {recentActivity.map((j, i) => (
            <div
              key={j.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{j.type}</span>
                  {j.inputName && <span style={{ fontSize: "0.75rem", color: "#6b7280" }}> · {j.inputName}</span>}
                </div>
                {j.submittedBy && (
                  <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {j.submittedBy}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap",
                  background: j.status === "completed" ? "#dcfce7" : j.status === "failed" ? "#fee2e2" : "#fef3c7",
                  color: j.status === "completed" ? "#15803d" : j.status === "failed" ? "#991b1b" : "#92400e",
                }}
              >
                {j.status.toUpperCase()}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#9ca3af", whiteSpace: "nowrap" }}>{timeAgo(j.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function AdminPortal() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;
  if (!user || user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return <Redirect to="/" />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'General Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", padding: "28px 20px", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <img src={logoFull} alt="Remedy508" style={{ height: 48, width: "auto" }} />
          <h1 style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#fff", margin: 0, letterSpacing: "0.02em" }}>
            Admin Dashboard
          </h1>
          <button
            onClick={() => window.dispatchEvent(new Event("admin-dashboard-refresh"))}
            style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span aria-hidden="true">↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 48px" }}>

        {/* Live Dashboard — the main event */}
        <div style={{ marginBottom: 36 }}>
          <LiveDashboard />
        </div>

        {/* Live Sites */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Live Sites" subtitle="All currently deployed properties" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {sites.map(s => (
              <Card key={s.name} onClick={() => window.open(s.url, "_blank")}>
                <span style={{ fontSize: "1.1rem" }}>🌐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827" }}>{s.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{s.desc}</div>
                </div>
                <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>LIVE</span>
              </Card>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader title="Platforms" subtitle="All connected tools and services" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {platforms.map(p => (
              <Card key={p.name} onClick={() => window.open(p.url, "_blank")}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827" }}>{p.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Social */}
        <div style={{ marginBottom: 8 }}>
          <SectionHeader title="Social Media" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {socials.map(s => (
              <Card key={s.name} onClick={() => window.open(s.url, "_blank")}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827" }}>{s.name}</div>
                  <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{s.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
