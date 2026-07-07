import { useOrganization, useOrganizationList, OrganizationProfile, useUser } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Users, FileText, AlertCircle } from "lucide-react";

export default function TeamSetup() {
  const { user } = useUser();
  const { organization, membership } = useOrganization();
  const [, navigate] = useLocation();

  const meta = user?.publicMetadata as any;
  const seats: number = meta?.teamSeats || 0;
  const orgUsage: number = meta?.orgDocUsage || 0;
  const docCap = seats * 75;
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1, 1);
  const resetStr = resetDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  if (!organization) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <AlertCircle className="w-10 h-10 text-[#0d9488] mb-4" />
          <h1 className="text-2xl font-bold text-[#3a485b] mb-3">No team found</h1>
          <p className="text-gray-500 mb-6 max-w-sm">
            If you just completed checkout, your team dashboard may take a moment to appear. Try refreshing.
          </p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-[#0d9488] text-white font-semibold text-sm hover:bg-[#0f766e] transition">
            Refresh
          </button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="bg-[#3a485b] py-16 sm:py-20" aria-labelledby="team-dash-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h1 id="team-dash-heading" className="text-3xl font-bold text-white mb-1">
            {organization.name}
          </h1>
          <p className="text-white/60 text-sm">Team dashboard</p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#3a485b] flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <p className="font-semibold text-[#3a485b] text-sm">Seats</p>
              </div>
              <p className="text-3xl font-bold text-[#3a485b]">{organization.membersCount ?? "—"} <span className="text-lg font-normal text-gray-400">of {seats}</span></p>
              <p className="text-xs text-gray-400 mt-1">Annual plan · {seats} seats purchased</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#3a485b] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <p className="font-semibold text-[#3a485b] text-sm">Documents this month</p>
              </div>
              <p className="text-3xl font-bold text-[#3a485b]">{orgUsage} <span className="text-lg font-normal text-gray-400">of {docCap}</span></p>
              {/* Usage bar */}
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0d9488] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (orgUsage / Math.max(1, docCap)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Resets {resetStr} · Pooled across team</p>
              {orgUsage >= docCap && docCap > 0 && (
                <p className="text-xs text-red-500 mt-1 font-semibold">
                  Your team has used all {docCap} documents this month. Documents reset on {resetStr}. Need more? <button onClick={() => navigate("/team/seats")} className="underline">Add seats</button>
                </p>
              )}
            </div>
          </div>

          {/* Org member management */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-[#3a485b] mb-1">Team members</h2>
              <p className="text-sm text-gray-400">Invite teammates by link or email. Both options are available below.</p>
            </div>
            <div className="p-4">
              <OrganizationProfile
                appearance={{
                  elements: {
                    card: "shadow-none border-0 p-0",
                    rootBox: "w-full",
                  },
                }}
              />
            </div>
          </div>

        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
