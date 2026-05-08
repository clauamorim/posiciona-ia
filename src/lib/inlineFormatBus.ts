/**
 * Bus global para formatação inline (negrito/itálico/sublinhado).
 *
 * - `PostCanvas` registra o elemento contentEditable ativo via `setActive`.
 * - A barra flutuante e o painel lateral (`SelectionPanel`) chamam
 *   `applyFormat(cmd)` para aplicar formatação na seleção atual.
 * - A `savedRange` é mantida ouvindo `selectionchange` globalmente, então
 *   mesmo que o foco vá para um botão da UI, conseguimos restaurar a seleção.
 */

import { sanitizeRichText } from "./richText";

type Cmd = "bold" | "italic" | "underline";

let activeEl: HTMLElement | null = null;
let savedRange: Range | null = null;
let onChangeCb: ((html: string) => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("selectionchange", () => {
    if (!activeEl) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (activeEl.contains(r.commonAncestorContainer)) {
      savedRange = r.cloneRange();
      notify();
    }
  });
}

export const inlineFormatBus = {
  setActive(el: HTMLElement, onChange: (html: string) => void) {
    activeEl = el;
    onChangeCb = onChange;
    savedRange = null;
    notify();
  },
  clearActive(el: HTMLElement | null) {
    if (!el || activeEl === el) {
      activeEl = null;
      savedRange = null;
      onChangeCb = null;
      notify();
    }
  },
  getActive(): HTMLElement | null { return activeEl; },
  hasActive(): boolean { return !!activeEl; },
  getSavedRange(): Range | null { return savedRange; },
  hasSelection(): boolean {
    return !!(savedRange && !savedRange.collapsed);
  },
  applyFormat(cmd: Cmd): boolean {
    if (!activeEl) return false;
    try { activeEl.focus(); } catch {}
    const sel = window.getSelection();
    if (savedRange && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch {}
    }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    try {
      document.execCommand(cmd, false);
      const after = window.getSelection();
      if (after && after.rangeCount > 0) {
        savedRange = after.getRangeAt(0).cloneRange();
      }
      const html = sanitizeRichText(activeEl.innerHTML || "");
      onChangeCb?.(html);
      notify();
      return true;
    } catch {
      return false;
    }
  },
  queryState(cmd: Cmd): boolean {
    try { return document.queryCommandState(cmd); } catch { return false; }
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
