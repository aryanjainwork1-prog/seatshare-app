import { useState } from "react";
import {
  useListRideRequests,
  getListRideRequestsQueryKey,
  useUpdateRideRequest,
  useListDriverProfiles,
} from "@workspace/api-client-react";
import type { RideRequest } from "@workspace/api-client-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ArrowRight, CheckCircle, XCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["pending", "approved", "rejected", "assigned", "completed", "cancelled"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="border-amber-500/50 text-amber-500">Pending</Badge>;
    case "approved":
      return <Badge variant="default" className="bg-blue-500/20 text-blue-500 border border-blue-500/30 hover:bg-blue-500/30">Approved</Badge>;
    case "assigned":
      return <Badge variant="default" className="bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30">Assigned</Badge>;
    case "completed":
      return <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">Completed</Badge>;
    case "rejected":
    case "cancelled":
      return <Badge variant="destructive" className="bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 capitalize">{status}</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

export default function RideRequests() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<RideRequest | null>(null);

  // Detail dialog form state
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editPickup, setEditPickup] = useState("");
  const [editDropoff, setEditDropoff] = useState("");
  const [editDriverId, setEditDriverId] = useState<string>("none");
  const [editNotes, setEditNotes] = useState("");

  const queryClient = useQueryClient();

  const params = {
    page,
    limit: 10,
    ...(statusFilter !== "all" && { status: statusFilter }),
  };
  const { data, isLoading } = useListRideRequests(params, {
    query: {
      queryKey: getListRideRequestsQueryKey(params),
      // Near real-time: dispatch center polls for new passenger requests
      refetchInterval: 5000,
    },
  });

  const { data: driversData } = useListDriverProfiles(
    { page: 1, limit: 100 },
    { query: { queryKey: ["driver-profiles-for-assignment"] } },
  );

  const updateRequest = useUpdateRideRequest();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListRideRequestsQueryKey() });

  const quickUpdate = (id: number, updates: { status: string }) => {
    updateRequest.mutate(
      { id, data: updates as never },
      {
        onSuccess: () => {
          toast.success(`Request #${id} ${updates.status}`);
          invalidate();
        },
        onError: () => toast.error("Failed to update ride request"),
      },
    );
  };

  const openDetail = (request: RideRequest) => {
    setSelected(request);
    setEditStatus(request.status);
    setEditPickup(request.pickupAddress);
    setEditDropoff(request.dropoffAddress);
    setEditDriverId(
      request.assignedDriverProfileId != null ? String(request.assignedDriverProfileId) : "none",
    );
    setEditNotes(request.adminNotes ?? "");
  };

  const handleSave = () => {
    if (!selected) return;
    updateRequest.mutate(
      {
        id: selected.id,
        data: {
          status: editStatus as (typeof STATUS_OPTIONS)[number],
          pickupAddress: editPickup,
          dropoffAddress: editDropoff,
          assignedDriverProfileId: editDriverId === "none" ? null : Number(editDriverId),
          adminNotes: editNotes,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Ride request #${selected.id} updated`);
          invalidate();
          setSelected(null);
        },
        onError: () => toast.error("Failed to update ride request"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ride Requests</h1>
        <p className="text-muted-foreground mt-2">
          Concierge dispatch — review incoming passenger requests, approve, and assign drivers manually.
        </p>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border border-border">
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Request Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Route</TableHead>
              <TableHead>Passenger</TableHead>
              <TableHead>Times</TableHead>
              <TableHead>Preferences</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No ride requests found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((request) => (
                <TableRow
                  key={request.id}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => openDetail(request)}
                >
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[260px]">
                      <div className="text-sm truncate" title={request.pickupAddress}>{request.pickupAddress.split(",")[0]}</div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <div className="text-sm font-medium truncate text-primary" title={request.dropoffAddress}>{request.dropoffAddress.split(",")[0]}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{request.passenger?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{request.passenger?.phone ?? `ID: ${request.passengerId}`}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {request.preferredDepartureTime ? (
                      <div>Dep: {request.preferredDepartureTime}</div>
                    ) : null}
                    {request.preferredArrivalTime ? (
                      <div>Arr: {request.preferredArrivalTime}</div>
                    ) : null}
                    {!request.preferredDepartureTime && !request.preferredArrivalTime && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    <div className="text-sm truncate" title={request.preferences ?? undefined}>
                      {request.preferences || <span className="text-muted-foreground">—</span>}
                    </div>
                    {request.walkingDistanceKm != null && (
                      <div className="text-xs text-muted-foreground">Walk up to {request.walkingDistanceKm} km</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(request.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>{statusBadge(request.status)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {request.status === "pending" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            disabled={updateRequest.isPending}
                            onClick={() => quickUpdate(request.id, { status: "approved" })}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8"
                            disabled={updateRequest.isPending}
                            onClick={() => quickUpdate(request.id, { status: "rejected" })}
                          >
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {(request.status === "pending" || request.status === "approved") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => openDetail(request)}
                        >
                          <UserPlus className="mr-1 h-3 w-3" /> Assign
                        </Button>
                      )}
                    </div>
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} requests
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ride Request #{selected?.id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                {selected.passenger?.name ?? "Unknown passenger"}
                {selected.passenger?.phone ? ` · ${selected.passenger.phone}` : ""} · submitted{" "}
                {format(new Date(selected.createdAt), "MMM d, h:mm a")}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rr-pickup">Pickup</Label>
                  <Input id="rr-pickup" value={editPickup} onChange={(e) => setEditPickup(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rr-dropoff">Drop</Label>
                  <Input id="rr-dropoff" value={editDropoff} onChange={(e) => setEditDropoff(e.target.value)} />
                </div>
              </div>

              {(selected.preferredDepartureTime || selected.preferredArrivalTime || selected.preferences || selected.walkingDistanceKm != null) && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                  {selected.preferredDepartureTime && <div>Preferred departure: {selected.preferredDepartureTime}</div>}
                  {selected.preferredArrivalTime && <div>Preferred arrival: {selected.preferredArrivalTime}</div>}
                  {selected.preferences && <div>Preferences: {selected.preferences}</div>}
                  {selected.walkingDistanceKm != null && <div>Willing to walk: {selected.walkingDistanceKm} km</div>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned Driver</Label>
                  <Select value={editDriverId} onValueChange={setEditDriverId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="No driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No driver</SelectItem>
                      {driversData?.data.map((driver) => (
                        <SelectItem key={driver.id} value={String(driver.id)}>
                          {driver.user?.name ?? `Driver #${driver.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rr-notes">Admin Notes</Label>
                <Textarea
                  id="rr-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes for this request…"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateRequest.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
