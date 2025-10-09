import { LayoutDashboard, Search, FileText, Link2, CreditCard, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const items = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Keywords', url: '/keywords', icon: Search },
  { title: 'Articles', url: '/articles', icon: FileText },
  { title: 'WordPress', url: '/wordpress', icon: Link2 },
  { title: 'Billing', url: '/billing', icon: CreditCard },
];

export function AppSidebar() {
  const { signOut, subscription } = useAuth();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">AC</span>
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground">AutoContent</h2>
            <p className="text-xs text-sidebar-foreground/60">AI Content Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      end
                      className={({ isActive }) => 
                        isActive 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                          : 'hover:bg-sidebar-accent/50'
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {subscription && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Your Plan</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="rounded-lg bg-sidebar-accent/30 p-3">
                <div className="text-sm font-medium text-sidebar-foreground capitalize">
                  {subscription.plan}
                </div>
                <div className="text-xs text-sidebar-foreground/60 mt-1">
                  {subscription.credits_remaining} / {subscription.credits_total} credits
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
