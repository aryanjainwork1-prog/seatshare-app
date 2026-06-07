import { useState } from "react";
import { useListUsers, getListUsersQueryKey, useSuspendUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Users() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useListUsers({
    page,
    limit: 10,
    ...(search && { search }),
    ...(role !== "all" && { role }),
    ...(status !== "all" && { status }),
  }, { query: { queryKey: getListUsersQueryKey({ page, limit: 10, search, role, status }) } });

  const suspendUser = useSuspendUser();

  const handleSuspendToggle = (id: number, currentStatus: string) => {
    const isSuspending = currentStatus !== "suspended";
    suspendUser.mutate({
      id,
      data: { suspend: isSuspending, reason: isSuspending ? "Admin action" : undefined }
    }, {
      onSuccess: () => {
        toast.success(`User successfully ${isSuspending ? "suspended" : "unsuspended"}`);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: () => {
        toast.error("Failed to update user status");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-2">Manage passengers, drivers, and administrators.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email or phone" 
            className="pl-8 bg-background border-border"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        
        <div className="flex gap-4 w-full sm:w-auto">
          <Select value={role} onValueChange={(val) => { setRole(val); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="passenger">Passenger</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead>User</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50">
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((user) => (
                <TableRow key={user.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell>
                    <div className="font-medium">{user.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">ID: {user.id}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{user.phone}</div>
                    <div className="text-xs text-muted-foreground">{user.email || "No email"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      user.role === 'admin' ? "border-primary text-primary" :
                      user.role === 'driver' ? "border-amber-500 text-amber-500" :
                      "border-muted-foreground text-muted-foreground"
                    }>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? "default" : "destructive"} className={user.status === 'active' ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20" : ""}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant={user.status === 'suspended' ? "outline" : "destructive"} 
                      size="sm"
                      className="h-8"
                      disabled={suspendUser.isPending || user.role === 'admin'}
                      onClick={() => handleSuspendToggle(user.id, user.status)}
                    >
                      {user.status === 'suspended' ? (
                        <><CheckCircle2 className="mr-2 h-3 w-3" /> Unsuspend</>
                      ) : (
                        <><Ban className="mr-2 h-3 w-3" /> Suspend</>
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
            Showing {((page - 1) * data.limit) + 1} to {Math.min(page * data.limit, data.total)} of {data.total} users
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
