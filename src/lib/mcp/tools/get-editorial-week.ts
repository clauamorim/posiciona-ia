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
  name: "get_editorial_week",
  title: "Get editorial week",
  description:
    "Return the content of a single editorial week (7 days of posts) from the signed-in user's latest strategic report. Omit weekIndex to get the most recent week.",
  inputSchema: {
    weekIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Zero-based index of the week to fetch. Omit for the latest week."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ weekIndex }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("reports")
      .select("editorial_weeks")
      .eq("user_id", ctx.getUserId())
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const weeks = (data?.editorial_weeks as any[]) ?? [];
    if (!weeks.length) {
      return { content: [{ type: "text", text: "No editorial weeks generated yet." }] };
    }
    const idx = typeof weekIndex === "number" ? weekIndex : weeks.length - 1;
    if (idx < 0 || idx >= weeks.length) {
      return {
        content: [{ type: "text", text: `weekIndex out of range. Available: 0..${weeks.length - 1}` }],
        isError: true,
      };
    }
    const week = weeks[idx];
    return {
      content: [{ type: "text", text: JSON.stringify(week) }],
      structuredContent: { weekIndex: idx, totalWeeks: weeks.length, week },
    };
  },
});
