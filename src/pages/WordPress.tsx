import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WordPressSite {
  id: string;
  site_url: string;
  username: string;
  is_connected: boolean;
}

export default function WordPress() {
  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [formData, setFormData] = useState({
    siteUrl: '',
    username: '',
    appPassword: ''
  });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('wordpress_sites')
        .select('*');

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load WordPress sites');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.siteUrl || !formData.username || !formData.appPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-wordpress', {
        body: formData
      });

      if (error) throw error;

      toast.success('WordPress site connected successfully!');
      setFormData({ siteUrl: '', username: '', appPassword: '' });
      await fetchSites();
    } catch (error: any) {
      console.error('Error connecting WordPress:', error);
      toast.error(error.message || 'Failed to connect WordPress site');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          WordPress Integration
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect your WordPress site to publish articles automatically
        </p>
      </div>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle>Connect WordPress Site</CardTitle>
          <CardDescription>
            Enter your WordPress site credentials to enable auto-publishing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site URL</Label>
              <Input
                id="siteUrl"
                placeholder="https://yoursite.com"
                value={formData.siteUrl}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                disabled={connecting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="admin"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={connecting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appPassword">Application Password</Label>
              <Input
                id="appPassword"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={formData.appPassword}
                onChange={(e) => setFormData({ ...formData, appPassword: e.target.value })}
                disabled={connecting}
              />
              <p className="text-xs text-muted-foreground">
                Generate an application password in WordPress: Users → Your Profile → Application Passwords
              </p>
            </div>

            <Button type="submit" disabled={connecting} className="w-full">
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect Site
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {sites.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Connected Sites</CardTitle>
            <CardDescription>
              Your WordPress sites for publishing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    {site.is_connected ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium">{site.site_url}</div>
                      <div className="text-sm text-muted-foreground">
                        {site.username}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${
                    site.is_connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {site.is_connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
