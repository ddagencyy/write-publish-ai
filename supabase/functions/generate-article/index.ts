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

    // Call Gemini API directly for article generation
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
    
    const mainKeyword = keywords[0];
    const secondaryKeywords = keywords.slice(1, 4);
    
    const systemPrompt = `You are an expert SEO content writer specializing in creating high-ranking, Google-optimized blog articles.

CRITICAL SEO ARTICLE REQUIREMENTS:

1. META INFORMATION (Must start with):
   Meta Title: [50-60 characters with main keyword at the beginning]
   Meta Description: [150-160 characters, compelling with clear CTA and keyword]

2. ARTICLE STRUCTURE (Strict hierarchy):
   - ONE <h1> tag: Compelling title with main keyword (60-70 characters)
   - 8-12 <h2> tags: Major sections covering different aspects
   - 3-5 <h3> tags under EACH H2: Detailed subsections
   - Introduction: 200-250 words explaining what readers will learn
   - Conclusion: 150-200 words with key takeaways and CTA

3. CONTENT REQUIREMENTS:
   - LENGTH: 2500-3500 words minimum for comprehensive coverage
   - KEYWORD DENSITY: Main keyword 1.5-2%, naturally integrated
   - READABILITY: Short paragraphs (2-3 sentences), conversational tone
   - ACTIONABLE: Every section must have practical tips or examples
   - ENGAGING: Use questions, analogies, and real-world scenarios

4. FORMATTING (Essential for SEO):
   - Use <ul> or <ol> for lists in EVERY major section
   - Minimum 15-20 bullet points throughout the article
   - Use <strong> for important terms and keywords
   - Break long sections with lists and subheadings
   - Add numbered steps for how-to sections

5. SEO OPTIMIZATION:
   - Main keyword: Use in H1, first paragraph, first H2, conclusion
   - Secondary keywords: Distribute naturally across H2/H3 headings
   - LSI keywords: Include semantic variations throughout
   - Internal link opportunities: Mention related topics naturally
   - Use question-based H2s to target featured snippets

6. CONTENT DEPTH (Each H2 section must have):
   - 250-350 words of content
   - At least one list (bullet points or numbered)
   - Specific examples or case studies
   - Actionable tips readers can implement

7. HTML FORMAT (Clean, semantic structure):
   <h1>Main Title with Primary Keyword</h1>
   
   <p>Introduction paragraph explaining the topic...</p>
   <p>Continue introduction with hook and what readers will learn...</p>
   
   <h2>First Major Section</h2>
   <p>Opening paragraph for this section...</p>
   <h3>Subsection Detail</h3>
   <p>Detailed explanation...</p>
   <ul>
     <li><strong>Point 1:</strong> Explanation</li>
     <li><strong>Point 2:</strong> Explanation</li>
   </ul>
   
   [Repeat structure for all sections]
   
   <h2>Conclusion</h2>
   <p>Summarize key points and provide clear call-to-action...</p>

8. QUALITY CHECKLIST:
   - ✓ Answers user search intent completely
   - ✓ Better than competing articles
   - ✓ Includes unique insights or perspectives
   - ✓ Mobile-friendly formatting
   - ✓ Scannable with clear headings and lists
   - ✓ No fluff or filler content

START YOUR RESPONSE WITH:
Meta Title: [your optimized meta title]
Meta Description: [your compelling meta description]

Then provide the COMPLETE HTML article following the structure above.`;

    const userPrompt = `Write a comprehensive, SEO-optimized article about: "${mainKeyword}"
    
${secondaryKeywords.length > 0 ? `Also naturally incorporate these related keywords: ${secondaryKeywords.join(', ')}` : ''}

Make it informative, actionable, and optimized to rank on Google's first page.`;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error("Gemini API error:", errorData);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.candidates[0].content.parts[0].text;

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
