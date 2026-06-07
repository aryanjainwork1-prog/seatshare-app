import { useState } from "react";
import { useListAdminLogs, getListAdminLogsQueryKey } from "@workspace/api-client-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Logs() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListAdminLogs({
    page,
    limit: 20,
  }, { query: { queryKey: getListAdminLogsQueryKey({ page, limit: 20 }) } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground mt-2">Audit trail of all administrative actions taken on the platform.</p>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin ID</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No activity logs found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((log) => (
                <TableRow key={log.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {log.adminId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-accent text-accent-foreground capitalize font-mono text-xs">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {log.entityType}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {log.entityId || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]" title={log.details || ""}>
                    {log.details || "-"}
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} logs
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