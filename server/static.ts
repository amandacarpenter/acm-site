import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Custom domains that should show the coming-soon page
const COMING_SOON_HOSTS = ["remedy508.com", "www.remedy508.com", "remedy508.ai", "www.remedy508.ai"];

function isComingSoonHost(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  return COMING_SOON_HOSTS.includes(hostname);
}

const LOGO_B64 = "";

function comingSoonHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Remedy508 — Coming Soon</title>
  <meta name="description" content="Remedy508 automatically remediates inaccessible course materials to meet WCAG 2.1 Level AA — built for higher education." />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --teal: #0d9488; --navy: #3a485b; }
    body {
      min-height: 100svh;
      background: var(--navy);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 2rem 1rem;
      color: white;
      overflow: hidden;
      position: relative;
    }
    .blob {
      position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
      animation: pulse 4s ease-in-out infinite alternate;
    }
    .blob-1 { width: 40vw; height: 40vw; top: -10%; left: -5%; background: rgba(13,148,136,.12); }
    .blob-2 { width: 35vw; height: 35vw; bottom: -10%; right: -5%; background: rgba(13,148,136,.09); animation-delay: 1.5s; }
    .blob-3 { width: 20vw; height: 20vw; top: 40%; left: 60%; background: rgba(255,255,255,.04); animation-delay: 3s; }
    @keyframes pulse { from { opacity: .6; transform: scale(1); } to { opacity: 1; transform: scale(1.08); } }
    .card {
      position: relative; z-index: 1; width: 100%; max-width: 480px;
      display: flex; flex-direction: column; align-items: center; gap: 1.75rem;
      text-align: center;
    }
    .logo { height: 56px; width: auto; }
    .badge {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .25rem .875rem; border-radius: 999px;
      background: rgba(13,148,136,.2); border: 1px solid rgba(13,148,136,.3);
      color: var(--teal); font-size: .75rem; font-weight: 600;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); animation: pulse 1.5s ease-in-out infinite alternate; }
    h1 { font-size: clamp(2rem, 5vw, 2.75rem); font-weight: 700; line-height: 1.2; }
    h1 span { color: var(--teal); }
    .sub { color: rgba(255,255,255,.6); font-size: 1.0625rem; line-height: 1.6; }
    .pills { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; }
    .pill {
      padding: .25rem .75rem; border-radius: 999px;
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.65); font-size: .75rem; font-weight: 500;
    }
    .form-wrap {
      width: 100%; background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1); border-radius: 1.25rem;
      padding: 1.5rem; backdrop-filter: blur(8px);
    }
    .form-label { display: block; text-align: left; font-size: .875rem; font-weight: 500; color: rgba(255,255,255,.8); margin-bottom: .75rem; }
    .form-row { display: flex; gap: .5rem; }
    .form-input {
      flex: 1; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18);
      border-radius: .75rem; padding: .75rem 1rem; color: white;
      font-size: .875rem; outline: none; transition: border-color .2s, box-shadow .2s;
    }
    .form-input::placeholder { color: rgba(255,255,255,.3); }
    .form-input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,148,136,.25); }
    .form-btn {
      padding: .75rem 1.25rem; background: var(--teal); border: none;
      border-radius: .75rem; color: white; font-size: .875rem; font-weight: 600;
      cursor: pointer; transition: background .2s; white-space: nowrap;
    }
    .form-btn:hover { background: #0f766e; }
    .form-btn:disabled { opacity: .6; cursor: default; }
    .form-note { margin-top: .75rem; text-align: left; font-size: .75rem; color: rgba(255,255,255,.3); }
    .form-error { margin-top: .5rem; text-align: left; font-size: .75rem; color: #f87171; }
    .success-box { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: .5rem 0; }
    .success-icon {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(13,148,136,.2); display: flex; align-items: center; justify-content: center;
    }
    .success-icon svg { width: 24px; height: 24px; stroke: var(--teal); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tagline { font-size: .75rem; color: rgba(255,255,255,.2); }
    @media (max-width: 400px) { .form-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div aria-hidden="true"><div class="blob blob-1"></div><div class="blob blob-2"></div><div class="blob blob-3"></div></div>
  <main class="card">
    <img src="/logo.png" alt="Remedy508" class="logo" />
    <span class="badge"><span class="dot"></span>Coming Soon</span>
    <div>
      <h1>Accessible content,<br><span>at scale.</span></h1>
    </div>
    <p class="sub">Remedy508 automatically remediates inaccessible course materials to meet WCAG&nbsp;2.1&nbsp;Level&nbsp;AA&nbsp;&mdash; built for higher education.</p>
    <div class="pills" role="list" aria-label="Features">
      <span class="pill" role="listitem">PDF Remediation</span>
      <span class="pill" role="listitem">Alt Text Generation</span>
      <span class="pill" role="listitem">Video Captions</span>
      <span class="pill" role="listitem">Canvas Integration</span>
      <span class="pill" role="listitem">WCAG 2.1 AA</span>
    </div>
    <div class="form-wrap">
      <div id="form-area">
        <label class="form-label" for="cs-email">Get notified at launch</label>
        <div class="form-row">
          <input class="form-input" id="cs-email" type="email" placeholder="your@email.edu" autocomplete="email" required aria-required="true" />
          <button class="form-btn" id="cs-btn" type="button" onclick="submitWaitlist()">Notify Me</button>
        </div>
        <p class="form-note">No spam. Unsubscribe anytime.</p>
        <p class="form-error" id="cs-error" role="alert" hidden></p>
      </div>
      <div class="success-box" id="success-area" hidden aria-live="polite">
        <div class="success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <p style="font-weight:600">You&rsquo;re on the list!</p>
        <p style="font-size:.875rem;color:rgba(255,255,255,.5)">We&rsquo;ll let you know the moment we launch.</p>
      </div>
    </div>
    <p class="tagline">Not Accessible, Not Acceptable&trade;&nbsp;&nbsp;&middot;&nbsp;&nbsp;Left Coast Learning LLC</p>
  </main>
  <script>
    async function submitWaitlist() {
      const input = document.getElementById('cs-email');
      const btn = document.getElementById('cs-btn');
      const errEl = document.getElementById('cs-error');
      const email = input.value.trim();
      if (!email) { showError('Please enter your email address.'); return; }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { showError('Please enter a valid email address.'); return; }
      btn.disabled = true; btn.textContent = 'Sending...';
      errEl.hidden = true;
      try {
        const res = await fetch('/api/waitlist', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        if (res.ok) {
          document.getElementById('form-area').hidden = true;
          document.getElementById('success-area').hidden = false;
        } else {
          const d = await res.json().catch(() => ({}));
          showError(d.message || 'Something went wrong. Please try again.');
          btn.disabled = false; btn.textContent = 'Notify Me';
        }
      } catch { showError('Network error. Please try again.'); btn.disabled = false; btn.textContent = 'Notify Me'; }
    }
    function showError(msg) {
      const el = document.getElementById('cs-error');
      el.textContent = msg; el.hidden = false;
    }
    document.getElementById('cs-email').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitWaitlist();
    });
  </script>
</body>
</html>`;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // If request comes from a custom domain, serve the coming-soon page instead
  app.use("/{*path}", (req, res) => {
    const host = req.headers.host || "";
    if (isComingSoonHost(host)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(comingSoonHtml());
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
