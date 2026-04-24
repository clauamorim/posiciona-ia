import React, { useState } from "react";
import { MousePointer2, Type, Plus, Sliders, Download } from "lucide-react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DocumentPanel from "./inspector/DocumentPanel";
import SelectionPanel, { SelectedKind } from "./inspector/SelectionPanel";
import AddElementPanel from "./inspector/AddElementPanel";
import type { OverlayImage } from "./PostToolbar";

interface PaletteColor { hex: string; name: string }

type Tab = "selection" | "add" | "document" | null;

export interface MobileEditorBarProps {
  // Document / palette
  palette: PaletteColor[];
  selectedBgIndex: number;
  bgHex: string;
  onBgChange: (i: number) => void;
  onCustomBgColorChange: (c: string) => void;
  canvasFormat?: "square" | "reels";
  onCanvasFormatChange?: (f: "square" | "reels") => void;
  useGradient?: boolean;
  onUseGradientChange?: (v: boolean) => void;
  gradientColor2Index?: number;
  onGradientColor2Change?: (i: number) => void;
  customGradientColor2?: string | null;
  onCustomGradientColor2Change?: (c: string) => void;
  gradientDirection?: string;
  onGradientDirectionChange?: (d: string) => void;
  isCarousel?: boolean;
  showSlideNumber?: boolean;
  onShowSlideNumberChange?: (v: boolean) => void;
  slideNumberSize?: number;
  onSlideNumberSizeChange?: (s: number) => void;
  slideNumberBgColor?: string | null;
  onSlideNumberBgColorChange?: (c: string) => void;
  slideNumberTextColor?: string | null;
  onSlideNumberTextColorChange?: (c: string) => void;

  // Selection
  selectedKind: SelectedKind;
  recommendedFonts?: { display?: string; body?: string };
  titleFontSize?: number;
  onTitleFontSizeChange?: (s: number) => void;
  titleColor?: string | null;
  onTitleColorChange?: (c: string) => void;
  titleFontFamily?: string | null;
  displayFont: string;
  onTitleFontFamilyChange?: (f: string) => void;
  titleTextAlign?: "left" | "center" | "right" | "justify";
  onTitleTextAlignChange?: (a: "left" | "center" | "right" | "justify") => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  fontWeight: string;
  onFontWeightChange: (w: string) => void;
  fontStyle: string;
  onFontStyleChange: (s: string) => void;
  bodyFont: string;
  onBodyFontChange: (f: string) => void;
  textAlign?: "left" | "center" | "right" | "justify";
  onTextAlignChange?: (a: "left" | "center" | "right" | "justify") => void;
  textColor?: string;
  onTextColorChange?: (c: string) => void;
  ctaText?: string;
  onCtaTextChange?: (t: string) => void;
  ctaFontSize?: number;
  onCtaFontSizeChange?: (s: number) => void;
  ctaBgColor?: string | null;
  onCtaBgColorChange?: (c: string) => void;
  ctaTextColor?: string | null;
  onCtaTextColorChange?: (c: string) => void;
  selectedOverlay?: OverlayImage | null;
  onImageOpacityChange?: (id: string, op: number) => void;
  onUpdateOverlaySrc?: (id: string, updates: Partial<OverlayImage>) => void;
  onRemoveBackground?: (id: string) => void;
  removingBackground?: boolean;
  onRecolorElement?: (color: string) => void;
  selectedLayerId?: string | null;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onDeleteOverlay?: (id: string) => void;

  // Add
  userPortraits?: string[];
  onAddImage: (img: OverlayImage) => void;

  // Actions
  onDownload: () => void;
  onReset: () => void;
}

const KIND_LABEL: Record<NonNullable<SelectedKind>, string> = {
  title: "Título",
  body: "Corpo",
  cta: "Botão",
  image: "Imagem",
  icon: "Ícone",
  textbox: "Caixa",
  slideNumber: "Nº slide",
};

const MobileEditorBar: React.FC<MobileEditorBarProps> = (props) => {
  const [tab, setTab] = useState<Tab>(null);

  // Note: drawer NEVER auto-opens — only when user explicitly taps a tab.
  // This keeps the canvas fully visible while editing on mobile.

  const close = () => setTab(null);

  const selectionLabel = props.selectedKind ? KIND_LABEL[props.selectedKind] : "Nada";

  return (
    <>
      {/* Fixed bottom action bar — mobile only */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-2">
          <TabButton
            icon={<MousePointer2 className="h-5 w-5" />}
            label={selectionLabel}
            active={tab === "selection"}
            disabled={!props.selectedKind}
            onClick={() => setTab("selection")}
          />
          <TabButton
            icon={<Type className="h-5 w-5" />}
            label="Texto"
            active={tab === "selection" && (props.selectedKind === "title" || props.selectedKind === "body")}
            onClick={() => setTab("selection")}
            disabled={!props.selectedKind}
          />
          <TabButton
            icon={<Plus className="h-5 w-5" />}
            label="Adicionar"
            active={tab === "add"}
            onClick={() => setTab("add")}
          />
          <TabButton
            icon={<Sliders className="h-5 w-5" />}
            label="Documento"
            active={tab === "document"}
            onClick={() => setTab("document")}
          />
          <TabButton
            icon={<Download className="h-5 w-5" />}
            label="Baixar"
            onClick={props.onDownload}
            highlight
          />
        </div>
      </div>

      {/* Contextual bottom sheet — non-modal + capped height so canvas stays visible/interactive above */}
      <Drawer open={tab !== null} onOpenChange={(o) => !o && close()} shouldScaleBackground={false} modal={false}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Content
            className="md:hidden fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border border-border bg-card max-h-[55vh] shadow-2xl"
          >
            <div className="mx-auto mt-3 h-1.5 w-[60px] rounded-full bg-border" />
          <DrawerHeader className="text-left pb-2 pt-2">
            <DrawerTitle className="text-base">
              {tab === "selection" && `Editar: ${selectionLabel}`}
              {tab === "add" && "Adicionar elemento"}
              {tab === "document" && "Documento"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: "calc(55vh - 110px)" }}>
            {tab === "selection" && (
              <SelectionPanel
                kind={props.selectedKind}
                palette={props.palette}
                recommendedFonts={props.recommendedFonts}
                titleFontSize={props.titleFontSize}
                onTitleFontSizeChange={props.onTitleFontSizeChange}
                titleColor={props.titleColor}
                onTitleColorChange={props.onTitleColorChange}
                titleFontFamily={props.titleFontFamily}
                displayFont={props.displayFont}
                onTitleFontFamilyChange={props.onTitleFontFamilyChange}
                titleTextAlign={props.titleTextAlign}
                onTitleTextAlignChange={props.onTitleTextAlignChange}
                fontSize={props.fontSize}
                onFontSizeChange={props.onFontSizeChange}
                fontWeight={props.fontWeight}
                onFontWeightChange={props.onFontWeightChange}
                fontStyle={props.fontStyle}
                onFontStyleChange={props.onFontStyleChange}
                bodyFont={props.bodyFont}
                onBodyFontChange={props.onBodyFontChange}
                textAlign={props.textAlign}
                onTextAlignChange={props.onTextAlignChange}
                textColor={props.textColor}
                onTextColorChange={props.onTextColorChange}
                ctaText={props.ctaText}
                onCtaTextChange={props.onCtaTextChange}
                ctaFontSize={props.ctaFontSize}
                onCtaFontSizeChange={props.onCtaFontSizeChange}
                ctaBgColor={props.ctaBgColor}
                onCtaBgColorChange={props.onCtaBgColorChange}
                ctaTextColor={props.ctaTextColor}
                onCtaTextColorChange={props.onCtaTextColorChange}
                slideNumberSize={props.slideNumberSize}
                onSlideNumberSizeChange={props.onSlideNumberSizeChange}
                slideNumberBgColor={props.slideNumberBgColor}
                onSlideNumberBgColorChange={props.onSlideNumberBgColorChange}
                slideNumberTextColor={props.slideNumberTextColor}
                onSlideNumberTextColorChange={props.onSlideNumberTextColorChange}
                selectedOverlay={props.selectedOverlay}
                onImageOpacityChange={props.onImageOpacityChange}
                onUpdateOverlaySrc={props.onUpdateOverlaySrc}
                onRemoveBackground={props.onRemoveBackground}
                removingBackground={props.removingBackground}
                onRecolorElement={props.onRecolorElement}
                selectedLayerId={props.selectedLayerId}
                onBringForward={props.onBringForward}
                onSendBackward={props.onSendBackward}
                onDeleteOverlay={(id) => { props.onDeleteOverlay?.(id); close(); }}
              />
            )}
            {tab === "add" && (
              <AddElementPanel
                palette={props.palette}
                defaultElementColor={props.palette[1]?.hex}
                bodyFont={props.bodyFont}
                textColor={props.textColor}
                userPortraits={props.userPortraits}
                onAddImage={(img) => { props.onAddImage(img); close(); }}
                hasSelectedElement={props.selectedKind === "icon"}
                onRecolorSelected={props.onRecolorElement}
                imageSearchQuery={(props as any).imageSearchQuery}
                canvasFormat={props.canvasFormat}
                onUnsplashPick={(props as any).onUnsplashPick}
                onSwapBackground={(props as any).onSwapBackgroundUrl}
                onAIGenerated={(props as any).onAIGenerated}
                regenerationCredits={(props as any).regenerationCredits}
                niche={(props as any).niche}
                businessContext={(props as any).businessContext}
                caption={(props as any).caption}
                postBody={(props as any).postBody}
              />
            )}
            {tab === "document" && (
              <DocumentPanel
                palette={props.palette}
                selectedBgIndex={props.selectedBgIndex}
                bgHex={props.bgHex}
                onBgChange={props.onBgChange}
                onCustomBgColorChange={props.onCustomBgColorChange}
                canvasFormat={props.canvasFormat}
                onCanvasFormatChange={props.onCanvasFormatChange}
                useGradient={props.useGradient}
                onUseGradientChange={props.onUseGradientChange}
                gradientColor2Index={props.gradientColor2Index}
                onGradientColor2Change={props.onGradientColor2Change}
                customGradientColor2={props.customGradientColor2}
                onCustomGradientColor2Change={props.onCustomGradientColor2Change}
                gradientDirection={props.gradientDirection}
                onGradientDirectionChange={props.onGradientDirectionChange}
                isCarousel={props.isCarousel}
                showSlideNumber={props.showSlideNumber}
                onShowSlideNumberChange={props.onShowSlideNumberChange}
                slideNumberSize={props.slideNumberSize}
                onSlideNumberSizeChange={props.onSlideNumberSizeChange}
                slideNumberBgColor={props.slideNumberBgColor}
                onSlideNumberBgColorChange={props.onSlideNumberBgColorChange}
                slideNumberTextColor={props.slideNumberTextColor}
                onSlideNumberTextColorChange={props.onSlideNumberTextColorChange}
                onReset={() => { props.onReset(); close(); }}
              />
            )}
          </div>
          <div className="px-4 pb-4">
            <Button variant="outline" size="sm" className="w-full h-10 text-xs" onClick={close}>
              Fechar
            </Button>
          </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </Drawer>
    </>
  );
};

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ icon, label, active, disabled, highlight, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-lg px-1 py-1.5 transition-colors",
      "text-[10px] font-medium leading-tight tracking-tight",
      disabled && "opacity-40 pointer-events-none",
      highlight
        ? "bg-primary/15 text-primary hover:bg-primary/25"
        : active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
    )}
  >
    {icon}
    <span className="truncate max-w-full">{label}</span>
  </button>
);

export default MobileEditorBar;
