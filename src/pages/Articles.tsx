import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Article {
  id: string;
  keyword: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  created_at: string;
}

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (articleId: string) => {
    setPublishing(articleId);
    try {
      const { data, error } = await supabase.functions.invoke('publish-to-wordpress', {
        body: { articleId }
      });

      if (error) throw error;

      toast.success('Article published successfully!');
      await fetchArticles();
    } catch (error: any) {
      console.error('Error publishing article:', error);
      toast.error(error.message || 'Failed to publish article');
    } finally {
      setPublishing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Articles
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage and publish your AI-generated articles
        </p>
      </div>

      {articles.length === 0 ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>No Articles Yet</CardTitle>
            <CardDescription>
              Start by searching for keywords and generating your first article
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/keywords'}>
              <FileText className="mr-2 h-4 w-4" />
              Search Keywords
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Articles</CardTitle>
            <CardDescription>
              {articles.length} article{articles.length !== 1 ? 's' : ''} generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="font-medium">{article.keyword}</TableCell>
                    <TableCell className="max-w-xs truncate">{article.title}</TableCell>
                    <TableCell>
                      <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                        {article.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(article.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedArticle(article)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {article.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(article.id)}
                            disabled={publishing === article.id}
                          >
                            {publishing === article.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                Publish
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl pr-8">{selectedArticle?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-4 mt-2">
              <span>Keyword: <strong>{selectedArticle?.keyword}</strong></span>
              <Badge variant={selectedArticle?.status === 'published' ? 'default' : 'secondary'}>
                {selectedArticle?.status}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* SEO Meta Information */}
            <div className="bg-accent/10 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-primary">SEO Meta Information</h4>
              {selectedArticle?.meta_title && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Meta Title ({selectedArticle.meta_title.length} chars)</span>
                  <p className="text-sm font-medium mt-1">{selectedArticle.meta_title}</p>
                </div>
              )}
              {selectedArticle?.meta_description && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Meta Description ({selectedArticle.meta_description.length} chars)</span>
                  <p className="text-sm mt-1">{selectedArticle.meta_description}</p>
                </div>
              )}
            </div>

            {/* Article Content with SEO Styling */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm uppercase tracking-wide text-primary">Article Content</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedArticle?.content || '');
                    toast.success('Content copied to clipboard!');
                  }}
                >
                  Copy HTML
                </Button>
              </div>
              
              <div 
                className="prose prose-slate dark:prose-invert max-w-none
                  prose-headings:font-bold prose-headings:tracking-tight
                  prose-h1:text-3xl prose-h1:mb-4 prose-h1:text-primary
                  prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-primary
                  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                  prose-p:text-base prose-p:leading-7 prose-p:mb-4
                  prose-li:my-2 prose-li:text-base
                  prose-ul:my-4 prose-ol:my-4
                  prose-strong:text-primary prose-strong:font-semibold
                  prose-a:text-primary prose-a:underline"
                dangerouslySetInnerHTML={{ __html: selectedArticle?.content || '' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
