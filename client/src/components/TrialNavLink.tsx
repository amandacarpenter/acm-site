import { Link } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { ArrowRight } from "lucide-react";
import { useFreeTrial } from "@/hooks/use-free-trial";

export default function TrialNavLink({ className, onClick }: { className: string; onClick?: () => void }) {
  const { user } = useUser();
  const { data } = useFreeTrial();
  const meta = user?.publicMetadata as Record<string, unknown> | undefined;
  if (meta?.subscribed === true || meta?.plan || data?.state === "ineligible") return null;
  const started = data?.expiresAt != null;
  return <Link href="/pricing?trial=1" className={className} onClick={onClick}>
    {started ? "Your Trial" : "Free Trial"} <ArrowRight size={16} aria-hidden="true" />
  </Link>;
}
