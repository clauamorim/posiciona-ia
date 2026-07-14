import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getLatestReport from "./tools/get-latest-report";
import getEditorialWeek from "./tools/get-editorial-week";
import getCreditBalance from "./tools/get-credit-balance";
import listPortraits from "./tools/list-portraits";

// OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy).
// Built from the project ref, which Vite inlines at build time. The fallback
// keeps the issuer well-formed during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "posiciona-mcp",
  title: "Posiciona MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do Posiciona (posicionamento de marca pessoal). Use get_latest_report para o relatório estratégico mais recente do usuário, get_editorial_week para conteúdo semanal, get_credit_balance para saldo de créditos, e list_portraits para retratos de marca gerados.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getLatestReport, getEditorialWeek, getCreditBalance, listPortraits],
});
