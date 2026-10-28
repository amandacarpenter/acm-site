import { SignIn, useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useClerkAutocomplete } from "@/hooks/use-clerk-autocomplete";
import { readSignupIntent, intentQuery, intentDestination } from "@/lib/signupIntent";

export default function LoginPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const intent = readSignupIntent(window.location.search);
  // If they came from a plan or the trial, keep them on that path after signing in.
  const planDestination = intentDestination(intent);
  const destination = planDestination ?? "/";
  // Creating an account always starts from a plan or the trial, so the
  // "Sign up" link goes to pricing unless a plan was already chosen.
  const signUpUrl = planDestination ? `/signup${intentQuery(intent)}` : "/pricing";
  useDocumentTitle("Log in | Remedy508");
  useClerkAutocomplete("current-password");

  useEffect(() => {
    if (isSignedIn) navigate(destination);
  }, [isSignedIn, destination, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <h1 className="sr-only">Log in to Remedy508</h1>
        <SignIn
          routing="virtual"
          signUpUrl={signUpUrl}
          afterSignInUrl={destination}
          forceRedirectUrl={planDestination ?? undefined}
          appearance={{
            variables: {
              colorPrimary: "#0f766e",
              colorText: "#3a485b",
              colorTextSecondary: "#566373",
              borderRadius: "0.75rem",
            }
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
