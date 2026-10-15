import { AudioLines } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { SimulationExperience } from "@/features/screen-reader-simulation/components/SimulationExperience";

export default function ScreenReaderSimulation() {
  useDocumentTitle("Free Screen Reader Simulator for PDF & Word | Remedy508");

  return (
    <>
      <a
        href="#screen-reader-simulation-main"
        className="fixed left-3 top-[-80px] z-[100] rounded-lg bg-[#0f766e] px-4 py-3 font-semibold text-white focus:top-3"
      >
        Skip to screen reader simulator
      </a>
      <SiteHeader />
      <section
        className="relative overflow-hidden bg-[#3a485b] py-20 sm:py-24"
        aria-labelledby="simulation-page-title"
      >
        <HeroWatermark corner="right" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">
            <AudioLines className="w-4 h-4" aria-hidden="true" />
            Free Screen Reader Simulator
          </div>
          <h1
            id="simulation-page-title"
            className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight"
          >
            Hear It Like a Screen Reader
          </h1>
          <p className="text-lg text-white max-w-2xl mx-auto">
            Open a PDF or Word document to hear its headings, lists, tables, links, and image descriptions in the order a screen reader reads them. Free, no account, and no Remedy508 Credits required.
          </p>
        </div>
      </section>
      <SimulationExperience mainId="screen-reader-simulation-main" />
      <SiteFooter />
    </>
  );
}
