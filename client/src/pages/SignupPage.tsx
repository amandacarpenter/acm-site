import { SignUp, useAuth } from "@clerk/clerk-react";
import { useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useClerkAutocomplete } from "@/hooks/use-clerk-autocomplete";
import { readSignupIntent, intentQuery, intentDestination } from "@/lib/signupIntent";

export default function SignupPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const intent = readSignupIntent(window.location.search);
  // Paid plans continue straight to payment; the trial continues to the trial card.
  const planDestination = intentDestination(intent);
  const destination = planDestination ?? "/pricing";
  useDocumentTitle("Create an account | Remedy508");
  useClerkAutocomplete("new-password");

  useEffect(() => {
    if (isSignedIn) navigate(destination);
  }, [isSignedIn, destination, navigate]);

  // No plan, no trial, no team invitation: pick a plan first.
  if (intent.kind === "none" && !isSignedIn) return <Redirect to="/pricing" />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <h1 className="sr-only">Create a Remedy508 account</h1>
        <div className="flex flex-col items-center">
          <SignUp
            routing="virtual"
            signInUrl={`/login${intentQuery(intent)}`}
            afterSignUpUrl={destination}
            // Recorded on the new account so the owner's sign-up alert email shows what they chose.
            unsafeMetadata={{ signupIntent: intent.kind === "individual" ? intent.billing : intent.kind }}
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
          <div className="mt-3 text-center text-xs text-gray-600" style={{width: "inherit"}}>
            <p>A verification code will be sent to your email.</p>
            <p>If you don't see it, check your spam or junk folder.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
