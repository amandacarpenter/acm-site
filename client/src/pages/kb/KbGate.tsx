import { useAuth } from "@clerk/clerk-react";
import { Redirect, useLocation } from "wouter";

interface Props { children: React.ReactNode; }

export default function KbGate({ children }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!isSignedIn) {
    const returnTo = encodeURIComponent(location);
    return <Redirect to={`/login?redirect_url=${returnTo}`} />;
  }

  return <>{children}</>;
}
