// Mini-componentes compartilhados do template Governante.
// Portados de design-sources/governante/cards-data.jsx (sem globals window.*).

import React from "react";

interface PeEyebrowProps {
  children: React.ReactNode;
  color: string;
  size?: number;
  weight?: number;
}

export const PeEyebrow: React.FC<PeEyebrowProps> = ({
  children,
  color,
  size = 11,
  weight = 700,
}) => (
  <div
    style={{
      fontFamily: '"Lato", sans-serif',
      fontWeight: weight,
      fontSize: size,
      letterSpacing: 3,
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

interface PeRuleProps {
  color: string;
  mt?: number;
  mb?: number;
  opacity?: number;
  height?: number;
}

export const PeRule: React.FC<PeRuleProps> = ({
  color,
  mt = 0,
  mb = 0,
  opacity = 0.9,
  height = 0.5,
}) => (
  <div
    style={{
      height,
      background: color,
      marginTop: mt,
      marginBottom: mb,
      opacity,
    }}
  />
);

interface PeDiamondProps {
  color: string;
  size?: number;
}

export const PeDiamond: React.FC<PeDiamondProps> = ({ color, size = 6 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: color,
      transform: "rotate(45deg)",
      flex: "0 0 auto",
    }}
  />
);
