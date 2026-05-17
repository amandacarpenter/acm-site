import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
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
import UseCasesPage from "@/pages/UseCasesPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/tools" component={ToolsPage} />
          <Route path="/tools/:tab" component={ToolsPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/signup" component={SignupPage} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/accessibility" component={Accessibility} />
          <Route path="/contact" component={Contact} />
          <Route path="/about" component={About} />
          <Route path="/faq" component={FAQPage} />
          <Route path="/who-its-for" component={UseCasesPage} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
