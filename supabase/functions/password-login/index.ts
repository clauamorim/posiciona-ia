// Edge function: password-login
// Proxies email/password sign-in through the backend so the browser never
// has to talk to /auth/v1/token directly (which can be blocked by Safari /
// iCloud Private Relay / extensions / Preview proxies).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const email = (payload.email || "").trim().toLowerCase();
  const password = payload.password || "";
  if (!email || !password) {
    return json(400, { code: "missing_credentials", message: "Informe e-mail e senha." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ email, password, gotrue_meta_security: {} }),
      }
    );
    const data = await upstream.json().catch(() => ({}));
    return json(upstream.status, data);
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return json(aborted ? 504 : 502, {
      code: aborted ? "upstream_timeout" : "upstream_error",
      message: aborted
        ? "O servidor de autenticação demorou para responder."
        : "Não foi possível contatar o servidor de autenticação.",
    });
  } finally {
    clearTimeout(timer);
  }
});
