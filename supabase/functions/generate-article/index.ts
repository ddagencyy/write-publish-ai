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
    const { keyword } = await req.json();
    console.log('Generating article for keyword:', keyword);

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
    
    const systemPrompt = `You are an expert SEO content writer. Generate a comprehensive, SEO-optimized blog article of 1200-1500 words. 
    
    Requirements:
    - Create an engaging meta title (60 characters max)
    - Write a compelling meta description (160 characters max)
    - Structure with H2 and H3 headings
    - Include an introduction and conclusion
    - Use natural, engaging language
    - Optimize for the target keyword naturally
    - Return the content in clean HTML format`;

    const userPrompt = `Write a complete SEO-optimized article about: "${keyword}"`;

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
    
    const metaTitle = metaTitleMatch ? metaTitleMatch[1].trim() : `${keyword} - Complete Guide`;
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : `Learn everything about ${keyword} in this comprehensive guide.`;
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `The Complete Guide to ${keyword}`;

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
        keyword,
        title,
        meta_title: metaTitle,
        meta_description: metaDescription,
        content: cleanContent,
        status: 'draft'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Deduct credit
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
