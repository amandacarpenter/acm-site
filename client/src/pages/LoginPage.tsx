import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Link } from "wouter";
import { Shield, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-16">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {/* Logo / brand */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0d9488]/10 mb-4">
                <Shield className="w-6 h-6 text-[#0d9488]" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your Remedy508 account</p>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="Login form">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@university.edu"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/40 focus:border-[#0d9488] transition"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <a href="#" className="text-xs text-[#0d9488] hover:underline">Forgot password?</a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/40 focus:border-[#0d9488] transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition mt-2"
              >
                Sign in
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{" "}
                <Link href="/pricing">
                  <span className="text-[#0d9488] font-medium hover:underline cursor-pointer">Start free trial</span>
                </Link>
              </p>
            </div>
          </div>

          {/* Trust note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
            Secure · Files processed in memory, never stored
          </div>
        </div>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
