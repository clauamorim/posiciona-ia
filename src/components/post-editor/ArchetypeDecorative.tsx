// Elemento decorativo renderizado dentro do canvas do post, variando por
// grupo de arquétipo. zIndex 5 = acima do background image, abaixo do texto.

import React from "react";
import {
  getArchetypePalette,
  type ArchetypeGroup,
} from "@/lib/archetypePalettes";

interface Props {
  primaryArchetype?: string | null;
  canvasWidth: number;
  canvasHeight: number;
}

export const ArchetypeDecorative: React.FC<Props> = ({
  primaryArchetype,
  canvasWidth,
  canvasHeight,
}) => {
  const palette = getArchetypePalette(primaryArchetype);
  const group: ArchetypeGroup = palette.group;

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 5,
    overflow: "hidden",
  };

  if (group === "elegance") {
    // Cantos opostos com moldura em L (linha fina dourada)
    const cornerSize = Math.round(Math.min(canvasWidth, canvasHeight) * 0.12);
    const stroke = 1.5;
    const inset = Math.round(canvasWidth * 0.04);
    const color = palette.accent;
    return (
      <div style={layerStyle} aria-hidden>
        {/* top-left */}
        <div style={{ position: "absolute", top: inset, left: inset, width: cornerSize, height: stroke, background: color }} />
        <div style={{ position: "absolute", top: inset, left: inset, width: stroke, height: cornerSize, background: color }} />
        {/* bottom-right */}
        <div style={{ position: "absolute", bottom: inset, right: inset, width: cornerSize, height: stroke, background: color }} />
        <div style={{ position: "absolute", bottom: inset, right: inset, width: stroke, height: cornerSize, background: color }} />
      </div>
    );
  }

  if (group === "energy") {
    // Faixa diagonal no topo
    const bandH = Math.round(canvasHeight * 0.08);
    return (
      <div style={layerStyle} aria-hidden>
        <div
          style={{
            position: "absolute",
            top: -bandH * 0.4,
            left: -canvasWidth * 0.1,
            width: canvasWidth * 1.3,
            height: bandH,
            background: palette.accent,
            transform: "rotate(-6deg)",
            opacity: 0.92,
          }}
        />
      </div>
    );
  }

  if (group === "warmth") {
    // Blob orgânico num canto inferior esquerdo, semi-transparente
    const size = Math.round(Math.min(canvasWidth, canvasHeight) * 0.55);
    return (
      <div style={layerStyle} aria-hidden>
        <div
          style={{
            position: "absolute",
            bottom: -size * 0.35,
            left: -size * 0.3,
            width: size,
            height: size,
            background: palette.secondary,
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            opacity: 0.28,
            filter: "blur(2px)",
          }}
        />
      </div>
    );
  }

  if (group === "lightness") {
    // Cluster de 3 círculos no canto superior direito
    const base = Math.round(Math.min(canvasWidth, canvasHeight) * 0.08);
    const margin = Math.round(canvasWidth * 0.06);
    return (
      <div style={layerStyle} aria-hidden>
        <div style={{ position: "absolute", top: margin, right: margin, width: base * 2, height: base * 2, borderRadius: "50%", background: palette.accent, opacity: 0.85 }} />
        <div style={{ position: "absolute", top: margin + base * 1.5, right: margin + base * 1.8, width: base * 1.3, height: base * 1.3, borderRadius: "50%", background: palette.secondary, opacity: 0.9 }} />
        <div style={{ position: "absolute", top: margin + base * 0.4, right: margin + base * 2.4, width: base * 0.9, height: base * 0.9, borderRadius: "50%", background: palette.critical, opacity: 0.85 }} />
      </div>
    );
  }

  return null;
};

export default ArchetypeDecorative;
