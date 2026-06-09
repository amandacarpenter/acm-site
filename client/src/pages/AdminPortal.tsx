import React from "react";
import { useUser } from "@clerk/clerk-react";
import { Redirect } from "wouter";

const ADMIN_EMAIL = "amandathecarpenter@gmail.com";

// ── Section data ──────────────────────────────────────────────
const platforms = [
  { name: "Railway", desc: "App hosting & deployment", url: "https://railway.app", icon: "🚂", color: "#7c3aed" },
  { name: "GitHub", desc: "Code repository (acm-site)", url: "https://github.com/amandacarpenter/acm-site", icon: "🐙", color: "#24292e" },
  { name: "Cloudflare", desc: "DNS for all domains", url: "https://dash.cloudflare.com", icon: "🌩️", color: "#f6821f" },
  { name: "Clerk", desc: "User authentication", url: "https://dashboard.clerk.com", icon: "🔐", color: "#6c47ff" },
  { name: "Zoho Mail", desc: "hello@remedy508.com", url: "https://mail.zoho.com", icon: "📧", color: "#e42527" },
  { name: "Formspree", desc: "Contact & waitlist forms", url: "https://formspree.io", icon: "📋", color: "#e85d04" },
  { name: "Stripe", desc: "Payments (setup pending)", url: "https://dashboard.stripe.com", icon: "💳", color: "#635bff" },
  { name: "Namecheap", desc: "leftcoastlearningllc.com registrar", url: "https://namecheap.com", icon: "🌐", color: "#de3723" },
  { name: "Porkbun", desc: "remedy508.ai registrar", url: "https://porkbun.com", icon: "🐷", color: "#f472b6" },
  { name: "Plausible", desc: "remedy508.com analytics", url: "https://plausible.io/remedy508.com", icon: "📊", color: "#5850ec" },
];

const socials = [
  { name: "LinkedIn", desc: "linkedin.com/company/remedy508", url: "https://www.linkedin.com/company/remedy508", icon: "💼", color: "#0077b5" },
  { name: "Instagram", desc: "@remedy508app", url: "https://www.instagram.com/remedy508app/", icon: "📸", color: "#e1306c" },
  { name: "Buffer", desc: "Social media scheduling", url: "https://buffer.com", icon: "📅", color: "#168eea" },
];

const sites = [
  { name: "remedy508.com", desc: "Main site — coming soon", url: "https://remedy508.com", status: "live" },
  { name: "remedy508.ai", desc: "AI domain", url: "https://remedy508.ai", status: "live" },
  { name: "leftcoastlearningllc.com", desc: "Parent company site", url: "https://leftcoastlearningllc.com", status: "live" },
  { name: "Railway (direct)", desc: "Direct app URL", url: "https://acm-site-production.up.railway.app", status: "live" },
];



// ── Components ────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#111827", marginBottom: 2 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>{subtitle}</p>}
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

export default function AdminPortal() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return null;
  if (!user || user.primaryEmailAddress?.emailAddress !== ADMIN_EMAIL) {
    return <Redirect to="/" />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'General Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", padding: "24px 32px", borderBottom: "1px solid #1f2937" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: "'Clash Display', sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "#fff", margin: 0 }}>
              Remedy<span style={{ color: "#0d9488" }}>508</span> Admin
            </h1>
            <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: "4px 0 0" }}>Mission Control — {user.firstName || "Amanda"}</p>
          </div>
          <span style={{ background: "#0d9488", color: "#fff", fontSize: "0.7rem", fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>PRIVATE</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Live Sites */}
        <div className="mb-10">
          <SectionHeader title="Live Sites" subtitle="All currently deployed properties" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {sites.map(s => (
              <Card key={s.name} onClick={() => window.open(s.url, "_blank")}>
                <span style={{ fontSize: "1.2rem" }}>🌐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>{s.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.desc}</div>
                </div>
                <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>LIVE</span>
              </Card>
            ))}
          </div>
        </div>

        {/* Platforms */}
        <div className="mb-10">
          <SectionHeader title="Platforms" subtitle="All connected tools and services" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {platforms.map(p => (
              <Card key={p.name} onClick={() => window.open(p.url, "_blank")}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>{p.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Social */}
        <div className="mb-10">
          <SectionHeader title="Social Media" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {socials.map(s => (
              <Card key={s.name} onClick={() => window.open(s.url, "_blank")}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>{s.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Analytics */}
        <div className="mb-10">
          <SectionHeader title="Analytics & Users" subtitle="Live data available once Stripe and Plausible Business are connected" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[{ label: "Active Users", value: "—", note: "Clerk" }, { label: "Monthly Revenue", value: "—", note: "Stripe" }, { label: "Site Visits", value: "—", note: "Plausible" }].map(stat => (
              <div key={stat.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0d9488", fontFamily: "'Clash Display', sans-serif" }}>{stat.value}</div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 4 }}>{stat.label}</div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 2 }}>via {stat.note}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
