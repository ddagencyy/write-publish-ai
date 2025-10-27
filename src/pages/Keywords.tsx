import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface KeywordData {
  keyword: string;
  volume: number;
  cpc: string;
  competition: string;
  competitionIndex: number;
  selected?: boolean;
}

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [country, setCountry] = useState('2840'); // USA
  const [language, setLanguage] = useState('1000'); // English
  const [apiError, setApiError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { subscription, refreshSubscription } = useAuth();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      toast.error('Please enter a keyword');
      return;
    }

    setLoading(true);
    setApiError(null);
    try {
      const { data, error } = await supabase.functions.invoke('search-keywords', {
        body: { keyword: searchTerm, country, language }
      });

      if (error) throw error;
      
      if (data.keywords && data.keywords.length > 0) {
        setKeywords(data.keywords);
        toast.success(`Found ${data.keywords.length} keywords with real Google Ads data`);
      } else {
        toast.info('No keywords found');
        setKeywords([]);
      }
    } catch (error: any) {
      console.error('Error searching keywords:', error);
      const errorMsg = error.message || 'Failed to search keywords';
      setApiError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (keywords.length === 0) {
      toast.error('No keywords to export');
      return;
    }

    const csvContent = [
      ['Keyword', 'Avg. Monthly Searches', 'CPC (USD)', 'Competition'],
      ...keywords.map(kw => [
        kw.keyword,
        kw.volume.toString(),
        kw.cpc,
        kw.competition
      ])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `keywords_${searchTerm}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Keywords exported to CSV');
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
            Enter a topic to find related keywords powered by SerpApi + Google Ads API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="e.g., restaurant marketing"
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
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-2 block">Country</label>
                <Select value={country} onValueChange={setCountry} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2840">United States</SelectItem>
                    <SelectItem value="2826">United Kingdom</SelectItem>
                    <SelectItem value="2124">Canada</SelectItem>
                    <SelectItem value="2036">Australia</SelectItem>
                    <SelectItem value="2276">Germany</SelectItem>
                    <SelectItem value="2250">France</SelectItem>
                    <SelectItem value="2380">Italy</SelectItem>
                    <SelectItem value="2724">Spain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-2 block">Language</label>
                <Select value={language} onValueChange={setLanguage} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">English</SelectItem>
                    <SelectItem value="1003">Spanish</SelectItem>
                    <SelectItem value="1002">French</SelectItem>
                    <SelectItem value="1001">German</SelectItem>
                    <SelectItem value="1004">Italian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {apiError && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>API Error</AlertTitle>
          <AlertDescription>
            {apiError}. This might be due to Google Ads API quota limits or authentication issues.
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <Alert className="mb-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading keywords...</AlertTitle>
          <AlertDescription>
            Fetching keywords from SerpApi and enriching with Google Ads data. This may take a moment.
          </AlertDescription>
        </Alert>
      )}

      {keywords.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Search Results ({keywords.length} keywords)</CardTitle>
                <CardDescription>
                  Data-rich keyword suggestions with real Google Ads metrics
                </CardDescription>
              </div>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Avg. Monthly Searches</TableHead>
                    <TableHead className="text-right">CPC (USD)</TableHead>
                    <TableHead>Competition</TableHead>
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
                      <TableCell className="text-right font-mono">{kw.volume.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{kw.cpc}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          kw.competition === 'low' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                          kw.competition === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                        }`}>
                          {kw.competition}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
