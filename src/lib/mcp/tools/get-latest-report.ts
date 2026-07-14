import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_latest_report",
  title: "Get latest strategic report",
  description:
    "Return the most recent (highest version) strategic report for the signed-in Posiciona user, including archetype analysis and narrative content.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("reports")
      .select("id, version, status, content, created_at, updated_at")
      .eq("user_id", ctx.getUserId())
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No report found for this user yet." }] };

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { report: data },
    };
  },
});
