import { SearchCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { CheckerExperience } from "@/features/document-checker/components/CheckerExperience";

export default function DocumentChecker() {
  useDocumentTitle("Remedy508 Accessibility Checker | Free Document Check");

  return (
    <>
      <a
        href="#document-checker-main"
        className="fixed left-3 top-[-80px] z-[100] rounded-lg bg-[#0f766e] px-4 py-3 font-semibold text-white focus:top-3"
      >
        Skip to document checker
      </a>
      <SiteHeader />
      <section
        className="relative overflow-hidden bg-[#3a485b] py-20 sm:py-24"
        aria-labelledby="checker-page-title"
      >
        <HeroWatermark corner="right" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <SearchCheck className="w-4 h-4" aria-hidden="true" />
            Free Document Accessibility Checker
          </div>
          <h1
            id="checker-page-title"
            className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight"
          >
            Check Accessibility
          </h1>
          <p className="text-lg text-white max-w-2xl mx-auto">
            Check documents for common accessibility barriers. Free to use, with no account required.
          </p>
        </div>
      </section>
      <CheckerExperience mainId="document-checker-main" />
      <SiteFooter />
    </>
  );
}
