/**
 * Cálculo de data real (timezone America/Sao_Paulo) para cada dia da Linha Editorial.
 *
 * Estratégia:
 * - Se a semana tem `start_date` (ISO YYYY-MM-DD) explícita persistida, usa ela.
 * - Senão, calcula a partir do `report.created_at`: encontra a primeira segunda-feira
 *   da semana de criação (em horário de São Paulo) e adiciona weekIndex*7 + dayIndex dias.
 * - Tudo em UTC@meio-dia para evitar bugs de DST.
 *
 * Robusto: qualquer falha retorna null e o componente cai para apenas "Dia N".
 */
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SP_TZ = "America/Sao_Paulo";

function spYMD(d: Date): { y: number; m: number; d: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: SP_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = fmt.format(d); // YYYY-MM-DD
    const [y, m, dd] = parts.split("-").map(Number);
    if (!y || !m || !dd) return null;
    return { y, m, d: dd };
  } catch { return null; }
}

/** Segunda-feira (UTC noon) da semana que contém a data {y,m,d}. */
function mondayUTC(y: number, m: number, d: number): Date {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = dt.getUTCDay(); // 0=Dom..6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}

/** Resolve a segunda-feira de início de uma semana. */
export function resolveWeekStart(opts: {
  weekStartDate?: string | null; // ISO YYYY-MM-DD persistido na própria semana
  reportCreatedAt?: string | null;
  weekIndex: number;
}): Date | null {
  const { weekStartDate, reportCreatedAt, weekIndex } = opts;
  if (weekStartDate) {
    const [y, m, d] = weekStartDate.split("-").map(Number);
    if (y && m && d) return mondayUTC(y, m, d);
  }
  if (!reportCreatedAt) return null;
  const created = new Date(reportCreatedAt);
  if (Number.isNaN(created.getTime())) return null;
  const ymd = spYMD(created);
  if (!ymd) return null;
  const base = mondayUTC(ymd.y, ymd.m, ymd.d);
  base.setUTCDate(base.getUTCDate() + weekIndex * 7);
  return base;
}

/** Formata "Seg, 19 mai" para o dia (1..7) de uma semana. */
export function formatDayLabel(opts: {
  weekStartDate?: string | null;
  reportCreatedAt?: string | null;
  weekIndex: number;
  dayNumber: number; // 1..7
}): string | null {
  const start = resolveWeekStart(opts);
  if (!start) return null;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + (opts.dayNumber - 1));
  try {
    // "EEE, dd MMM" => "seg., 19 mai." — removemos pontos e capitalizamos
    const raw = format(d, "EEE, dd MMM", { locale: ptBR }).replace(/\./g, "");
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch { return null; }
}
