import { useState, useEffect } from "react";

export interface KbArticle {
  id: string;
  section: number;
  section_name: string;
  order_num: number;
  title: string;
  summary: string;
  video_url: string | null;
  video_status: "published" | "coming_soon";
  transcript: string | null;
  captions_url: string | null;
  duration: string | null;
  related_ids: string[];
  updated_at: string;
}

export interface KbSection {
  section: number;
  section_name: string;
  articles: KbArticle[];
}

export function useKbSections() {
  const [sections, setSections] = useState<KbSection[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/kb/sections").then(r => r.json()).then(setSections).finally(() => setLoading(false));
  }, []);
  return { sections, loading };
}

export function useKbArticle(id: string) {
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/kb/articles/${id}`).then(r => r.json()).then(setArticle).finally(() => setLoading(false));
  }, [id]);
  return { article, loading };
}

export function useKbSearch(q: string) {
  const [results, setResults] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/kb/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json()).then(setResults).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  return { results, loading };
}
