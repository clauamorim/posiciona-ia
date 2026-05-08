import React, { useEffect, useState } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { inlineFormatBus } from "@/lib/inlineFormatBus";

interface Props {
  /** Container relativo para posicionamento (o canvas wrapper). */
  containerEl: HTMLElement | null;
}

interface Pos { x: number; y: number; visible: boolean }

const InlineFormatToolbar: React.FC<Props> = ({ containerEl }) => {
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, visible: false });
  const [state, setState] = useState({ bold: false, italic: false, underline: false });

  useEffect(() => {
    const update = () => {
      const editableEl = inlineFormatBus.getActive();
      if (!editableEl || !containerEl) {
        setPos((p) => p.visible ? { ...p, visible: false } : p);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos((p) => p.visible ? { ...p, visible: false } : p);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!editableEl.contains(range.commonAncestorContainer)) {
        setPos((p) => p.visible ? { ...p, visible: false } : p);
        return;
      }
      const rect = range.getBoundingClientRect();
      const cRect = containerEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos((p) => p.visible ? { ...p, visible: false } : p);
        return;
      }
      setPos({
        x: rect.left - cRect.left + rect.width / 2,
        y: rect.top - cRect.top - 8,
        visible: true,
      });
      setState({
        bold: inlineFormatBus.queryState("bold"),
        italic: inlineFormatBus.queryState("italic"),
        underline: inlineFormatBus.queryState("underline"),
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const unsub = inlineFormatBus.subscribe(update);
    update();
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      unsub();
    };
  }, [containerEl]);

  const apply = (cmd: "bold" | "italic" | "underline") => (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    inlineFormatBus.applyFormat(cmd);
    setState({
      bold: inlineFormatBus.queryState("bold"),
      italic: inlineFormatBus.queryState("italic"),
      underline: inlineFormatBus.queryState("underline"),
    });
  };

  if (!pos.visible) return null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "hsl(var(--primary))" : "transparent",
    color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  });

  // Apenas onMouseDown no wrapper preserva a seleção do contentEditable.
  // NÃO usar onPointerDown com preventDefault no wrapper — isso suprime o
  // mousedown/click nos botões filhos em alguns navegadores.
  const stopMouse = (e: React.MouseEvent) => { e.preventDefault(); };

  return (
    <div
      data-inline-format-toolbar
      onMouseDown={stopMouse}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -100%)",
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        padding: 4,
        display: "flex",
        gap: 2,
        zIndex: 99999,
      }}
    >
      {(["bold", "italic", "underline"] as const).map((cmd) => {
        const Icon = cmd === "bold" ? Bold : cmd === "italic" ? Italic : Underline;
        const label = cmd === "bold" ? "Negrito" : cmd === "italic" ? "Itálico" : "Sublinhado";
        return (
          <button
            key={cmd}
            type="button"
            data-inline-format-control
            style={btnStyle(state[cmd])}
            onPointerDown={apply(cmd)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            aria-label={label}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
};

export default InlineFormatToolbar;
