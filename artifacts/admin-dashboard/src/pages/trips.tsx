import { useState } from "react";
import { useListTrips, getListTripsQueryKey, useCancelTrip } from "@workspace/api-client-react";
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
import { ArrowRight, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Trips() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useListTrips({
    page,
    limit: 10,
    ...(status !== "all" && { status }),
  }, { query: { queryKey: getListTripsQueryKey({ page, limit: 10, status: status === "all" ? undefined : status }) } });

  const cancelTrip = useCancelTrip();

  const handleCancel = (id: number) => {
    cancelTrip.mutate({
      id,
      data: { reason: "Admin cancelled" }
    }, {
      onSuccess: () => {
        toast.success(`Trip cancelled successfully`);
        queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
      },
      onError: () => {
        toast.error("Failed to cancel trip");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="border-amber-500/50 text-amber-500">Pending</Badge>;
      case 'active': return <Badge variant="default" className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">Active</Badge>;
      case 'completed': return <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">Completed</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trips</h1>
        <p className="text-muted-foreground mt-2">Monitor all driver-created trips across the platform.</p>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border border-border">
        <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Trip Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Route</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Fare/Seat</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-8 w-[250px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[140px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No trips found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((trip) => (
                <TableRow key={trip.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[300px]">
                      <div className="text-sm truncate" title={trip.originAddress}>{trip.originAddress.split(',')[0]}</div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <div className="text-sm font-medium truncate text-primary" title={trip.destAddress}>{trip.destAddress.split(',')[0]}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{trip.driverProfile?.user?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">ID: {trip.driverProfileId}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(trip.departureTime), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-accent">{trip.availableSeats} left</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    ${trip.farePerSeat.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(trip.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    {trip.status === 'pending' && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="h-8"
                        disabled={cancelTrip.isPending}
                        onClick={() => handleCancel(trip.id)}
                      >
                        <XCircle className="mr-2 h-3 w-3" /> Cancel
                      </Button>
                    )}
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} trips
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
