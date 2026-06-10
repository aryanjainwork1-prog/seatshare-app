import {
  Switch,
  Route,
  Router as WouterRouter,
  Redirect,
  useLocation,
} from "wouter";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/shell";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { triggerUnauthorized } from "@/lib/authUtils";
import { ApiError } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Drivers from "@/pages/drivers";
import Trips from "@/pages/trips";
import Bookings from "@/pages/bookings";
import Payments from "@/pages/payments";
import Support from "@/pages/support";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import LiveMap from "@/pages/live-map";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

// Global 401/403 handler: any query or mutation that returns Unauthorized/Forbidden
// mid-session will trigger logout and redirect to the login page.
function isAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
  );
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthError(error)) triggerUnauthorized();
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) triggerUnauthorized();
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAuthError(error)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// ── Route guard ───────────────────────────────────────────────────────────────

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated OR not an admin
  if (!user || user.role !== "admin") {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}

// ── Router ────────────────────────────────────────────────────────────────────

function Router() {
  const [location] = useLocation();
  const isMap = location === "/map";

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <RequireAdmin>
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
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </RequireAdmin>
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

  if (user && user.role === "admin") {
    return <Redirect to="/" />;
  }

  return <Login />;
}

// ── App root ──────────────────────────────────────────────────────────────────

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
