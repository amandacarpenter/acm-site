import { SignUp, useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function SignupPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isSignedIn) navigate("/pricing");
  }, [isSignedIn]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="flex flex-col items-center">
          <SignUp
            routing="hash"
            signInUrl="/login"
            afterSignUpUrl="/pricing"
            appearance={{
              variables: {
                colorPrimary: "#0d9488",
                colorText: "#3a485b",
                borderRadius: "0.75rem",
              }
            }}
          />
          <div className="mt-3 text-center text-xs text-gray-400" style={{width: "inherit"}}>
            <p>A verification code will be sent to your email.</p>
            <p>If you don't see it, check your spam or junk folder.</p>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
