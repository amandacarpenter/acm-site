/**
 * KbApp — mounts the Remedy508 Knowledge Base as a sub-app inside acm-site.
 * Uses react-router-dom HashRouter internally so it works at /kb without
 * conflicting with the outer wouter router.
 *
 * Clerk is already provided by the parent ClerkProvider in main.tsx.
 */
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./components";
import { HomePage, SectionPage, ArticlePage, LoginPage, NotFoundPage } from "./pages";
import "./kb.css";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function KbApp() {
  return (
    <HashRouter>
      <AuthProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:rounded-lg focus:bg-teal focus:px-4 focus:py-2 focus:text-white focus:font-semibold"
        >
          Skip to content
        </a>
        <ScrollToTop />
        <div id="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/section/:id" element={<SectionPage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </AuthProvider>
    </HashRouter>
  );
}
