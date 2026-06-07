import { useState } from "react";
import { useListSupportTickets, getListSupportTicketsQueryKey, useUpdateSupportTicket } from "@workspace/api-client-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { SupportTicket } from "@workspace/api-client-react";

export default function Support() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const queryClient = useQueryClient();

  const { data, isLoading } = useListSupportTickets({
    page,
    limit: 10,
    ...(statusFilter !== "all" && { status: statusFilter }),
  }, { query: { queryKey: getListSupportTicketsQueryKey({ page, limit: 10, status: statusFilter === "all" ? undefined : statusFilter }) } });

  const updateTicket = useUpdateSupportTicket();

  const handleEditClick = (ticket: SupportTicket) => {
    setEditingTicket(ticket);
    setResolutionText(ticket.resolution || "");
    setNewStatus(ticket.status);
  };

  const handleUpdateSubmit = () => {
    if (!editingTicket) return;

    updateTicket.mutate({
      id: editingTicket.id,
      data: { status: newStatus, resolution: resolutionText }
    }, {
      onSuccess: () => {
        toast.success(`Ticket updated successfully`);
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
        setEditingTicket(null);
      },
      onError: () => toast.error("Failed to update ticket")
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge variant="destructive" className="bg-destructive/20 text-destructive border border-destructive/30">Open</Badge>;
      case 'in_progress': return <Badge variant="outline" className="border-amber-500/50 text-amber-500">In Progress</Badge>;
      case 'resolved': return <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">Resolved</Badge>;
      case 'closed': return <Badge variant="outline" className="text-muted-foreground">Closed</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
        <p className="text-muted-foreground mt-2">Manage customer issues and driver inquiries.</p>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border border-border">
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Ticket Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Subject</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-5 w-[250px]" /><Skeleton className="h-3 w-[300px] mt-2" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No support tickets found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((ticket) => (
                <TableRow key={ticket.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="font-medium">{ticket.subject}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1 max-w-md mt-1">{ticket.message}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{ticket.user?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{ticket.user?.email || ticket.user?.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(ticket.createdAt), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(ticket.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8"
                      onClick={() => handleEditClick(ticket)}
                    >
                      <Edit2 className="mr-2 h-3 w-3" /> Update
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} tickets
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * data.limit >= data.total}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={!!editingTicket} onOpenChange={(open) => !open && setEditingTicket(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {editingTicket && (
              <>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Subject</h4>
                  <p className="text-sm text-muted-foreground">{editingTicket.subject}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Message</h4>
                  <p className="text-sm bg-muted/50 p-3 rounded-md border border-border whitespace-pre-wrap">{editingTicket.message}</p>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea 
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Details about how this ticket was handled..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTicket(null)}>Cancel</Button>
            <Button onClick={handleUpdateSubmit} disabled={updateTicket.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}