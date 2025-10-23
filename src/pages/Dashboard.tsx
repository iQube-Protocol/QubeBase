import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Building2, Shield, Layers, Database, FileText, UserCheck, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalTenants: number;
  totalSites: number;
  totalRoles: number;
  totalUserRoles: number;
  totalUsers: number;
  totalPayloads: number;
  totalPayloadGrants: number;
  totalContacts: number;
  totalAccounts: number;
  totalInstances: number;
  totalTemplates: number;
  totalProofs: number;
  totalEntitlements: number;
  sitesByTenant: Array<{ tenant_name: string; site_count: number }>;
  rolesByTenant: Array<{ tenant_name: string; role_count: number }>;
  templateInstances: Array<{ template_name: string; instance_count: number }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch counts from public schema
      const [tenantsRes, sitesRes, rolesRes, userRolesRes] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('sites').select('*', { count: 'exact', head: true }),
        supabase.from('roles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }),
      ]);

      // Fetch sites by tenant
      const { data: sitesData } = await supabase
        .from('sites')
        .select('tenant_id, tenants(name)')
        .order('tenant_id');

      // Fetch roles by tenant
      const { data: rolesData } = await supabase
        .from('roles')
        .select('tenant_id, tenants(name)')
        .order('tenant_id');

      // Process sites by tenant
      const sitesByTenant = sitesData?.reduce((acc: any[], site: any) => {
        const tenantName = site.tenants?.name || 'Unknown';
        const existing = acc.find(item => item.tenant_name === tenantName);
        if (existing) {
          existing.site_count += 1;
        } else {
          acc.push({ tenant_name: tenantName, site_count: 1 });
        }
        return acc;
      }, []) || [];

      // Process roles by tenant
      const rolesByTenant = rolesData?.reduce((acc: any[], role: any) => {
        const tenantName = role.tenants?.name || 'Unknown';
        const existing = acc.find(item => item.tenant_name === tenantName);
        if (existing) {
          existing.role_count += 1;
        } else {
          acc.push({ tenant_name: tenantName, role_count: 1 });
        }
        return acc;
      }, []) || [];

      setStats({
        totalTenants: tenantsRes.count || 0,
        totalSites: sitesRes.count || 0,
        totalRoles: rolesRes.count || 0,
        totalUserRoles: userRolesRes.count || 0,
        totalUsers: 0, // Note: Schema queries require RLS access
        totalPayloads: 0,
        totalPayloadGrants: 0,
        totalContacts: 0,
        totalAccounts: 0,
        totalInstances: 0,
        totalTemplates: 0,
        totalProofs: 0,
        totalEntitlements: 0,
        sitesByTenant,
        rolesByTenant,
        templateInstances: [],
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">QubeBase Dashboard</h1>
          <p className="text-muted-foreground">Overview of your platform statistics</p>
        </div>

        {/* Summary Cards - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTenants}</div>
              <p className="text-xs text-muted-foreground">Active organizations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSites}</div>
              <p className="text-xs text-muted-foreground">Across all tenants</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Role Assignments</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUserRoles}</div>
              <p className="text-xs text-muted-foreground">Active assignments</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards - Row 2: Registry & CRM */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTemplates}</div>
              <p className="text-xs text-muted-foreground">Registry templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Instances</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalInstances}</div>
              <p className="text-xs text-muted-foreground">Registry instances</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payloads</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPayloads}</div>
              <p className="text-xs text-muted-foreground">Stored payloads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CRM Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalContacts}</div>
              <p className="text-xs text-muted-foreground">Total contacts</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Sites by Tenant</CardTitle>
              <CardDescription>Distribution of sites across tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.sitesByTenant}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="tenant_name" stroke="hsl(var(--foreground))" />
                  <YAxis stroke="hsl(var(--foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="site_count" fill="hsl(var(--primary))" name="Sites" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roles by Tenant</CardTitle>
              <CardDescription>Distribution of roles across tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats?.rolesByTenant}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.tenant_name}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="role_count"
                  >
                    {stats?.rolesByTenant.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
