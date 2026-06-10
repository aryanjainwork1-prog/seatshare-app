import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Clock, Database, Server } from "lucide-react";

export default function Settings() {
  const { data, isLoading } = useGetSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [minutes, setMinutes] = useState<string>("");

  useEffect(() => {
    if (data !== undefined) {
      setMinutes(String(data.stalenessThresholdMinutes));
    }
  }, [data]);

  function handleSave() {
    const val = Number(minutes);
    if (!Number.isInteger(val) || val < 1 || val > 1440) {
      toast.error("Threshold must be a whole number between 1 and 1440 minutes.");
      return;
    }
    updateSettings(
      { data: { stalenessThresholdMinutes: val } },
      {
        onSuccess: () => toast.success("Threshold updated."),
        onError: () => toast.error("Failed to save. Please try again."),
      },
    );
  }

  const isDirty = data !== undefined && Number(minutes) !== data.stalenessThresholdMinutes;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-2">Configure runtime behaviour for the SeatShare platform.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Driver Staleness Threshold</CardTitle>
          </div>
          <CardDescription>
            How many minutes a driver can go without a location update before being automatically taken offline.
            Changes take effect on the next sweep (runs every 60 seconds).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-48" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">Current source:</span>
                {data?.source === "db" ? (
                  <Badge variant="secondary" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
                    <Database className="h-3 w-3" /> Database
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Server className="h-3 w-3" /> Environment variable
                  </Badge>
                )}
              </div>

              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="threshold">Threshold (minutes)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="threshold"
                      type="number"
                      min={1}
                      max={1440}
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isPending || !isDirty}
                  className="mb-0.5"
                >
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Valid range: 1 – 1440 minutes (1 day). Default is 15 minutes.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
