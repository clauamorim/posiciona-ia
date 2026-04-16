/**
 * Text-first PDF layout for the strategic report.
 * Rendered off-screen during export; never shown in the UI.
 * Uses inline styles only (so html2canvas captures it deterministically).
 */

const COVER_BG = "#FAF8F5";
const TEXT_PRIMARY = "#1A1A2E";
const TEXT_BODY = "#2D2D3A";
const TEXT_MUTED = "#6B6B7A";
const RULE = "#E8E2D8";

const STORYBRAND_LABELS: Record<string, string> = {
  hero: "O Herói (Cliente)",
  guide: "O Guia (Marca)",
  external_problem: "Problema Externo",
  internal_problem: "Problema Interno",
  philosophical_problem: "Problema Filosófico",
  plan: "O Plano",
  cta: "Chamada para Ação",
  success: "O Sucesso",
  failure: "O Fracasso",
};
const STORYBRAND_ORDER = [
  "hero", "guide", "external_problem", "internal_problem",
  "philosophical_problem", "plan", "cta", "success", "failure",
];

const sectionStyle: React.CSSProperties = {
  padding: "28px 36px",
  borderTop: `1px solid ${RULE}`,
  background: COVER_BG,
  color: TEXT_BODY,
  fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
  fontSize: 13.5,
  lineHeight: 1.65,
};

const h2Style: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: 26,
  fontWeight: 600,
  color: TEXT_PRIMARY,
  margin: "0 0 6px 0",
  letterSpacing: "-0.01em",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: TEXT_MUTED,
  fontWeight: 600,
  marginBottom: 18,
};

const h3Style: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: 19,
  fontWeight: 600,
  color: TEXT_PRIMARY,
  margin: "0 0 6px 0",
};

const subLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: TEXT_MUTED,
  fontWeight: 600,
  marginBottom: 4,
  marginTop: 12,
};

const pStyle: React.CSSProperties = {
  margin: "0 0 10px 0",
  color: TEXT_BODY,
};

const ulStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  paddingLeft: 18,
  color: TEXT_BODY,
};

interface Props {
  content: any;
  archetypes: any[] | null;
  createdAt?: string | null;
  userName?: string | null;
}

export function ReportPdfDocument({ content, archetypes, createdAt, userName }: Props) {
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const palette = content?.visual_identity?.palette || [];
  const typography = content?.visual_identity?.typography;
  const styleText = content?.visual_identity?.style;
  const tone = content?.tone_of_voice;
  const figurino = content?.figurino;
  const simbolos = content?.simbolos;
  const storybrand = content?.storybrand;

  return (
    <div
      style={{
        background: COVER_BG,
        color: TEXT_BODY,
        fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
        width: 900,
      }}
    >
      {/* COVER */}
      <div data-pdf-section style={{ ...sectionStyle, borderTop: "none", padding: "80px 36px 60px", textAlign: "center" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 28 }}>Posiciona</div>
        <h1 style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 46,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          margin: "0 0 14px 0",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}>
          Relatório de Posicionamento
        </h1>
        <div style={{
          width: 60,
          height: 1,
          background: TEXT_PRIMARY,
          margin: "24px auto",
          opacity: 0.4,
        }} />
        {userName && (
          <p style={{ fontSize: 16, color: TEXT_PRIMARY, margin: "0 0 6px 0", fontWeight: 500 }}>
            {userName}
          </p>
        )}
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0, letterSpacing: "0.05em" }}>{dateStr}</p>
      </div>

      {/* ARCHETYPES */}
      {archetypes && archetypes.length > 0 && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Identidade</div>
          <h2 style={h2Style}>Seus Arquétipos de Marca</h2>
          <p style={{ ...pStyle, color: TEXT_MUTED, marginBottom: 24 }}>
            Os três arquétipos que estruturam a sua narrativa, comportamento e expressão visual.
          </p>
          {archetypes.map((a) => (
            <div key={a.name} style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${RULE}` }}>
              <div style={{ ...eyebrowStyle, marginBottom: 6, fontSize: 9.5 }}>{a.label}</div>
              <h3 style={h3Style}>{a.name}</h3>
              {a.description && <p style={pStyle}>{a.description}</p>}
              {a.application && <p style={{ ...pStyle, fontStyle: "italic", color: TEXT_MUTED }}>{a.application}</p>}
              {a.characteristics?.length > 0 && (
                <p style={{ ...pStyle, marginTop: 8 }}>
                  <span style={{ color: TEXT_MUTED, fontWeight: 600 }}>Características: </span>
                  {a.characteristics.join(" · ")}
                </p>
              )}
              {a.brands?.length > 0 && (
                <p style={pStyle}>
                  <span style={{ color: TEXT_MUTED, fontWeight: 600 }}>Marcas de referência: </span>
                  {a.brands.join(" · ")}
                </p>
              )}
              {a.people?.length > 0 && (
                <p style={pStyle}>
                  <span style={{ color: TEXT_MUTED, fontWeight: 600 }}>Personalidades: </span>
                  {a.people.join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PALETTE + TYPOGRAPHY */}
      {(palette.length > 0 || typography || styleText) && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Identidade Visual</div>
          <h2 style={h2Style}>Paleta & Tipografia</h2>

          {palette.length > 0 && (
            <div style={{ marginTop: 18, marginBottom: 22 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {palette.map((c: any, i: number) => (
                  <div key={i} style={{ width: 150 }}>
                    <div style={{
                      width: "100%",
                      height: 64,
                      background: c.hex,
                      borderRadius: 4,
                      border: `1px solid ${RULE}`,
                    }} />
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: TEXT_PRIMARY }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "monospace" }}>{c.hex}</div>
                      {c.usage && <div style={{ fontSize: 10.5, color: TEXT_BODY, marginTop: 3, lineHeight: 1.4 }}>{c.usage}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(typography || styleText) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 28,
              marginTop: 18,
              paddingTop: 20,
              borderTop: `1px solid ${RULE}`,
            }}>
              {typography && (
                <div>
                  <div style={subLabelStyle}>Tipografia</div>
                  {typography.display && <p style={pStyle}><strong style={{ color: TEXT_PRIMARY }}>Display:</strong> {typography.display}</p>}
                  {typography.body && <p style={pStyle}><strong style={{ color: TEXT_PRIMARY }}>Corpo:</strong> {typography.body}</p>}
                  {typography.accent && <p style={pStyle}><strong style={{ color: TEXT_PRIMARY }}>Destaque:</strong> {typography.accent}</p>}
                </div>
              )}
              {styleText && (
                <div>
                  <div style={subLabelStyle}>Estilo Visual</div>
                  <p style={pStyle}>{styleText}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TONE OF VOICE */}
      {tone && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Comunicação</div>
          <h2 style={h2Style}>Tom de Voz</h2>
          {tone.summary && <p style={pStyle}>{tone.summary}</p>}
          {tone.communication_style && <p style={{ ...pStyle, color: TEXT_MUTED }}>{tone.communication_style}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 16 }}>
            {tone.words_to_use?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Palavras para usar</div>
                <p style={pStyle}>{tone.words_to_use.join(" · ")}</p>
              </div>
            )}
            {tone.words_to_avoid?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Palavras para evitar</div>
                <p style={pStyle}>{tone.words_to_avoid.join(" · ")}</p>
              </div>
            )}
            {tone.emotions_to_evoke?.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={subLabelStyle}>Emoções para evocar</div>
                <p style={pStyle}>{tone.emotions_to_evoke.join(" · ")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIGURINO */}
      {figurino && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Imagem Pessoal</div>
          <h2 style={h2Style}>Figurino Estratégico</h2>
          {figurino.resumo && <p style={pStyle}>{figurino.resumo}</p>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 18 }}>
            {figurino.pecas_chave?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Peças-chave</div>
                <ul style={ulStyle}>{figurino.pecas_chave.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
            {figurino.cores_roupa?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Cores de roupa</div>
                <p style={pStyle}>{figurino.cores_roupa.join(" · ")}</p>
              </div>
            )}
            {figurino.sapatos?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Sapatos</div>
                <ul style={ulStyle}>{figurino.sapatos.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {figurino.acessorios?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Acessórios</div>
                <ul style={ulStyle}>{figurino.acessorios.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {figurino.cabelo && (
              <div>
                <div style={subLabelStyle}>Cabelo</div>
                <p style={pStyle}>{figurino.cabelo}</p>
              </div>
            )}
            {figurino.maquiagem_grooming && (
              <div>
                <div style={subLabelStyle}>Maquiagem / Grooming</div>
                <p style={pStyle}>{figurino.maquiagem_grooming}</p>
              </div>
            )}
            {figurino.texturas_tecidos?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Tecidos & texturas</div>
                <p style={pStyle}>{figurino.texturas_tecidos.join(" · ")}</p>
              </div>
            )}
            {figurino.estampas?.length > 0 && (
              <div>
                <div style={subLabelStyle}>Estampas</div>
                <p style={pStyle}>{figurino.estampas.join(" · ")}</p>
              </div>
            )}
            {figurino.evitar?.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={subLabelStyle}>Evitar</div>
                <ul style={ulStyle}>{figurino.evitar.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
          </div>

          {figurino.looks_completos?.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${RULE}` }}>
              <div style={subLabelStyle}>Looks completos</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8 }}>
                {figurino.looks_completos.map((look: any, i: number) => (
                  <div key={i}>
                    <h3 style={{ ...h3Style, fontSize: 16 }}>{look.nome}</h3>
                    <ul style={ulStyle}>{(look.pecas || []).map((p: string, j: number) => <li key={j}>{p}</li>)}</ul>
                    {look.ocasiao && <p style={{ ...pStyle, marginTop: 6, fontStyle: "italic", color: TEXT_MUTED }}>Ocasião: {look.ocasiao}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYMBOLS */}
      {simbolos && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Linguagem Visual</div>
          <h2 style={h2Style}>Símbolos dos Arquétipos</h2>
          {(["primary", "secondary", "tertiary"] as const).map((rank, idx) => {
            const symbolData = simbolos[rank];
            if (!symbolData) return null;
            const labels = ["Primário", "Secundário", "Terciário"];
            const symbols = Array.isArray(symbolData) ? symbolData : [symbolData];
            return (
              <div key={rank} style={{ marginTop: 18, paddingTop: 18, borderTop: idx === 0 ? "none" : `1px solid ${RULE}` }}>
                <div style={{ ...eyebrowStyle, fontSize: 9.5, marginBottom: 6 }}>{labels[idx]}</div>
                {symbols.map((s: any, si: number) => (
                  <div key={si} style={{ marginTop: si > 0 ? 12 : 0 }}>
                    <h3 style={h3Style}>{s.nome} {s.simbolo && <span style={{ color: TEXT_MUTED, fontSize: 16 }}>· {s.simbolo}</span>}</h3>
                    {s.significado && <p style={pStyle}><strong style={{ color: TEXT_PRIMARY }}>Significado:</strong> {s.significado}</p>}
                    {s.aplicacao && <p style={{ ...pStyle, color: TEXT_MUTED }}><strong style={{ color: TEXT_PRIMARY }}>Aplicação:</strong> {s.aplicacao}</p>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* STORYBRAND */}
      {storybrand && (
        <div data-pdf-section style={sectionStyle}>
          <div style={eyebrowStyle}>Estratégia</div>
          <h2 style={h2Style}>Narrativa da Marca</h2>
          <p style={{ ...pStyle, color: TEXT_MUTED, marginBottom: 18 }}>
            A história que sustenta toda a comunicação da marca, estruturada em nove blocos.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            {STORYBRAND_ORDER.map((key) => {
              const val = storybrand[key];
              if (!val) return null;
              return (
                <div key={key}>
                  <div style={subLabelStyle}>{STORYBRAND_LABELS[key]}</div>
                  {Array.isArray(val) ? (
                    <ul style={ulStyle}>{val.map((v: string, i: number) => <li key={i}>{v}</li>)}</ul>
                  ) : (
                    <p style={pStyle}>{val}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ ...sectionStyle, padding: "24px 36px", textAlign: "center" }}>
        <p style={{ fontSize: 10.5, color: TEXT_MUTED, margin: 0, letterSpacing: "0.08em" }}>
          POSICIONA · DOCUMENTO ESTRATÉGICO
        </p>
      </div>
    </div>
  );
}
