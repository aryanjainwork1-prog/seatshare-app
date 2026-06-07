import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetStatsOverview, getGetStatsOverviewQueryKey, useGetStatsActivity, getGetStatsActivityQueryKey } from "@workspace/api-client-react";
import { Users, Car, Map, DollarSign, Activity, Ticket, AlertCircle, ArrowRight } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetStatsOverview({ query: { queryKey: getGetStatsOverviewQueryKey() } });
  const { data: activity, isLoading: isActivityLoading } = useGetStatsActivity({ query: { queryKey: getGetStatsActivityQueryKey() } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
        <p className="text-muted-foreground mt-2">Platform overview and live metrics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats?.totalUsers} icon={Users} isLoading={isLoading} />
        <StatCard title="Active Drivers" value={stats?.onlineDrivers} icon={Car} isLoading={isLoading} />
        <StatCard title="Live Trips" value={stats?.activeTrips} icon={Activity} isLoading={isLoading} className="border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(0,123,255,0.1)]" />
        <StatCard title="Total Revenue" value={stats ? `$${stats.totalRevenue.toLocaleString()}` : undefined} icon={DollarSign} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Trips" value={stats?.totalTrips} icon={Map} isLoading={isLoading} />
        <StatCard title="Total Bookings" value={stats?.totalBookings} icon={Ticket} isLoading={isLoading} />
        <StatCard title="Pending Bookings" value={stats?.pendingBookings} icon={Ticket} isLoading={isLoading} />
        <StatCard title="Open Tickets" value={stats?.openTickets} icon={AlertCircle} isLoading={isLoading} className={stats?.openTickets && stats.openTickets > 0 ? "border-destructive/50 bg-destructive/5 text-destructive" : ""} />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Revenue over time</CardTitle>
            <CardDescription>Daily revenue for the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {isActivityLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="w-full h-[250px]" />
              </div>
            ) : activity?.revenueByDay ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={activity.revenueByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => format(new Date(val), 'MMM d')}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `$${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    formatter={(value: number) => [`$${value}`, 'Revenue']}
                    labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Trips over time</CardTitle>
            <CardDescription>Daily trips for the last 7 days</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {isActivityLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Skeleton className="w-full h-[250px]" />
              </div>
            ) : activity?.tripsByDay ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <LineChart data={activity.tripsByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => format(new Date(val), 'MMM d')}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest passenger ride requests</CardDescription>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="space-y-4">
                {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.recentBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium">{booking.passenger?.name || "Passenger"}</div>
                      <div className="flex items-center text-xs text-muted-foreground gap-1">
                        <span className="truncate max-w-[100px]">{booking.pickupAddress.split(',')[0]}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{booking.dropoffAddress.split(',')[0]}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-bold text-sm">${booking.fare.toFixed(2)}</div>
                      <Badge variant={booking.status === 'pending' ? 'outline' : 'secondary'} className="text-[10px] uppercase h-5">
                        {booking.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New Users</CardTitle>
            <CardDescription>Recently joined platform users</CardDescription>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="space-y-4">
                {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {activity?.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium">{user.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{user.phone}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs text-muted-foreground">{format(new Date(user.createdAt), "MMM d, h:mm a")}</div>
                      <Badge variant="outline" className={
                        user.role === 'admin' ? "border-primary text-primary text-[10px] h-5" :
                        user.role === 'driver' ? "border-amber-500 text-amber-500 text-[10px] h-5" :
                        "border-muted-foreground text-muted-foreground text-[10px] h-5"
                      }>
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading,
  className
}: { 
  title: string; 
  value?: number | string; 
  icon: React.ElementType;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value ?? "-"}</div>
        )}
      </CardContent>
    </Card>
  );
}