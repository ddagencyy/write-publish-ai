import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Zap, TrendingUp, CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { subscription } = useAuth();
  const [stats, setStats] = useState({
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: articles } = await supabase
        .from('articles')
        .select('status');
      
      if (articles) {
        setStats({
          totalArticles: articles.length,
          publishedArticles: articles.filter(a => a.status === 'published').length,
          draftArticles: articles.filter(a => a.status === 'draft').length
        });
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome to AutoContent AI - Generate and publish SEO-optimized articles
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArticles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All generated articles
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publishedArticles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Live on WordPress
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draftArticles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to publish
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
            <Zap className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscription?.credits_remaining || 0} / {subscription?.credits_total || 3}
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {subscription?.plan || 'free'} plan
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with AutoContent AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/keywords" className="block p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all border border-primary/20">
              <h3 className="font-semibold text-foreground">Search Keywords</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Find trending keywords with search volume data
              </p>
            </a>
            <a href="/articles" className="block p-4 rounded-lg bg-gradient-to-r from-accent/10 to-accent/5 hover:from-accent/20 hover:to-accent/10 transition-all border border-accent/20">
              <h3 className="font-semibold text-foreground">Manage Articles</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View and publish your generated articles
              </p>
            </a>
          </CardContent>
        </Card>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Your Subscription</CardTitle>
            <CardDescription>Current plan details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <div>
                  <div className="font-semibold capitalize">{subscription?.plan || 'Free'} Plan</div>
                  <div className="text-sm text-muted-foreground">
                    {subscription?.credits_remaining || 0} credits remaining
                  </div>
                </div>
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <a 
                href="/billing" 
                className="block w-full text-center py-2 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Upgrade Plan
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
