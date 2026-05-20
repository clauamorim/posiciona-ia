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

/** Hoje (UTC noon) na timezone São Paulo. */
export function todaySP(): Date | null {
  const ymd = spYMD(new Date());
  if (!ymd) return null;
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12));
}

function diffDaysUTC(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Identifica a semana "de hoje" em uma lista. Preferência:
 *  1) semana que contém a data atual (start <= hoje < start+7),
 *  2) semana futura mais próxima,
 *  3) semana passada mais recente,
 *  4) última da lista (fallback).
 *
 * Retorna o índice na lista e o dayNumber (1..7) se hoje cair na semana.
 */
export function pickTodayWeek(
  weeks: Array<{ weekStartDate?: string | null; weekIndex: number }>,
  reportCreatedAt?: string | null,
): { listIndex: number; dayNumber: number | null } | null {
  if (!weeks.length) return null;
  const today = todaySP();
  if (!today) return { listIndex: weeks.length - 1, dayNumber: null };

  const rows = weeks.map((w, i) => {
    const start = resolveWeekStart({
      weekStartDate: w.weekStartDate ?? null,
      reportCreatedAt: reportCreatedAt ?? null,
      weekIndex: w.weekIndex,
    });
    const diff = start ? diffDaysUTC(start, today) : null;
    return { i, diff };
  });

  const current = rows.find((r) => r.diff !== null && r.diff >= 0 && r.diff < 7);
  if (current) return { listIndex: current.i, dayNumber: (current.diff as number) + 1 };

  const future = rows
    .filter((r) => r.diff !== null && (r.diff as number) < 0)
    .sort((a, b) => (b.diff as number) - (a.diff as number))[0];
  if (future) return { listIndex: future.i, dayNumber: null };

  const past = rows
    .filter((r) => r.diff !== null && (r.diff as number) >= 7)
    .sort((a, b) => (a.diff as number) - (b.diff as number))[0];
  if (past) return { listIndex: past.i, dayNumber: null };

  return { listIndex: weeks.length - 1, dayNumber: null };
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

/** "18-24 mai" ou "27 abr - 3 mai" (semana = start + 6d). */
export function formatWeekRangeLabel(opts: {
  weekStartDate?: string | null;
  reportCreatedAt?: string | null;
  weekIndex: number;
}): string | null {
  const start = resolveWeekStart(opts);
  if (!start) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  try {
    const sm = format(start, "MMM", { locale: ptBR }).replace(/\./g, "").toLowerCase();
    const em = format(end, "MMM", { locale: ptBR }).replace(/\./g, "").toLowerCase();
    const sd = start.getUTCDate();
    const ed = end.getUTCDate();
    if (sm === em) return `${sd}-${ed} ${sm}`;
    return `${sd} ${sm} - ${ed} ${em}`;
  } catch { return null; }
}

/** "maio 2026" — capitalizado, em SP. */
export function formatMonthYearLabel(opts: {
  weekStartDate?: string | null;
  reportCreatedAt?: string | null;
  weekIndex: number;
}): string | null {
  const start = resolveWeekStart(opts);
  if (!start) return null;
  try {
    const raw = format(start, "LLLL yyyy", { locale: ptBR });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  } catch { return null; }
}
