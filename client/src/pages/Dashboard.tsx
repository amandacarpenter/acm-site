import { useUser, useClerk, UserButton } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import SiteFooter from "@/components/SiteFooter";
import {
  FileText,
  Video,
  Image,
  Code,
  FileSearch,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  CreditCard,
  LogOut,
} from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { Link } from "wouter";

const TOOLS = [
  { label: "Document Fixer", desc: "Word & PDF", icon: FileText, tab: "document", color: "bg-teal-50 text-[#0d9488]" },
  { label: "Complex PDF", desc: "Scanned & complex PDFs", icon: FileSearch, tab: "complexpdf", color: "bg-blue-50 text-blue-600" },
  { label: "Video Transcription", desc: "MP4, MOV, MP3", icon: Video, tab: "video", color: "bg-purple-50 text-purple-600" },
  { label: "Canvas HTML Fixer", desc: "Canvas LMS", icon: Code, tab: "canvas", color: "bg-orange-50 text-orange-600" },
  { label: "Alt Text Generator", desc: "Images & charts", icon: Image, tab: "alttext", color: "bg-pink-50 text-pink-600" },
];

const RECENT_ACTIVITY = [
  { name: "Syllabus_HIST101.docx", tool: "Document Fixer", date: "Today, 2:14 PM", status: "Done" },
  { name: "lecture_slides.pdf", tool: "Complex PDF", date: "Today, 11:30 AM", status: "Done" },
  { name: "week3_intro.mp4", tool: "Video Transcription", date: "Yesterday", status: "Done" },
  { name: "course_banner.png", tool: "Alt Text Generator", date: "Yesterday", status: "Done" },
  { name: "module2_content.html", tool: "Canvas HTML Fixer", date: "May 15", status: "Done" },
];

const PLAN = {
  name: "Pro",
  docsUsed: 12,
  docsLimit: 50,
  renewDate: "Jun 17, 2026",
  color: "bg-[#0d9488]",
};

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/#/login");
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usagePct = Math.round((PLAN.docsUsed / PLAN.docsLimit) * 100);
  const firstName = user.firstName || user.emailAddresses[0]?.emailAddress.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <img src={logoUrl} alt="Remedy508" style={{ height: 40, width: "auto" }} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools">
              <span className="text-sm font-medium text-gray-500 hover:text-gray-900 transition cursor-pointer">
                Tools
              </span>
            </Link>
            <UserButton
              afterSignOutUrl="/#/"
              appearance={{
                variables: { colorPrimary: "#0d9488" },
              }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#3a485b]">Welcome back, {firstName}</h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your account.</p>
        </div>

        {/* Top row — Usage + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          {/* Usage meter */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#0d9488]" />
                <span className="font-semibold text-[#3a485b] text-sm">Document Usage</span>
              </div>
              <span className="text-xs text-gray-400">Resets Jun 17</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold text-[#3a485b]">{PLAN.docsUsed}</span>
              <span className="text-gray-400 text-sm mb-1">/ {PLAN.docsLimit} docs this month</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div
                className="bg-[#0d9488] h-2.5 rounded-full transition-all"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{PLAN.docsLimit - PLAN.docsUsed} documents remaining — Document Fixer &amp; Complex PDF count toward this limit. Other tools are unlimited.</p>
          </div>

          {/* Plan card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-[#0d9488]" />
              <span className="font-semibold text-[#3a485b] text-sm">Your Plan</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0d9488] text-white">
                {PLAN.name}
              </span>
              <span className="text-xs text-gray-400">Monthly</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Renews {PLAN.renewDate}</p>
            <div className="mt-auto space-y-2">
              <Link href="/pricing">
                <span className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition cursor-pointer">
                  Upgrade Plan
                  <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
              <button
                onClick={() => signOut(() => navigate("/"))}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
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
          <h2 className="text-sm font-semibold text-[#3a485b] mb-3">Recent Activity</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">File</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Tool</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_ACTIVITY.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        <span className="text-gray-700 font-medium text-xs truncate max-w-[140px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">{row.tool}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {row.date}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0d9488]">
                        <CheckCircle2 className="w-3 h-3" />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400">Showing placeholder activity — live history coming soon.</p>
            </div>
          </div>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
