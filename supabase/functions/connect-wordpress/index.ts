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
    const { siteUrl, username, appPassword } = await req.json();
    console.log('Connecting WordPress site:', siteUrl);

    // Validate connection by making a test request
    const credentials = btoa(`${username}:${appPassword}`);
    const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
      }
    });

    if (!testResponse.ok) {
      throw new Error("Failed to connect to WordPress. Please check your credentials.");
    }

    // Save WordPress site
    const { data: wpSite, error: insertError } = await supabase
      .from('wordpress_sites')
      .insert({
        user_id: userId,
        site_url: siteUrl,
        username,
        app_password: appPassword,
        is_connected: true
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('WordPress site connected successfully:', wpSite.id);

    return new Response(
      JSON.stringify({ success: true, site: wpSite }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in connect-wordpress:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
