import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache for storing keyword data (24 hours)
const cache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Get Google Ads access token
async function getGoogleAdsAccessToken() {
  const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

// Fetch Google Ads keyword metrics
async function getGoogleAdsMetrics(keywords: string[], country: string, language: string) {
  try {
    const accessToken = await getGoogleAdsAccessToken();
    const customerId = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID");
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "developer-token": developerToken!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: customerId,
          language: language,
          geoTargetConstants: [country],
          keywords: keywords.map(kw => ({ text: kw })),
          keywordPlanNetwork: "GOOGLE_SEARCH",
        }),
      }
    );

    if (!response.ok) {
      console.error('Google Ads API error:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Google Ads metrics:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword, country = "2840", language = "1000" } = await req.json(); // Default: USA (2840), English (1000)
    console.log('Searching for keyword:', keyword, 'Country:', country, 'Language:', language);

    // Check cache first
    const cacheKey = `${keyword}_${country}_${language}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached results');
      return new Response(JSON.stringify({ keywords: cached.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serpApiKey = Deno.env.get("SERP_API_KEY");
    
    // Step 1: Get keywords from SerpApi
    let serpKeywords = [];
    const prefixes = ['best', 'top', 'how to', 'what is', 'why', 'when', 'where', 'affordable', 'cheap', 'local'];
    const suffixes = ['near me', 'tips', 'guide', 'tutorial', 'for beginners', 'review', 'comparison', 'vs', 'online', 'service', 'cost', 'price', 'benefits', 'ideas', 'examples', '2025', 'today'];
    const questions = ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'can'];
    
    if (!serpApiKey) {
      console.log('SERP_API_KEY not found, generating mock data');
      
      for (let i = 0; i < 60; i++) {
        const prefix = prefixes[i % prefixes.length];
        const suffix = suffixes[Math.floor(i / prefixes.length) % suffixes.length];
        const question = questions[i % questions.length];
        
        let kw = '';
        const variation = i % 4;
        if (variation === 0) kw = `${prefix} ${keyword}`;
        else if (variation === 1) kw = `${keyword} ${suffix}`;
        else if (variation === 2) kw = `${prefix} ${keyword} ${suffix}`;
        else kw = `${question} ${keyword}`;
        
        serpKeywords.push(kw);
      }
    } else {
      console.log('SERP_API_KEY found, fetching from Google');
      
      const searchResponse = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(keyword)}&api_key=${serpApiKey}&num=10&gl=us`
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        
        if (searchData.related_searches) {
          searchData.related_searches.forEach((item: any) => {
            serpKeywords.push(item.query);
          });
        }
        
        if (searchData.related_questions) {
          searchData.related_questions.forEach((item: any) => {
            serpKeywords.push(item.question);
          });
        }
      }
      
      // Add semantic variations
      if (serpKeywords.length < 50) {
        const needed = 50 - serpKeywords.length;
        
        for (let i = 0; i < needed; i++) {
          const prefix = prefixes[i % prefixes.length];
          const suffix = suffixes[i % suffixes.length];
          const variation = i % 3;
          
          let kw = '';
          if (variation === 0) kw = `${prefix} ${keyword}`;
          else if (variation === 1) kw = `${keyword} ${suffix}`;
          else kw = `${prefix} ${keyword} ${suffix}`;
          
          serpKeywords.push(kw);
        }
      }
    }

    console.log(`Generated ${serpKeywords.length} keywords from SerpApi`);

    // Step 2: Enrich with Google Ads metrics
    const googleAdsResults = await getGoogleAdsMetrics(serpKeywords, country, language);
    console.log(`Received ${googleAdsResults.length} results from Google Ads`);

    // Step 3: Combine data
    const enrichedKeywords = [];
    const seenKeywords = new Set();

    for (const result of googleAdsResults) {
      const keywordText = result.text || result.keywordIdeaMetrics?.text;
      if (!keywordText) continue;

      // Filter out duplicates
      if (seenKeywords.has(keywordText.toLowerCase())) continue;
      seenKeywords.add(keywordText.toLowerCase());

      // Filter: Remove keywords longer than 6 words
      const wordCount = keywordText.trim().split(/\s+/).length;
      if (wordCount > 6) continue;

      // Filter: Remove AI-related keywords
      const aiRelatedTerms = ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'gpt'];
      const lowerKeyword = keywordText.toLowerCase();
      if (aiRelatedTerms.some(term => lowerKeyword.includes(term))) continue;

      const metrics = result.keywordIdeaMetrics || {};
      const avgMonthlySearches = metrics.avgMonthlySearches || 0;
      const lowBid = metrics.lowTopOfPageBidMicros ? (metrics.lowTopOfPageBidMicros / 1000000).toFixed(2) : '0.00';
      const highBid = metrics.highTopOfPageBidMicros ? (metrics.highTopOfPageBidMicros / 1000000).toFixed(2) : '0.00';
      const competitionIndex = metrics.competitionIndex || 0;

      let competition = 'low';
      if (competitionIndex > 66) competition = 'high';
      else if (competitionIndex > 33) competition = 'medium';

      enrichedKeywords.push({
        keyword: keywordText,
        volume: avgMonthlySearches,
        cpc: `$${lowBid} - $${highBid}`,
        competition,
        competitionIndex,
      });
    }

    // Sort by volume (highest first)
    enrichedKeywords.sort((a, b) => b.volume - a.volume);

    // Limit to 50 keywords
    const finalKeywords = enrichedKeywords.slice(0, 50);

    // Cache the results
    cache.set(cacheKey, {
      data: finalKeywords,
      timestamp: Date.now(),
    });

    console.log(`Returning ${finalKeywords.length} enriched keywords`);

    return new Response(JSON.stringify({ keywords: finalKeywords }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in search-keywords:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
