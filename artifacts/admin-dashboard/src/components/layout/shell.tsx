import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

interface ShellProps {
  children: React.ReactNode;
  variant?: "default" | "fullscreen";
}

export function Shell({ children, variant = "default" }: ShellProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main
        className={cn(
          "flex-1 bg-background overflow-hidden",
          variant === "default" && "overflow-y-auto p-6",
        )}
      >
        {variant === "default" ? (
          <div className="mx-auto max-w-7xl">{children}</div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
