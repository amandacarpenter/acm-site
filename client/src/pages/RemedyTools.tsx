import { Presentation } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HeroWatermark from "@/components/HeroWatermark";
import { useDocumentTitle } from "@/hooks/use-document-title";
import iconDocument from "@/assets/icon-document.png";
import iconVideo from "@/assets/icon-video.png";
import iconCanvas from "@/assets/icon-canvas.png";
import iconAlttext from "@/assets/icon-alttext.png";

const tools = [
  {
    name: "Remedy Docs",
    icon: iconDocument,
    id: "document",
    description: "Upload any Word doc or PDF. Remedy508 automatically detects images, tables, and multi-column layouts and remediates the whole document — no need to pick a tool.",
  },
  {
    name: "Remedy Video",
    icon: iconVideo,
    id: "video",
    description: "Upload any video or audio file. Get a timecoded, VTT-style transcript ready for captions, in seconds.",
  },
  {
    name: "Remedy HTML",
    icon: iconCanvas,
    id: "canvas",
    description: "Paste your Canvas page HTML — Remedy508 fixes heading hierarchy, color contrast, missing alt text, and table issues.",
  },
  {
    name: "Remedy Image",
    icon: iconAlttext,
    id: "alttext",
    description: "Upload or link an image. Remedy508 generates concise, WCAG-compliant alt text — with long descriptions for complex charts.",
  },
  {
    name: "Remedy Layout",
    icon: null,
    id: "layout",
    comingSoon: true,
    description: "Remediate presentations, flyers, and other visually designed documents while preserving their original layout and appearance.",
  },
];

export default function RemedyTools() {
  useDocumentTitle("Remedy Tools | Document, Video, HTML & Image Accessibility");

  return (
    <div className="min-h-screen bg-white text-[#3a485b]">
      <a href="#remedy-tools-main" className="fixed left-3 top-[-80px] z-[100] rounded-lg bg-[#0f766e] px-4 py-3 font-semibold text-white focus:top-3">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="remedy-tools-main" tabIndex={-1}>
        <section className="relative overflow-hidden bg-[#3a485b] py-20 sm:py-24" aria-labelledby="remedy-tools-heading">
          <HeroWatermark corner="right" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium text-white mb-6">Meet your accessibility toolkit</p>
            <h1 id="remedy-tools-heading" className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">Remedy Tools</h1>
            <p className="text-lg leading-relaxed text-white max-w-2xl mx-auto">
              All four available tools are included with paid Individual and Team plans and use Remedy508 Credits. Remedy Layout is coming soon.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16" aria-label="Remedy tools">
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <article key={tool.name} className="rounded-xl border border-gray-200 p-6 sm:p-8 flex flex-col" aria-labelledby={`title-${tool.id}`}>
                <div className="flex items-center gap-4 mb-5">
                  {tool.icon ? (
                    <img src={tool.icon} alt="" width={80} height={80} className="w-20 h-20 object-contain shrink-0" />
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center shrink-0" aria-hidden="true">
                      <span className="w-12 h-12 rounded-full bg-[#0f766e] text-white flex items-center justify-center">
                        <Presentation className="w-6 h-6" />
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 id={`title-${tool.id}`} className="text-2xl font-bold text-[#111827]">{tool.name}</h2>
                    {tool.comingSoon && <span className="inline-block mt-2 rounded-full bg-[#e6f4f3] px-3 py-1 text-sm font-semibold text-[#0b5c5a]">Coming soon</span>}
                  </div>
                </div>
                <p className="leading-relaxed">{tool.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
