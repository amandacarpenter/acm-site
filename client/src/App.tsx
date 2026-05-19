import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import Home from "@/pages/Home";
import ToolsPage from "@/pages/ToolsPage";
import PricingPage from "@/pages/PricingPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Accessibility from "@/pages/Accessibility";
import Contact from "@/pages/Contact";
import About from "@/pages/About";
import FAQPage from "@/pages/FAQPage";
import Dashboard from "@/pages/Dashboard";
import ComingSoon from "@/pages/ComingSoon";
import ScrollToTop from "@/components/ScrollToTop";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <SignedIn><Component /></SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <ScrollToTop />
          <Switch>
            <Route path="/" component={ComingSoon} />
            <Route path="/home" component={Home} />
            <Route path="/tools" component={ToolsPage} />
            <Route path="/tools/:tab" component={ToolsPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/login" component={LoginPage} />
            <Route path="/signup" component={SignupPage} />
            <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/accessibility" component={Accessibility} />
            <Route path="/contact" component={Contact} />
            <Route path="/about" component={About} />
            <Route path="/faq" component={FAQPage} />
            <Route path="/coming-soon" component={ComingSoon} />
          </Switch>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
