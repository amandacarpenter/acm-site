import { useOrganization, useOrganizationList, OrganizationProfile, useUser } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Users, FileText, AlertCircle, Plus, Minus, X } from "lucide-react";
import HeroWatermark from "@/components/HeroWatermark";

interface TeamMemberUsage {
  userId: string;
  name: string;
  email: string | null;
  role: string;
  monthlyUsed: number;
  monthlyLimit: number;
  purchasedCredits: number;
  creditsRemaining: number;
}

const TEAM_CREDITS_PER_SEAT = 175; // must match server/routes.ts TEAM_CREDITS_PER_SEAT

export default function TeamSetup() {
  const { user } = useUser();
  const { organization, membership } = useOrganization();
  const { userMemberships, setActive, isLoaded: orgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [, navigate] = useLocation();
  const [activating, setActivating] = useState(false);

  // Clerk does not automatically make a newly-created organization the user's
  // "active" org for an existing session (e.g. right after a team checkout, or
  // right after an admin grants team access). If the user has org membership(s)
  // but no active org is selected yet, activate the first one automatically so
  // they land straight in the team dashboard instead of a false "No team found".
  useEffect(() => {
    if (!orgListLoaded || organization || activating) return;
    const first = userMemberships?.data?.[0]?.organization;
    if (first && setActive) {
      setActivating(true);
      setActive({ organization: first.id }).finally(() => setActivating(false));
    }
  }, [orgListLoaded, organization, userMemberships, setActive, activating]);

  const meta = user?.publicMetadata as any;

  // Each teammate resets on their own signup-anniversary date (not a shared calendar-month
  // date), so this shows the CURRENT logged-in member's own reset date, fetched the same way
  // Dashboard.tsx does -- not a generically-computed "1st of next month" placeholder.
  const [resetStr, setResetStr] = useState<string | null>(null);

  const [teamUsage, setTeamUsage] = useState<{ members: TeamMemberUsage[]; totalUsed: number; totalLimit: number; purchasedSeats: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [addSeatsOpen, setAddSeatsOpen] = useState(false);
  const [seatMode, setSeatMode] = useState<"add" | "remove">("add");
  const [addSeatsQty, setAddSeatsQty] = useState(1);
  const [addSeatsLoading, setAddSeatsLoading] = useState(false);
  const [addSeatsError, setAddSeatsError] = useState<string | null>(null);
  const [addSeatsStep, setAddSeatsStep] = useState<"choose" | "confirm">("choose");
  const [addSeatsPreview, setAddSeatsPreview] = useState<{ newSeats: number; amountDueTodayCents: number; creditCents?: number; currency: string } | null>(null);

  useEffect(() => {
    if (!user?.id || !organization?.id) return;
    setUsageLoading(true);
    fetch(`/api/team/usage?clerkUserId=${user.id}&orgId=${organization.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setTeamUsage(data);
      })
      .catch((err) => console.error("Failed to load team usage:", err))
      .finally(() => setUsageLoading(false));
  }, [user?.id, organization?.id]);

  // Purchased seat count comes from the org's own metadata via the API (source of
  // truth for every member), not from this user's own publicMetadata.teamSeats --
  // that field is each member's individual per-seat credit allotment (always 1),
  // a completely different number than the team's total purchased seats.
  const seats: number = teamUsage?.purchasedSeats ?? 0;
  const occupiedSeats: number = teamUsage?.members?.length ?? 0;
  const isOrgAdmin = membership?.role === "org:admin";

  // Step 1: ask the server for the exact prorated charge, without billing
  // anything yet, so the admin can see the real dollar amount up front.
  async function handlePreviewSeats() {
    if (!user?.id || !organization?.id) return;
    setAddSeatsLoading(true);
    setAddSeatsError(null);
    try {
      const endpoint = seatMode === "add" ? "/api/team/add-seats/preview" : "/api/team/remove-seats/preview";
      const bodyKey = seatMode === "add" ? "additionalSeats" : "seatsToRemove";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId: user.id, orgId: organization.id, [bodyKey]: addSeatsQty }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAddSeatsError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setAddSeatsPreview({ newSeats: data.newSeats, amountDueTodayCents: data.amountDueTodayCents, creditCents: data.creditCents, currency: data.currency });
      setAddSeatsStep("confirm");
    } catch {
      setAddSeatsError("Something went wrong. Please try again.");
    } finally {
      setAddSeatsLoading(false);
    }
  }

  // Step 2: the admin has seen the exact charge and explicitly confirmed --
  // this is the step that actually bills the card on file.
  async function handleConfirmSeats() {
    if (!user?.id || !organization?.id) return;
    setAddSeatsLoading(true);
    setAddSeatsError(null);
    try {
      const endpoint = seatMode === "add" ? "/api/team/add-seats/confirm" : "/api/team/remove-seats/confirm";
      const bodyKey = seatMode === "add" ? "additionalSeats" : "seatsToRemove";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId: user.id, orgId: organization.id, [bodyKey]: addSeatsQty }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAddSeatsError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setAddSeatsOpen(false);
      setAddSeatsStep("choose");
      setAddSeatsQty(1);
      setAddSeatsPreview(null);
      // Refresh usage so the new seat count shows immediately.
      setUsageLoading(true);
      const usageResp = await fetch(`/api/team/usage?clerkUserId=${user.id}&orgId=${organization.id}`);
      const usageData = await usageResp.json();
      if (usageData.members) setTeamUsage(usageData);
      setUsageLoading(false);
    } catch {
      setAddSeatsError("Something went wrong. Please try again.");
    } finally {
      setAddSeatsLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/usage/status?clerkUserId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.resetDate) {
          setResetStr(new Date(data.resetDate).toLocaleDateString("en-US", { month: "long", day: "numeric" }));
        }
      })
      .catch((err) => console.error("Failed to load reset date:", err));
  }, [user?.id]);

  if (!organization) {
    // While Clerk is still loading org membership data, or while we're actively
    // switching the session to the user's org, show a neutral loading state
    // rather than immediately claiming there's no team.
    const stillResolving = !orgListLoaded || activating || (userMemberships?.data?.length ?? 0) > 0;

    if (stillResolving) {
      return (
        <div className="min-h-screen bg-white">
          <SiteHeader />
          <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
            <Loader2 className="w-8 h-8 text-[#0d9488] mb-4 animate-spin" />
            <p className="text-gray-500">Loading your team...</p>
          </div>
          <SiteFooter />
        </div>
      );
    }

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

      <section className="relative overflow-hidden bg-[#3a485b] py-16 sm:py-20" aria-labelledby="team-dash-heading">
        <HeroWatermark corner="left" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <h1 id="team-dash-heading" className="text-3xl font-bold text-white mb-1">
            {organization.name}
          </h1>
          <p className="text-white/60 text-sm">Team dashboard</p>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#3a485b] flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <p className="font-semibold text-[#3a485b] text-sm">Seats</p>
              </div>
              <p className="text-3xl font-bold text-[#3a485b]">{organization.membersCount ?? "—"} <span className="text-lg font-normal text-gray-400">of {usageLoading ? "—" : seats}</span></p>
              <p className="text-xs text-gray-400 mt-1">Annual plan · {usageLoading ? "…" : seats} seats purchased</p>
              {isOrgAdmin && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => { setSeatMode("add"); setAddSeatsQty(1); setAddSeatsOpen(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#0d9488] text-[#0d9488] hover:bg-teal-50 transition"
                  >
                    <Plus className="w-3 h-3" />
                    Add Seats
                  </button>
                  {seats > occupiedSeats && (
                    <button
                      onClick={() => { setSeatMode("remove"); setAddSeatsQty(1); setAddSeatsOpen(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                    >
                      <Minus className="w-3 h-3" />
                      Remove Seats
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#3a485b] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <p className="font-semibold text-[#3a485b] text-sm">Credits used this month</p>
              </div>
              {usageLoading ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : teamUsage ? (
                <>
                  <p className="text-3xl font-bold text-[#3a485b]">
                    {teamUsage.totalUsed} <span className="text-lg font-normal text-gray-400">of {teamUsage.totalLimit}</span>
                  </p>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0d9488] rounded-full transition-all"
                      style={{ width: `${Math.min(100, (teamUsage.totalUsed / Math.max(1, teamUsage.totalLimit)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {resetStr ? `Resets ${resetStr}` : "Resets monthly on your signup date"} · {TEAM_CREDITS_PER_SEAT} credits per seat, individually allotted (not pooled)
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">No usage data yet.</p>
              )}
            </div>
          </div>

          {/* Per-seat usage breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-bold text-[#3a485b] mb-1">Usage by teammate</h2>
              <p className="text-sm text-gray-400">Each seat gets its own {TEAM_CREDITS_PER_SEAT} credits/month — usage does not carry over between teammates.</p>
            </div>
            {usageLoading ? (
              <p className="px-6 pb-6 text-sm text-gray-400">Loading team usage...</p>
            ) : teamUsage && teamUsage.members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-gray-200 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th scope="col" className="px-6 py-3 font-semibold">Teammate</th>
                      <th scope="col" className="px-6 py-3 font-semibold">Role</th>
                      <th scope="col" className="px-6 py-3 font-semibold">Credits used</th>
                      <th scope="col" className="px-6 py-3 font-semibold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamUsage.members.map((m) => (
                      <tr key={m.userId} className="border-t border-gray-100">
                        <td className="px-6 py-3">
                          <p className="font-medium text-[#3a485b]">{m.name}</p>
                          {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                        </td>
                        <td className="px-6 py-3 text-gray-500 capitalize">{m.role.replace("org:", "")}</td>
                        <td className="px-6 py-3 text-gray-700">{m.monthlyUsed} of {m.monthlyLimit}</td>
                        <td className="px-6 py-3 text-gray-700">{m.creditsRemaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 pb-6 text-sm text-gray-400">No teammates yet — invite below to see their usage here.</p>
            )}
          </div>

          {/* Org member management */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-[#3a485b] mb-1">Team members</h2>
              <p className="text-sm text-gray-400">Invite teammates by link or email. Both options are available below.</p>
            </div>
            <div className="p-4 overflow-x-auto">
              <OrganizationProfile
                appearance={{
                  elements: {
                    card: "shadow-none border-0 p-0 min-w-[820px]",
                    rootBox: "w-full",
                    scrollBox: "min-w-0",
                  },
                }}
              />
            </div>
          </div>

        </div>
      </section>

      {addSeatsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-seats-heading"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => { setAddSeatsOpen(false); setAddSeatsError(null); setAddSeatsStep("choose"); setAddSeatsPreview(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {addSeatsStep === "choose" ? (
              <>
                <h2 id="add-seats-heading" className="text-lg font-bold text-[#3a485b] mb-1">
                  {seatMode === "add" ? "Add seats" : "Remove seats"}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {seatMode === "add" ? (
                    <>
                      You currently have {seats} seat{seats === 1 ? "" : "s"}. New seats are billed at $299/seat/yr,
                      prorated for the rest of your current billing year. You'll see the exact charge before anything
                      is billed.
                    </>
                  ) : (
                    <>
                      You currently have {seats} seat{seats === 1 ? "" : "s"}, with {occupiedSeats} in use. You can
                      remove up to {Math.max(0, seats - occupiedSeats)} unused seat{Math.max(0, seats - occupiedSeats) === 1 ? "" : "s"}.
                      Unused time on removed seats is applied as a credit toward your next renewal — you'll see the
                      exact credit before confirming.
                    </>
                  )}
                </p>
                <label htmlFor="add-seats-qty" className="block text-xs font-semibold text-gray-500 mb-1">
                  {seatMode === "add" ? "Additional seats" : "Seats to remove"}
                </label>
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setAddSeatsQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-[#3a485b] font-bold hover:bg-gray-50"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <input
                    id="add-seats-qty"
                    type="number"
                    min={1}
                    max={seatMode === "add" ? 20 : Math.max(1, seats - occupiedSeats)}
                    value={addSeatsQty}
                    onChange={(e) => {
                      const cap = seatMode === "add" ? 20 : Math.max(1, seats - occupiedSeats);
                      setAddSeatsQty(Math.max(1, Math.min(cap, parseInt(e.target.value, 10) || 1)));
                    }}
                    className="w-16 text-center border border-gray-200 rounded-lg py-2 text-[#3a485b] font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cap = seatMode === "add" ? 20 : Math.max(1, seats - occupiedSeats);
                      setAddSeatsQty((q) => Math.min(cap, q + 1));
                    }}
                    className="w-9 h-9 rounded-lg border border-gray-200 text-[#3a485b] font-bold hover:bg-gray-50"
                    aria-label="Increase"
                  >
                    +
                  </button>
                  <span className="text-sm text-gray-400 ml-1">
                    ≈ ${(addSeatsQty * 299).toLocaleString()}/yr full price
                  </span>
                </div>
                {addSeatsError && (
                  <p className="text-sm text-red-600 mb-3" role="alert">{addSeatsError}</p>
                )}
                <button
                  onClick={handlePreviewSeats}
                  disabled={addSeatsLoading}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition disabled:opacity-60"
                >
                  {addSeatsLoading ? "Calculating…" : seatMode === "add" ? "See exact charge" : "See exact credit"}
                </button>
              </>
            ) : (
              <>
                <h2 id="add-seats-heading" className="text-lg font-bold text-[#3a485b] mb-1">
                  {seatMode === "add" ? "Confirm payment" : "Confirm removal"}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {seatMode === "add" ? (
                    <>
                      Adding {addSeatsQty} seat{addSeatsQty === 1 ? "" : "s"} will bring your team to{" "}
                      <strong>{addSeatsPreview?.newSeats}</strong> seats. Your card on file will be charged now for
                      the prorated remainder of your current billing year.
                    </>
                  ) : (
                    <>
                      Removing {addSeatsQty} seat{addSeatsQty === 1 ? "" : "s"} will bring your team to{" "}
                      <strong>{addSeatsPreview?.newSeats}</strong> seats. The unused prorated value is applied as a
                      credit toward your next renewal — nothing is charged now.
                    </>
                  )}
                </p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4 flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">{seatMode === "add" ? "Charged today" : "Credit applied"}</span>
                  <span className="text-2xl font-bold text-[#3a485b]">
                    ${addSeatsPreview
                      ? seatMode === "add"
                        ? (addSeatsPreview.amountDueTodayCents / 100).toFixed(2)
                        : ((addSeatsPreview.creditCents ?? 0) / 100).toFixed(2)
                      : "—"}
                  </span>
                </div>
                {addSeatsError && (
                  <p className="text-sm text-red-600 mb-3" role="alert">{addSeatsError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAddSeatsStep("choose"); setAddSeatsError(null); }}
                    disabled={addSeatsLoading}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-[#3a485b] hover:bg-gray-50 transition disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmSeats}
                    disabled={addSeatsLoading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#0d9488] text-white hover:bg-[#0f766e] transition disabled:opacity-60"
                  >
                    {addSeatsLoading
                      ? (seatMode === "add" ? "Charging…" : "Removing…")
                      : (seatMode === "add" ? "Confirm & Pay" : "Confirm Removal")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
