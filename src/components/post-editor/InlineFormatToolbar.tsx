import React, { useEffect, useState } from "react";
import { Bold, Italic, Underline } from "lucide-react";

interface Props {
  /** Elemento contentEditable atualmente em edição. */
  editableEl: HTMLElement | null;
  /** Container relativo para posicionamento (o canvas wrapper). */
  containerEl: HTMLElement | null;
}

interface Pos { x: number; y: number; visible: boolean }

const InlineFormatToolbar: React.FC<Props> = ({ editableEl, containerEl }) => {
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, visible: false });
  const [state, setState] = useState({ bold: false, italic: false, underline: false });

  useEffect(() => {
    if (!editableEl || !containerEl) {
      setPos((p) => ({ ...p, visible: false }));
      return;
    }
    const update = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos((p) => ({ ...p, visible: false }));
        return;
      }
      const range = sel.getRangeAt(0);
      // seleção precisa estar dentro do editable
      if (!editableEl.contains(range.commonAncestorContainer)) {
        setPos((p) => ({ ...p, visible: false }));
        return;
      }
      const rect = range.getBoundingClientRect();
      const cRect = containerEl.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos((p) => ({ ...p, visible: false }));
        return;
      }
      setPos({
        x: rect.left - cRect.left + rect.width / 2,
        y: rect.top - cRect.top - 8,
        visible: true,
      });
      try {
        setState({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
        });
      } catch {}
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    update();
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editableEl, containerEl]);

  const apply = (cmd: "bold" | "italic" | "underline") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editableEl) return;
    editableEl.focus();
    try {
      document.execCommand(cmd, false);
      setState({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch {}
  };

  if (!pos.visible) return null;

  const btn = (active: boolean): React.CSSProperties => ({
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

  return (
    <div
      onPointerDown={(e) => e.preventDefault()}
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
      <button type="button" style={btn(state.bold)} onMouseDown={apply("bold")} aria-label="Negrito">
        <Bold size={16} />
      </button>
      <button type="button" style={btn(state.italic)} onMouseDown={apply("italic")} aria-label="Itálico">
        <Italic size={16} />
      </button>
      <button type="button" style={btn(state.underline)} onMouseDown={apply("underline")} aria-label="Sublinhado">
        <Underline size={16} />
      </button>
    </div>
  );
};

export default InlineFormatToolbar;
