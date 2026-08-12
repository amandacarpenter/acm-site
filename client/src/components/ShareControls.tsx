import { useEffect, useRef, useState } from "react";
import { Link2, Linkedin, Mail, Share2, Facebook } from "lucide-react";

interface ShareControlsProps {
  /** Absolute or root-relative URL of the page being shared. */
  url: string;
  title: string;
  /** Short summary used by the native share sheet and the email body. */
  summary: string;
}

/**
 * Accessible sharing for Remedy508 Insights articles.
 *
 * - Native Web Share is offered only when the browser actually supports it,
 *   so we never render a control that silently does nothing.
 * - Copy link degrades from the async Clipboard API to a hidden textarea and,
 *   if both fail, to a visible message with the URL so the reader can copy it
 *   manually.
 * - Every control is a real button or link with a descriptive accessible name,
 *   a 44px minimum target, and a visible focus ring.
 * - Copy feedback is announced through a polite live region rather than only
 *   changing the button colour.
 */
export default function ShareControls({ url, title, summary }: ShareControlsProps) {
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [status, setStatus] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const absoluteUrl =
    url.startsWith("http") || typeof window === "undefined"
      ? url
      : `${window.location.origin}${url}`;

  function announce(message: string) {
    setStatus(message);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus(""), 6000);
  }

  function legacyCopy(value: string): boolean {
    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "-1000px";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(field);
      return copied;
    } catch {
      return false;
    }
  }

  async function handleCopy() {
    setManualUrl("");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(absoluteUrl);
        announce("Link copied to your clipboard.");
        return;
      }
    } catch {
      // fall through to the legacy path below
    }
    if (legacyCopy(absoluteUrl)) {
      announce("Link copied to your clipboard.");
      return;
    }
    setManualUrl(absoluteUrl);
    announce("Copying was blocked by your browser. The full link is shown below so you can copy it.");
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: summary, url: absoluteUrl });
      announce("Share sheet opened.");
    } catch (error) {
      // A cancelled share sheet is a normal outcome, not an error worth announcing.
      if (error instanceof DOMException && error.name === "AbortError") return;
      announce("Sharing was not completed. You can copy the link instead.");
    }
  }

  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const mailHref = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(
    `${summary}\n\n${absoluteUrl}`,
  )}`;

  const controlClass =
    "inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-[#0f766e] no-underline transition-colors motion-reduce:transition-none hover:bg-[#0f766e]/10 hover:border-[#0f766e]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]";

  return (
    <section aria-labelledby="share-heading" className="border-y border-gray-200 py-6">
      <h2 id="share-heading" className="text-base font-bold text-[#111827] mb-3">
        Share this article
      </h2>
      <ul className="flex flex-wrap items-center gap-2 list-none p-0 m-0">
        {canNativeShare && (
          <li>
            <button
              type="button"
              onClick={handleNativeShare}
              className={controlClass}
              data-testid="share-native"
            >
              <Share2 className="w-4 h-4" aria-hidden="true" />
              Share
            </button>
          </li>
        )}
        <li>
          <button
            type="button"
            onClick={handleCopy}
            className={controlClass}
            aria-label="Copy link to this article"
            data-testid="share-copy-link"
          >
            <Link2 className="w-4 h-4" aria-hidden="true" />
            Copy link
          </button>
        </li>
        <li>
          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer"
            className={controlClass}
            aria-label="Share this article on LinkedIn (opens in a new tab)"
            data-testid="share-linkedin"
          >
            <Linkedin className="w-4 h-4" aria-hidden="true" />
            LinkedIn
          </a>
        </li>
        <li>
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            className={controlClass}
            aria-label="Share this article on Facebook (opens in a new tab)"
            data-testid="share-facebook"
          >
            <Facebook className="w-4 h-4" aria-hidden="true" />
            Facebook
          </a>
        </li>
        <li>
          <a
            href={mailHref}
            className={controlClass}
            aria-label="Share this article by email"
            data-testid="share-email"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Email
          </a>
        </li>
      </ul>

      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-sm font-medium text-[#0f766e] min-h-[1.25rem]"
        data-testid="share-status"
      >
        {status}
      </p>
      {manualUrl && (
        <p className="text-sm text-gray-700 break-all" data-testid="share-manual-url">
          {manualUrl}
        </p>
      )}
    </section>
  );
}
