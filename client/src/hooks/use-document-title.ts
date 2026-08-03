import { useEffect } from "react";

/**
 * Syncs document.title on client-side (SPA) navigation. Server-side
 * injection (server/seo-html.ts) already sets the correct title/meta on
 * the initial HTML response for crawlers and hard loads -- this hook keeps
 * the browser tab title correct when navigating between routes without a
 * full page reload, since wouter doesn't trigger a new server request.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
