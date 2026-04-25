/**
 * Normalização tolerante entre o shape antigo (v5) e o novo (v6) da Linha Editorial.
 *
 * v5: cada semana é um array de 7 posts simples
 *     [{ day, format, theme, caption, card_copy, cta, script, generator_version }]
 *
 * v6: cada semana é um objeto { days: Day[7] } onde cada dia tem dois tracks:
 *     {
 *       day: 1..7,
 *       feed: { format, theme, caption, card_copy, cta, script, is_personal } | null,
 *       story: { theme, frames: string[], is_personal, mirrors_feed },
 *       generator_version: string
 *     }
 *
 * Os helpers abaixo entregam SEMPRE o shape v6 ao componente. Para semanas
 * antigas (v5), inferimos: dias com format reels/carrossel/post viram "feed",
 * dias com format "stories" viram "story" sem feed; quando faltar dado,
 * preenchemos com placeholders vazios.
 */

export interface FeedPostV6 {
  day: number;
  format: "carrossel" | "post" | "reels";
  theme: string;
  caption: string;
  card_copy?: string[];
  cta?: string;
  script?: string;
  is_personal?: boolean;
  generator_version?: string;
}

export interface StoryDayV6 {
  day: number;
  theme: string;
  frames: string[];
  is_personal?: boolean;
  mirrors_feed?: boolean;
  generator_version?: string;
}

export interface DayV6 {
  day: number;
  feed: FeedPostV6 | null;
  story: StoryDayV6;
  generator_version?: string;
}

export interface WeekV6 {
  days: DayV6[];
  /** Marca se a semana foi inferida do shape v5 (legacy) — útil pra UI mostrar aviso. */
  legacy?: boolean;
}

const isObj = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function emptyStory(day: number, mirrorsFeed: boolean): StoryDayV6 {
  return {
    day,
    theme: "",
    frames: [],
    is_personal: !mirrorsFeed,
    mirrors_feed: mirrorsFeed,
  };
}

/**
 * Converte uma semana qualquer para o shape v6.
 */
export function normalizeWeekToV6(week: any): WeekV6 {
  // Já no shape v6
  if (isObj(week) && Array.isArray((week as any).days)) {
    const days: DayV6[] = [];
    for (let i = 0; i < 7; i++) {
      const d = (week as any).days[i];
      if (isObj(d)) {
        const feed = isObj(d.feed) ? (d.feed as FeedPostV6) : null;
        const story = isObj(d.story)
          ? ({
              day: Number(d.story.day || d.day || i + 1),
              theme: String(d.story.theme || ""),
              frames: Array.isArray(d.story.frames) ? d.story.frames.map((s: any) => String(s)) : [],
              is_personal: Boolean(d.story.is_personal),
              mirrors_feed: Boolean(d.story.mirrors_feed),
              generator_version: d.story.generator_version,
            } as StoryDayV6)
          : emptyStory(i + 1, !!feed);
        days.push({
          day: Number(d.day || i + 1),
          feed,
          story,
          generator_version: d.generator_version,
        });
      } else {
        days.push({ day: i + 1, feed: null, story: emptyStory(i + 1, false) });
      }
    }
    return { days };
  }

  // Shape v5: array de posts
  if (Array.isArray(week)) {
    const days: DayV6[] = [];
    for (let i = 0; i < 7; i++) {
      const post = week[i];
      const dayN = isObj(post) && typeof post.day === "number" ? post.day : i + 1;
      let feed: FeedPostV6 | null = null;
      let storyText: { theme: string; frames: string[] } | null = null;

      if (isObj(post)) {
        const fmt = String(post.format || "post").toLowerCase();
        if (fmt === "stories") {
          storyText = {
            theme: String(post.theme || ""),
            frames: typeof post.script === "string" && post.script.trim()
              ? post.script.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
              : (Array.isArray(post.card_copy) ? post.card_copy.map((s: any) => String(s)) : []),
          };
        } else {
          feed = {
            day: dayN,
            format: (["carrossel", "post", "reels"].includes(fmt) ? fmt : "post") as FeedPostV6["format"],
            theme: String(post.theme || ""),
            caption: String(post.caption || ""),
            card_copy: Array.isArray(post.card_copy) ? post.card_copy.map((s: any) => String(s)) : [],
            cta: String(post.cta || ""),
            script: String(post.script || ""),
            is_personal: false,
            generator_version: post.generator_version,
          };
        }
      }

      const story: StoryDayV6 = storyText
        ? {
            day: dayN,
            theme: storyText.theme,
            frames: storyText.frames,
            is_personal: !feed,
            mirrors_feed: false,
          }
        : emptyStory(dayN, !!feed);

      days.push({
        day: dayN,
        feed,
        story,
        generator_version: isObj(post) ? post.generator_version : undefined,
      });
    }
    return { days, legacy: true };
  }

  // Fallback vazio
  return {
    days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      day: d,
      feed: null,
      story: emptyStory(d, false),
    })),
  };
}

/** Resumo curto de um post para listas/log. */
export function summarizeDay(day: DayV6): string {
  const feed = day.feed ? `${day.feed.format}: ${day.feed.theme}` : "sem feed";
  const story = day.story?.theme ? `story: ${day.story.theme}` : "story vazio";
  return `Dia ${day.day} — ${feed} | ${story}`;
}
