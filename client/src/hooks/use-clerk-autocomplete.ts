import { useEffect } from "react";

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return 1;
  const [r, g, b] = match.slice(1, 4).map(Number);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function boundaryPasses(border: string, background: string) {
  const bg = background === "rgba(0, 0, 0, 0)" || background === "transparent" ? "rgb(255, 255, 255)" : background;
  const lighter = Math.max(luminance(border), luminance(bg));
  const darker = Math.min(luminance(border), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05) >= 3;
}

const AUTOCOMPLETE: Record<string, string> = {
  identifier: "username",
  emailAddress: "email",
  email: "email",
  firstName: "given-name",
  lastName: "family-name",
  phoneNumber: "tel",
  phone: "tel",
};

/** Clerk renders its fields after mount and does not set autocomplete. */
export function useClerkAutocomplete(password: "current-password" | "new-password") {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("input").forEach((input) => {
        const key = input.getAttribute("name") || "";
        if (input.type === "password") {
          input.setAttribute("autocomplete", password);
        } else {
          const token = AUTOCOMPLETE[key];
          if (token) input.setAttribute("autocomplete", token);
        }
        if (input.style.border === "1px solid rgb(118, 118, 118)" || input.style.border === "1px solid #767676") return;
        const style = window.getComputedStyle(input);
        const width = parseFloat(style.borderTopWidth) || 0;
        if (width < 1 || !boundaryPasses(style.borderTopColor, style.backgroundColor)) {
          input.style.border = "1px solid #767676";
        }
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, [password]);
}
