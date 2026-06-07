import { useState } from "react";
import { useListPayments, getListPaymentsQueryKey } from "@workspace/api-client-react";
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
import { CreditCard, Wallet, Banknote, HelpCircle } from "lucide-react";

export default function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useListPayments({
    page,
    limit: 10,
    ...(status !== "all" && { status }),
  }, { query: { queryKey: getListPaymentsQueryKey({ page, limit: 10, status: status === "all" ? undefined : status }) } });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="border-amber-500/50 text-amber-500">Pending</Badge>;
      case 'completed': return <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">Completed</Badge>;
      case 'failed': return <Badge variant="destructive" className="bg-destructive/20 text-destructive border border-destructive/30">Failed</Badge>;
      case 'refunded': return <Badge variant="outline" className="border-blue-500/50 text-blue-500">Refunded</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'wallet': return <Wallet className="h-4 w-4" />;
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'upi': return <HelpCircle className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-2">Track transactions and platform revenue.</p>
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border border-border">
        <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-background">
            <SelectValue placeholder="Payment Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Transaction ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Booking Ref</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[80px]" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((payment) => (
                <TableRow key={payment.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {payment.transactionId || `PAY-${payment.id.toString().padStart(6, '0')}`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(payment.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">BKG-{payment.bookingId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm capitalize text-muted-foreground">
                      {getMethodIcon(payment.method)}
                      {payment.method}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-primary">
                    ${payment.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(payment.status)}
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} payments
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