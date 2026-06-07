import { useState } from "react";
import { useListBookings, getListBookingsQueryKey, useAcceptBooking, useRejectBooking, useCompleteBooking } from "@workspace/api-client-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Bookings() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  
  const [actionBooking, setActionBooking] = useState<{ id: number, type: 'reject' | 'complete' | null }>({ id: 0, type: null });
  const [actionInput, setActionInput] = useState("");

  const queryClient = useQueryClient();

  const { data, isLoading } = useListBookings({
    page,
    limit: 10,
    ...(status !== "all" && { status }),
  }, { query: { queryKey: getListBookingsQueryKey({ page, limit: 10, status: status === "all" ? undefined : status }) } });

  const acceptBooking = useAcceptBooking();
  const rejectBooking = useRejectBooking();
  const completeBooking = useCompleteBooking();

  const handleAccept = (id: number) => {
    acceptBooking.mutate({
      id,
      data: { note: "Accepted by admin" }
    }, {
      onSuccess: () => {
        toast.success(`Booking accepted`);
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      },
      onError: () => toast.error("Failed to accept booking")
    });
  };

  const handleActionSubmit = () => {
    if (actionBooking.type === 'reject') {
      rejectBooking.mutate({ id: actionBooking.id, data: { reason: actionInput || "Admin rejected" } }, {
        onSuccess: () => {
          toast.success("Booking rejected");
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          setActionBooking({ id: 0, type: null });
          setActionInput("");
        },
        onError: () => toast.error("Failed to reject booking")
      });
    } else if (actionBooking.type === 'complete') {
      completeBooking.mutate({ id: actionBooking.id, data: { boardingCode: actionInput || "0000" } }, {
        onSuccess: () => {
          toast.success("Booking completed");
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
          setActionBooking({ id: 0, type: null });
          setActionInput("");
        },
        onError: () => toast.error("Failed to complete booking")
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="border-amber-500/50 text-amber-500">Pending</Badge>;
      case 'accepted': return <Badge variant="default" className="bg-blue-500/20 text-blue-500 border border-blue-500/30 hover:bg-blue-500/30">Accepted</Badge>;
      case 'completed': return <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">Completed</Badge>;
      case 'cancelled': 
      case 'rejected': return <Badge variant="destructive" className="bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 capitalize">{status}</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-2">Manage passenger ride requests and their statuses.</p>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border border-border">
        <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Booking Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Route</TableHead>
              <TableHead>Passenger</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Fare</TableHead>
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
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[120px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((booking) => (
                <TableRow key={booking.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col gap-1 max-w-[300px]">
                      <div className="text-sm truncate" title={booking.pickupAddress}>{booking.pickupAddress.split(',')[0]}</div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <div className="text-sm font-medium truncate text-primary" title={booking.dropoffAddress}>{booking.dropoffAddress.split(',')[0]}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{booking.passenger?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">ID: {booking.passengerId}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(booking.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${booking.fare.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(booking.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {booking.status === 'pending' && (
                        <>
                          <Button 
                            variant="default" 
                            size="sm"
                            className="h-8"
                            disabled={acceptBooking.isPending}
                            onClick={() => handleAccept(booking.id)}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" /> Accept
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="h-8"
                            onClick={() => setActionBooking({ id: booking.id, type: 'reject' })}
                          >
                            <XCircle className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {booking.status === 'accepted' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => setActionBooking({ id: booking.id, type: 'complete' })}
                        >
                          Complete
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} bookings
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={actionBooking.type !== null} onOpenChange={(open) => !open && setActionBooking({ id: 0, type: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionBooking.type === 'reject' ? 'Reject Booking' : 'Complete Booking'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="action-input">
              {actionBooking.type === 'reject' ? 'Rejection Reason' : 'Boarding Code'}
            </Label>
            <Input 
              id="action-input"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder={actionBooking.type === 'reject' ? 'e.g. Driver unavailable' : 'e.g. 1234'}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionBooking({ id: 0, type: null })}>Cancel</Button>
            <Button onClick={handleActionSubmit} disabled={rejectBooking.isPending || completeBooking.isPending}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}