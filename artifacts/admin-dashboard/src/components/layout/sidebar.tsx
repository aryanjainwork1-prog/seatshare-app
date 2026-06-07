import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Car,
  Map,
  Ticket,
  CreditCard,
  LifeBuoy,
  ScrollText,
  Menu,
  X,
  MapPin,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Live Map", icon: MapPin },
  { href: "/users", label: "Users", icon: Users },
  { href: "/drivers", label: "Drivers", icon: Car },
  { href: "/trips", label: "Trips", icon: Map },
  { href: "/bookings", label: "Bookings", icon: Ticket },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/logs", label: "Activity Logs", icon: ScrollText },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AD";

  return (
    <>
      <div className="md:hidden p-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-2 font-bold text-lg text-primary">
          <Car className="h-6 w-6" />
          SeatShare
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-16 items-center gap-2 px-6 font-bold text-xl text-primary border-b border-border hidden md:flex">
          <Car className="h-6 w-6" />
          SeatShare
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                  {item.href === "/map" && (
                    <span className="ml-auto text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                      LIVE
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
              {initials}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">
                {user?.name ?? "Admin"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {user?.email ?? ""}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
