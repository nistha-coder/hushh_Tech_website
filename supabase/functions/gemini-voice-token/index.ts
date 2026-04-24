import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "https://hushhtech.com",
]);

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // Allow only trusted origins
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  }

  // Always allow preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Block only invalid browser origins
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Deprecated endpoint
  return new Response(
    JSON.stringify({
      error: "Endpoint deprecated for security reasons",
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
});
