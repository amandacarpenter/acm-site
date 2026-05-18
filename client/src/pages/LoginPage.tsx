import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[#3a485b] mb-2">Log in</h1>
          <p className="text-sm text-gray-500 mb-6">Welcome back to Remedy508.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
              <input type="password" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]" placeholder="••••••••" />
            </div>
            <button className="w-full py-2.5 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition">
              Log in
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            Don't have an account?{" "}
            <Link href="/signup"><span className="text-[#0d9488] hover:underline cursor-pointer">Sign up</span></Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
