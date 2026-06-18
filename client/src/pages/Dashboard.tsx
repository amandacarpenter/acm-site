import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { FileText, Video, Image, Code, FileSearch, CheckCircle2, Zap, CreditCard, Clock, ArrowRight } from "lucide-react";
import logoUrl from "@/assets/logo.png";

const TOOLS = [
  { label: "Document Fixer", desc: "Word & PDF", icon: FileText, tab: "document", color: "bg-teal-50 text-[#0d9488]" },
  { label: "Complex PDF", desc: "Scanned & complex PDFs", icon: FileSearch, tab: "complexpdf", color: "bg-blue-50 text-blue-600" },
  { label: "Video Transcription", desc: "MP4, MOV, MP3", icon: Video, tab: "video", color: "bg-purple-50 text-purple-600" },
  { label: "Canvas HTML Fixer", desc: "Canvas LMS", icon: Code, tab: "canvas", color: "bg-orange-50 text-orange-600" },
  { label: "Alt Text Generator", desc: "Images & charts", icon: Image, tab: "alttext", color: "bg-pink-50 text-pink-600" },
];

export default function Dashboard() {
  const docsUsed = 0;
  const docsLimit = 50;
  const usagePct = Math.round((docsUsed / docsLimit) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src={logoUrl} alt="Remedy508" style={{ height: 40, width: "auto" }} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer">Tools</span>
            </Link>
            <Link href="/pricing">
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer">Plans</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#3a485b]">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your account.</p>
        </div>

        {/* Top row — Usage + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-[#3a485b] text-sm">Document Usage</span>
              </div>
              <span className="text-xs text-gray-400">Resets Jun 17</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#3a485b]">{docsUsed}</span>
              <span className="text-gray-400 text-sm mb-1">/ {docsLimit} docs this month</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div className="bg-[#0d9488] h-2.5 rounded-full transition-all" style={{ width: `${usagePct}%` }} />
            </div>
            <p className="text-xs text-gray-400">{docsLimit - docsUsed} documents remaining — Document Fixer &amp; Complex PDF count toward this limit.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-[#0d9488]" />
              <span className="font-semibold text-[#3a485b] text-sm">Your Plan</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0d9488] text-white">Pro</span>
              <span className="text-xs text-gray-400">Monthly</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Renews Jun 17, 2026</p>
            <div className="mt-auto">
              <Link href="/pricing">
                <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
                  Upgrade Plan <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick access tools */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#3a485b] mb-3">Quick Access</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TOOLS.map((tool) => (
              <Link key={tool.tab} href={`/tools/${tool.tab}`}>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-[#0d9488]/30 transition cursor-pointer group">
                  <div className={`w-8 h-8 rounded-lg ${tool.color} flex items-center justify-center mb-3`}>
                    <tool.icon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-[#3a485b] leading-tight group-hover:text-[#0d9488] transition">{tool.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#3a485b]">Recent Activity</h2>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Files are not saved — download your results immediately after processing
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <FileText className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300 mt-1">Your processed files will appear here</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
