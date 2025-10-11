import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: string;
  selected?: boolean;
}

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const { subscription, refreshSubscription } = useAuth();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      toast.error('Please enter a keyword');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-keywords', {
        body: { keyword: searchTerm }
      });

      if (error) throw error;
      
      if (data.keywords && data.keywords.length > 0) {
        setKeywords(data.keywords);
        toast.success(`Found ${data.keywords.length} keywords`);
      } else {
        toast.info('No keywords found');
        setKeywords([]);
      }
    } catch (error: any) {
      console.error('Error searching keywords:', error);
      toast.error(error.message || 'Failed to search keywords');
    } finally {
      setLoading(false);
    }
  };

  const toggleKeywordSelection = (keyword: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyword)) {
        newSet.delete(keyword);
      } else {
        if (newSet.size >= 5) {
          toast.error('Maximum 5 keywords allowed per article');
          return prev;
        }
        newSet.add(keyword);
      }
      return newSet;
    });
  };

  const handleGenerateArticle = async () => {
    if (selectedKeywords.size === 0) {
      toast.error('Please select at least one keyword');
      return;
    }

    if (subscription && subscription.credits_remaining <= 0) {
      toast.error('No credits remaining. Please upgrade your plan.');
      navigate('/billing');
      return;
    }

    setGenerating(true);
    try {
      const keywordsArray = Array.from(selectedKeywords);
      const { data, error } = await supabase.functions.invoke('generate-article', {
        body: { keywords: keywordsArray }
      });

      if (error) throw error;

      toast.success(`Article generated successfully with ${keywordsArray.length} keyword${keywordsArray.length > 1 ? 's' : ''}!`);
      await refreshSubscription();
      setSelectedKeywords(new Set());
      navigate('/articles');
    } catch (error: any) {
      console.error('Error generating article:', error);
      toast.error(error.message || 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Keyword Research
        </h1>
        <p className="text-muted-foreground mt-2">
          Search for trending keywords and generate SEO-optimized articles
        </p>
      </div>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle>Search Keywords</CardTitle>
          <CardDescription>
            Enter a topic to find related keywords with search volume
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              placeholder="e.g., real estate marketing"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading} className="min-w-[120px]">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {keywords.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Search Results ({keywords.length} keywords)</CardTitle>
            <CardDescription>
              Select up to 5 keywords to generate a comprehensive SEO article
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {selectedKeywords.size} keyword{selectedKeywords.size !== 1 ? 's' : ''} selected (max 5)
              </div>
              <Button
                onClick={handleGenerateArticle}
                disabled={generating || selectedKeywords.size === 0 || (subscription ? subscription.credits_remaining <= 0 : false)}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Article...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Article
                  </>
                )}
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Difficulty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw, index) => (
                  <TableRow key={index} className={selectedKeywords.has(kw.keyword) ? 'bg-accent/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeywords.has(kw.keyword)}
                        onCheckedChange={() => toggleKeywordSelection(kw.keyword)}
                        disabled={!selectedKeywords.has(kw.keyword) && selectedKeywords.size >= 5}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>{kw.volume.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        kw.difficulty === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                        kw.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}>
                        {kw.difficulty}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
