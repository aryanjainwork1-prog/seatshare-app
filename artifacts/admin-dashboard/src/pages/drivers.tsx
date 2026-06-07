import { useState } from "react";
import { useListDriverProfiles, getListDriverProfilesQueryKey, useVerifyDriverProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ShieldCheck, ShieldAlert, Star, Navigation } from "lucide-react";
import { toast } from "sonner";

export default function Drivers() {
  const [page, setPage] = useState(1);
  const [isOnline, setIsOnline] = useState<string>("all");
  const [isVerified, setIsVerified] = useState<string>("all");
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useListDriverProfiles({
    page,
    limit: 10,
    ...(isOnline !== "all" && { isOnline: isOnline === "true" }),
    ...(isVerified !== "all" && { isVerified: isVerified === "true" }),
  }, { query: { queryKey: getListDriverProfilesQueryKey({ page, limit: 10, isOnline: isOnline === "all" ? undefined : isOnline === "true", isVerified: isVerified === "all" ? undefined : isVerified === "true" }) } });

  const verifyDriver = useVerifyDriverProfile();

  const handleVerifyToggle = (id: number, currentStatus: boolean) => {
    verifyDriver.mutate({
      id,
      data: { verified: !currentStatus }
    }, {
      onSuccess: () => {
        toast.success(`Driver successfully ${!currentStatus ? "verified" : "unverified"}`);
        queryClient.invalidateQueries({ queryKey: getListDriverProfilesQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update verification status");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
        <p className="text-muted-foreground mt-2">Manage driver verification, ratings, and vehicles.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <Select value={isOnline} onValueChange={(val) => { setIsOnline(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Online Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Online</SelectItem>
            <SelectItem value="false">Offline</SelectItem>
          </SelectContent>
        </Select>

        <Select value={isVerified} onValueChange={(val) => { setIsVerified(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Verification</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Driver</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No drivers found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((profile) => (
                <TableRow key={profile.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {profile.user?.name || "Unknown"}
                      {profile.isVerified && <ShieldCheck className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{profile.user?.phone}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {profile.licenseNumber || "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <span className="font-medium">{profile.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground ml-1">({profile.totalTrips} trips)</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={profile.isOnline ? "border-emerald-500 text-emerald-500" : "border-muted-foreground text-muted-foreground"}>
                      <Navigation className="h-3 w-3 mr-1" />
                      {profile.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {profile.vehicle ? (
                      <div className="text-sm">
                        <div>{profile.vehicle.make} {profile.vehicle.model}</div>
                        <Badge variant="secondary" className="text-[10px] mt-1 font-mono uppercase bg-accent">{profile.vehicle.licensePlate}</Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No vehicle</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant={profile.isVerified ? "outline" : "default"} 
                      size="sm"
                      className="h-8"
                      disabled={verifyDriver.isPending}
                      onClick={() => handleVerifyToggle(profile.id, profile.isVerified)}
                    >
                      {profile.isVerified ? (
                        <><ShieldAlert className="mr-2 h-3 w-3" /> Unverify</>
                      ) : (
                        <><ShieldCheck className="mr-2 h-3 w-3" /> Verify</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} drivers
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
