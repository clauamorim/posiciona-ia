import React from "react";
import { parseMarkdownSegments, cleanText } from "@/lib/textCleanup";
import { cn } from "@/lib/utils";

interface CleanTextProps {
  children: string;
  className?: string;
  /** If true, render as plain cleaned text (no bold/italic) */
  plain?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Renders AI-generated text with markdown cleaned up.
 * Converts **bold** to <strong> and *italic* to <em>.
 * Fixes punctuation issues automatically.
 */
export const CleanText: React.FC<CleanTextProps> = ({
  children,
  className,
  plain = false,
  as: Tag = "span",
}) => {
  if (!children || typeof children !== "string") return null;

  if (plain) {
    return <Tag className={className}>{cleanText(children)}</Tag>;
  }

  const segments = parseMarkdownSegments(children);

  return (
    <Tag className={className}>
      {segments.map((seg, i) => {
        if (seg.bold) return <strong key={i}>{seg.text}</strong>;
        if (seg.italic) return <em key={i}>{seg.text}</em>;
        return <React.Fragment key={i}>{seg.text}</React.Fragment>;
      })}
    </Tag>
  );
};

export default CleanText;
