## Objetivo

Melhorar a legibilidade no desktop em duas frentes:

1. **Logo e marca "Posiciona"** — aumentar o ícone e o texto da marca no header da landing page, no header/sidebar do app (DashboardLayout) e no badge do hero.
2. **Fontes pequenas** — revisar áreas onde `text-xs` (12px) e `text-sm` (14px) prejudicam a leitura no desktop, subindo um degrau em pontos-chave (navegação, parágrafos, labels de cards e descrições).

Mantém-se mobile inalterado quando possível, usando breakpoints `md:` para crescer só no desktop e não comprometer telas pequenas.

---

## Escopo das mudanças

### 1. Logo e marca "Posiciona"

**Landing page (`src/pages/LandingPage.tsx`)**
- Header: ícone passa de `h-8 w-8` para `h-10 w-10`; texto "Posiciona" passa de `text-lg` para `text-xl`; altura do header ajustada de `h-14` para `h-16` para acomodar.
- Badge do hero: ícone passa de `h-5 w-5` para `h-6 w-6`; badge ganha um pouco mais de padding vertical.

**App (`src/components/DashboardLayout.tsx`)**
- Logo do header mobile e da sidebar passa de `h-5 w-5` para `h-7 w-7`.
- Texto "Posiciona" (quando presente ao lado da logo) sobe um degrau (`text-base` → `text-lg`, ou equivalente conforme uso atual).

### 2. Legibilidade no desktop

**Landing page**
- Navegação do header: `text-sm` → `md:text-base`.
- Parágrafo do hero: já `md:text-lg`, manter; revisar parágrafos secundários (features, depoimentos, FAQ) que estão em `text-sm` para `md:text-base`.
- Microcopy de cards (features, "veja na prática", planos): subir `text-xs` para `text-sm` no desktop quando for texto descritivo (não label/etiqueta).

**Dashboard / áreas do app**
- Descrições de cards e textos auxiliares em `text-xs` no desktop sobem para `text-sm` (mantendo `text-xs` em chips, badges e labels de status, que são intencionalmente menores).
- Navegação lateral mantém hierarquia, mas labels passam para tamanho confortável no desktop.

**Limites**
- Não alterar fontes dentro do **editor de posts** (toolbar, painéis de inspetor) — esse contexto exige UI compacta.
- Não alterar tamanhos dentro de **PDFs/relatórios exportados** (`ReportPdfDocument.tsx`) para preservar layout impresso.
- Não tocar em badges, chips, tags e contadores — devem permanecer pequenos por design.

---

## Arquivos a editar

- `src/pages/LandingPage.tsx` — logo, marca, navegação, microcopy de seções.
- `src/components/DashboardLayout.tsx` — logo e marca no app.
- `src/pages/Dashboard.tsx` — descrições e textos auxiliares.
- `src/pages/EditorialPage.tsx` — descrições dos cards de semana (sem tocar no editor).
- `src/pages/Report.tsx` — textos de apoio na visualização web (não no PDF).

## Fora de escopo

- Editor de posts e seus painéis.
- Componentes de PDF.
- Badges, chips, contadores numéricos.
- Mudanças em mobile (mantém como está; só cresce em `md:`+).

## Pergunta antes de implementar

Você prefere:
- **(A) Ajuste conservador** — aumento sutil só na logo/marca e em parágrafos de leitura corrida. Mantém densidade atual em listas e cards.
- **(B) Ajuste mais amplo** — além do conservador, sobe também microcopy de cards, navegação e descrições secundárias para `text-sm`/`text-base` no desktop.

Vou aguardar sua escolha (A ou B) antes de implementar.
