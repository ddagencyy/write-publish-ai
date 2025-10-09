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
    const { articleId } = await req.json();
    console.log('Publishing article:', articleId);

    // Get article
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .eq('user_id', userId)
      .single();

    if (articleError) throw articleError;

    // Get WordPress site
    const { data: wpSites, error: wpError } = await supabase
      .from('wordpress_sites')
      .select('*')
      .eq('user_id', userId)
      .eq('is_connected', true)
      .limit(1);

    if (wpError) throw wpError;
    
    if (!wpSites || wpSites.length === 0) {
      throw new Error("No connected WordPress site found. Please connect a WordPress site first.");
    }

    const wpSite = wpSites[0];

    // Publish to WordPress using REST API
    const credentials = btoa(`${wpSite.username}:${wpSite.app_password}`);
    const wpResponse = await fetch(`${wpSite.site_url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content,
        status: 'publish',
        meta: {
          _yoast_wpseo_title: article.meta_title || '',
          _yoast_wpseo_metadesc: article.meta_description || ''
        }
      })
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text();
      console.error('WordPress API error:', errorText);
      throw new Error(`Failed to publish to WordPress: ${wpResponse.status} - ${errorText}`);
    }

    const wpPost = await wpResponse.json();
    console.log('Published to WordPress, post ID:', wpPost.id);

    // Update article status
    await supabase
      .from('articles')
      .update({
        status: 'published',
        wordpress_post_id: wpPost.id.toString(),
        wordpress_site_id: wpSite.id
      })
      .eq('id', articleId);

    return new Response(
      JSON.stringify({ success: true, wordpressPostId: wpPost.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in publish-to-wordpress:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
