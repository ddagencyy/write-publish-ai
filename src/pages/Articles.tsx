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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArticle?.title}</DialogTitle>
            <DialogDescription>
              Keyword: {selectedArticle?.keyword}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedArticle?.meta_title && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Meta Title</h4>
                <p className="text-sm">{selectedArticle.meta_title}</p>
              </div>
            )}
            {selectedArticle?.meta_description && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Meta Description</h4>
                <p className="text-sm">{selectedArticle.meta_description}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-1">Content</h4>
              <div className="prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: selectedArticle?.content || '' }} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
