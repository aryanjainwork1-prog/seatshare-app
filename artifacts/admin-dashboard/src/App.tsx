import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/shell";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Drivers from "@/pages/drivers";
import Trips from "@/pages/trips";
import Bookings from "@/pages/bookings";
import Payments from "@/pages/payments";
import Support from "@/pages/support";
import Logs from "@/pages/logs";
import LiveMap from "@/pages/live-map";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  const isMap = location === "/map";

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <RequireAuth>
          <Shell variant={isMap ? "fullscreen" : "default"}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/map" component={LiveMap} />
              <Route path="/users" component={Users} />
              <Route path="/drivers" component={Drivers} />
              <Route path="/trips" component={Trips} />
              <Route path="/bookings" component={Bookings} />
              <Route path="/payments" component={Payments} />
              <Route path="/support" component={Support} />
              <Route path="/logs" component={Logs} />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function LoginPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Login />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster theme="dark" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
