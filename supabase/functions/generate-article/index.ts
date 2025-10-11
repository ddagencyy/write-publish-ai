import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const userId = userData.user.id;
    const { keywords: keywordsArray } = await req.json();
    const keywords = Array.isArray(keywordsArray) ? keywordsArray : [keywordsArray];
    console.log('Generating article for keywords:', keywords);

    // Check credits
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (subError) throw subError;
    
    if (subscription.credits_remaining <= 0) {
      return new Response(
        JSON.stringify({ error: "No credits remaining" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Lovable AI Gateway for article generation
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    
    const mainKeyword = keywords[0];
    const secondaryKeywords = keywords.slice(1, 4);
    
    const systemPrompt = `You are an expert SEO content writer specializing in creating high-ranking, comprehensive blog articles.

CRITICAL SEO REQUIREMENTS:
1. STRUCTURE - Must include:
   - Compelling H1 title with main keyword
   - 6-8 H2 sections (main topics)
   - 2-3 H3 subsections under each H2
   - Introduction paragraph (150-200 words)
   - Conclusion paragraph (100-150 words)
   
2. LENGTH: 1800-2500 words minimum

3. KEYWORD OPTIMIZATION:
   - Main keyword in H1, first paragraph, and naturally throughout (1-2% density)
   - Secondary keywords integrated naturally
   - Use semantic variations and LSI keywords
   
4. CONTENT QUALITY:
   - Write in conversational, engaging tone
   - Include actionable tips and specific examples
   - Add statistics or data points when relevant
   - Use bullet points and numbered lists for readability
   - Short paragraphs (2-4 sentences max)
   
5. SEO ELEMENTS:
   - Meta title: 50-60 characters, include main keyword
   - Meta description: 150-160 characters, compelling with CTA
   - Internal linking suggestions (mention related topics)
   
6. FORMAT: Return as clean HTML with semantic tags:
   - <h1> for title
   - <h2> for main sections
   - <h3> for subsections
   - <p> for paragraphs
   - <ul>/<ol> for lists
   - <strong> for emphasis
   
START with these exact lines:
Meta Title: [your meta title]
Meta Description: [your meta description]

Then provide the full HTML article.`;

    const userPrompt = `Write a comprehensive, SEO-optimized article about: "${mainKeyword}"
    
${secondaryKeywords.length > 0 ? `Also naturally incorporate these related keywords: ${secondaryKeywords.join(', ')}` : ''}

Make it informative, actionable, and optimized to rank on Google's first page.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits depleted. Please add credits to your workspace.");
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    // Parse the generated content to extract meta info
    const metaTitleMatch = generatedContent.match(/Meta Title:?\s*(.+?)(?:\n|$)/i);
    const metaDescMatch = generatedContent.match(/Meta Description:?\s*(.+?)(?:\n|$)/i);
    const titleMatch = generatedContent.match(/<h1[^>]*>(.+?)<\/h1>/i) || 
                      generatedContent.match(/Title:?\s*(.+?)(?:\n|$)/i);
    
    const metaTitle = metaTitleMatch ? metaTitleMatch[1].trim() : `${mainKeyword} - Complete Guide`;
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : `Learn everything about ${mainKeyword} in this comprehensive guide.`;
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `The Complete Guide to ${mainKeyword}`;

    // Clean content (remove meta tags from content)
    let cleanContent = generatedContent
      .replace(/Meta Title:?\s*.+?(?:\n|$)/gi, '')
      .replace(/Meta Description:?\s*.+?(?:\n|$)/gi, '')
      .replace(/Title:?\s*.+?(?:\n|$)/gi, '')
      .trim();

    // Ensure content is wrapped in paragraphs if not already HTML
    if (!cleanContent.includes('<')) {
      cleanContent = cleanContent.split('\n\n').map((p: string) => `<p>${p}</p>`).join('\n');
    }

    // Save article to database
    const { data: article, error: insertError } = await supabase
      .from('articles')
      .insert({
        user_id: userId,
        keyword: mainKeyword,
        title,
        meta_title: metaTitle,
        meta_description: metaDescription,
        content: cleanContent,
        status: 'draft'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Deduct credit (1 credit per article, regardless of keyword count)
    await supabase
      .from('user_subscriptions')
      .update({ credits_remaining: subscription.credits_remaining - 1 })
      .eq('user_id', userId);

    console.log('Article generated successfully:', article.id);

    return new Response(
      JSON.stringify({ article }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-article:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
