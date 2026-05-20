import React, { useState, useEffect, useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ImagePlus, PlusSquare, Type as TypeIcon, Shapes, Minus, Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Star, Heart, CheckCircle, Quote, ArrowRight, ArrowUp as ArrowUpIcon, Zap, Award,
  Circle, Square as SquareIcon, Triangle, Hexagon, Diamond, Flame, Target, Crown,
  ThumbsUp, Bookmark, Send, AtSign, Hash, MapPin, Clock, Eye,
  Lightbulb, Gift, Camera as CameraIcon, Coffee, Smile, Bell, Flag, Shield, Layers,
  Feather, Music, Pen, Globe, Sparkles, Lock, Unlock, Settings, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/imageUtils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ColorPicker, { PaletteColor } from "./ColorPicker";
import ImageGalleryPanel from "./ImageGalleryPanel";
import type { PhotographerInfo } from "@/lib/postAutoLayout";
import { clearLogoCache, chromaKeyAndValidate } from "@/lib/postAutoLayout";
import type { OverlayImage } from "../PostToolbar";

type GraphicEl = { icon: React.FC<any>; name: string };

const ICON_CATEGORIES: { key: string; label: string; items: GraphicEl[] }[] = [
  {
    key: "shapes",
    label: "Formas básicas",
    items: [
      { icon: Circle, name: "Círculo" }, { icon: SquareIcon, name: "Quadrado" },
      { icon: Triangle, name: "Triângulo" }, { icon: Hexagon, name: "Hexágono" },
      { icon: Diamond, name: "Diamante" },
    ],
  },
  {
    key: "arrows",
    label: "Setas e direções",
    items: [
      { icon: ArrowRight, name: "Seta direita" }, { icon: ArrowUpIcon, name: "Seta cima" },
      { icon: Send, name: "Enviar" },
    ],
  },
  {
    key: "decor",
    label: "Símbolos decorativos",
    items: [
      { icon: Star, name: "Estrela" }, { icon: Heart, name: "Coração" },
      { icon: Sparkles, name: "Brilho" }, { icon: Crown, name: "Coroa" },
      { icon: Award, name: "Prêmio" }, { icon: Flame, name: "Chama" },
      { icon: Gift, name: "Presente" }, { icon: Feather, name: "Pena" },
    ],
  },
  {
    key: "functional",
    label: "Ícones funcionais",
    items: [
      { icon: CheckCircle, name: "Check" }, { icon: Quote, name: "Aspas" },
      { icon: Zap, name: "Raio" }, { icon: Target, name: "Alvo" },
      { icon: Lightbulb, name: "Lâmpada" }, { icon: ThumbsUp, name: "Curtir" },
      { icon: Bookmark, name: "Salvar" }, { icon: AtSign, name: "Arroba" },
      { icon: Hash, name: "Hashtag" }, { icon: MapPin, name: "Local" },
      { icon: Clock, name: "Relógio" }, { icon: Eye, name: "Olho" },
      { icon: Bell, name: "Sino" }, { icon: Flag, name: "Bandeira" },
      { icon: Shield, name: "Escudo" },
    ],
  },
  {
    key: "other",
    label: "Outros",
    items: [
      { icon: CameraIcon, name: "Câmera" }, { icon: Coffee, name: "Café" },
      { icon: Smile, name: "Sorriso" }, { icon: Layers, name: "Camadas" },
      { icon: Music, name: "Música" }, { icon: Pen, name: "Caneta" },
      { icon: Globe, name: "Globo" }, { icon: Lock, name: "Cadeado" },
      { icon: Unlock, name: "Desbloq." }, { icon: Settings, name: "Config." },
    ],
  },
];

const GRAPHIC_ELEMENTS: GraphicEl[] = ICON_CATEGORIES.flatMap((c) => c.items);

const SVG_ELEMENTS: { name: string; svg: string }[] = [
  { name: "Barra fina", svg: `<svg width="400" height="8" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="8" rx="4" fill="currentColor"/></svg>` },
  { name: "Barra grossa", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="24" rx="4" fill="currentColor"/></svg>` },
  { name: "Barra vertical", svg: `<svg width="8" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="8" height="400" rx="4" fill="currentColor"/></svg>` },
  { name: "Moldura retangular", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="12" fill="none" stroke="currentColor" stroke-width="8"/></svg>` },
  { name: "Moldura circular", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" stroke-width="8"/></svg>` },
  { name: "Cantos decorativos", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><path d="M8 80 L8 8 L80 8" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M320 8 L392 8 L392 80" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M392 320 L392 392 L320 392" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M80 392 L8 392 L8 320" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>` },
  { name: "Linha ondulada", svg: `<svg width="400" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0 20 Q50 0 100 20 Q150 40 200 20 Q250 0 300 20 Q350 40 400 20" fill="none" stroke="currentColor" stroke-width="4"/></svg>` },
  { name: "Linha pontilhada", svg: `<svg width="400" height="8" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="4" x2="400" y2="4" stroke="currentColor" stroke-width="4" stroke-dasharray="12 8" stroke-linecap="round"/></svg>` },
  { name: "Divider decorativo", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="12" x2="170" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="200" cy="12" r="6" fill="currentColor"/><line x1="230" y1="12" x2="400" y2="12" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Aspas grandes", svg: `<svg width="120" height="100" xmlns="http://www.w3.org/2000/svg"><text x="0" y="80" font-size="100" font-family="Georgia" fill="currentColor">"</text></svg>` },
  { name: "Seta larga", svg: `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg"><polygon points="0,15 150,15 150,0 200,30 150,60 150,45 0,45" fill="currentColor"/></svg>` },
  { name: "Moldura dupla", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><rect x="20" y="20" width="360" height="360" rx="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Moldura arredondada", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="40" fill="none" stroke="currentColor" stroke-width="6"/></svg>` },
  { name: "Separador losango", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="12" x2="160" y2="12" stroke="currentColor" stroke-width="2"/><polygon points="200,0 212,12 200,24 188,12" fill="currentColor"/><line x1="240" y1="12" x2="400" y2="12" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Barra diagonal", svg: `<svg width="400" height="60" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="60" x2="400" y2="0" stroke="currentColor" stroke-width="4"/></svg>` },
];

function iconToDataUrl(IconComponent: React.FC<any>, color: string): string {
  const svgMarkup = renderToStaticMarkup(<IconComponent size={120} color={color} strokeWidth={2} />);
  return `data:image/svg+xml;base64,${btoa(svgMarkup)}`;
}

function svgToDataUrl(svg: string, color: string): string {
  const colored = svg.replace(/currentColor/g, color);
  return `data:image/svg+xml;base64,${btoa(colored)}`;
}

interface UserAsset {
  id: string;
  name: string;
  file_path: string;
  url: string;
  is_logo?: boolean;
}

interface AddElementPanelProps {
  palette: PaletteColor[];
  defaultElementColor?: string;
  bodyFont: string;
  textColor?: string;
  userPortraits?: string[];
  onAddImage: (image: OverlayImage) => void;
  onPortraitsChanged?: () => void;
  hasSelectedElement?: boolean;
  onRecolorSelected?: (color: string) => void;
  /** Tema/palavra-chave para busca de imagens (default = tema do post). */
  imageSearchQuery?: string;
  /** Formato do canvas para escolher orientação no Pexels. */
  canvasFormat?: "square" | "reels";
  /** Chamado quando usuário pega imagem do Pexels (para metadados de fotógrafo). */
  onPexelsPick?: (photographer: PhotographerInfo) => void;
  /** Chamado quando uma imagem precisa virar fundo (substitui bg atual). */
  onSwapBackground?: (url: string, source?: "ai" | "pexels" | "saved") => void;
  /** Chamado após geração IA bem-sucedida — retorna false quando o débito falha. */
  onAIGenerated?: () => Promise<boolean | void> | boolean | void;
  /** Saldo atual de créditos de regeneração (para validação). */
  regenerationCredits?: number;
  /** Nicho do usuário, usado para refinar busca/IA. */
  niche?: string;
  /** Contexto de negócio (empresa + serviços + público) para IA. */
  businessContext?: string;
  /** Legenda do post — refina busca/IA. */
  caption?: string;
  /** Corpo do post (slide atual ou texto editado). */
  postBody?: string;
}

const AddElementPanel: React.FC<AddElementPanelProps> = ({
  palette, defaultElementColor, bodyFont, textColor, userPortraits = [], onAddImage, onPortraitsChanged,
  hasSelectedElement, onRecolorSelected,
  imageSearchQuery = "", canvasFormat = "square", onPexelsPick, onSwapBackground,
  onAIGenerated, regenerationCredits, niche, businessContext, caption, postBody,
}) => {
  const { user } = useAuth();
  const [elementColor, setElementColor] = useState(defaultElementColor || palette[0]?.hex || "#7c3aed");
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [userAssetsLoaded, setUserAssetsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load user gallery
  const loadUserAssets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_gallery_assets")
      .select("id, name, file_path, is_logo")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!data) { setUserAssets([]); setUserAssetsLoaded(true); return; }
    const assets = await Promise.all(data.map(async (a: any) => {
      const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(a.file_path, 60 * 60);
      return { id: a.id, name: a.name, file_path: a.file_path, url: signed?.signedUrl || "", is_logo: !!a.is_logo };
    }));
    setUserAssets(assets.filter(a => a.url));
    setUserAssetsLoaded(true);
  };

  useEffect(() => { if (user && !userAssetsLoaded) loadUserAssets(); }, [user, userAssetsLoaded]);

  // Atualiza a galeria pessoal quando uma nova imagem IA/Pexels é salva pelo editor
  useEffect(() => {
    const handler = () => { if (user) loadUserAssets(); };
    window.addEventListener("posiciona:gallery-updated", handler);
    return () => window.removeEventListener("posiciona:gallery-updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Modal state for "is this a logo?" prompt
  const [pendingUpload, setPendingUpload] = useState<{
    blob: Blob; name: string; isLogo: boolean;
  } | null>(null);

  const [removingBgId, setRemovingBgId] = useState<string | null>(null);

  const toggleLogo = async (asset: UserAsset) => {
    if (!user) return;
    const next = !asset.is_logo;
    // Ao marcar como logo, desmarca todas as outras do usuário (única logo ativa)
    if (next) {
      const { error: clearErr } = await supabase
        .from("user_gallery_assets")
        .update({ is_logo: false })
        .eq("user_id", user.id)
        .neq("id", asset.id);
      if (clearErr) {
        toast({ title: "Erro ao atualizar logo", variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase
      .from("user_gallery_assets")
      .update({ is_logo: next })
      .eq("id", asset.id);
    if (error) {
      toast({ title: "Erro ao atualizar logo", variant: "destructive" });
      return;
    }
    setUserAssets(prev => prev.map(a =>
      a.id === asset.id
        ? { ...a, is_logo: next }
        : (next ? { ...a, is_logo: false } : a)
    ));
    // Marcar/desmarcar como logo invalida o cache de sessão
    if (user) clearLogoCache(user.id);
    toast({ title: next ? "Marcada como logo ativa" : "Não é mais logo" });
  };

  // Remove fundo de uma imagem da galeria do usuário (útil para logos antigas)
  const handleRemoveBgFromAsset = async (asset: UserAsset) => {
    if (removingBgId) return;
    setRemovingBgId(asset.id);
    try {
      const resp = await fetch(asset.url);
      const blob = await resp.blob();
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
      const compressed = await compressImage(dataUrl, 1024, 0.85);
      const { data, error } = await supabase.functions.invoke("remove-background", {
        body: { imageUrl: compressed },
      });
      if (error || !data?.image || !data.image.startsWith("data:image/")) {
        throw new Error("Não foi possível remover o fundo desta imagem.");
      }
      // SEMPRE passa pelo chroma key — a edge function devolve PNG com fundo verde puro.
      // Sem essa etapa, o "fundo verde" persistia até no storage.
      const transparentImage = await chromaKeyAndValidate(data.image);
      if (!transparentImage) {
        throw new Error("Não foi possível obter transparência real. Tente uma imagem com fundo mais uniforme.");
      }
      const newBlob = await (await fetch(transparentImage)).blob();
      const newPath = asset.file_path.replace(/\.[^.]+$/, "") + ".png";
      const { error: upErr } = await supabase.storage
        .from("user-uploads")
        .upload(newPath, newBlob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      await supabase
        .from("user_gallery_assets")
        .update({ file_path: newPath, bg_removed: true })
        .eq("id", asset.id);
      // Remove arquivo antigo se a extensão mudou
      if (newPath !== asset.file_path) {
        await supabase.storage.from("user-uploads").remove([asset.file_path]).catch(() => {});
      }
      const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(newPath, 60 * 60);
      setUserAssets(prev => prev.map(a => a.id === asset.id ? { ...a, file_path: newPath, url: signed?.signedUrl || a.url } : a));
      // Invalida cache da logo para forçar recarga em próxima montagem automática
      if (user) clearLogoCache(user.id);
      toast({ title: "Fundo removido com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao remover fundo", description: err?.message, variant: "destructive" });
    } finally {
      setRemovingBgId(null);
    }
  };

  // Step 1: pick file → open modal asking if it's a logo
  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Imagem muito grande (máx 10MB)", variant: "destructive" });
        return;
      }
      try {
        const reader = new FileReader();
        const dataUrl: string = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(file);
        });
        const compressed = await compressImage(dataUrl, 1600, 0.85);
        const blob = await (await fetch(compressed)).blob();
        setPendingUpload({ blob, name: file.name, isLogo: false });
      } catch (err: any) {
        toast({ title: "Erro ao processar imagem", description: err.message, variant: "destructive" });
      }
    };
    input.click();
  };

  // Step 2: confirm upload (with isLogo decision). Logos pass through remove-background.
  const confirmUpload = async () => {
    if (!pendingUpload || !user) return;
    setUploading(true);
    const { blob, name, isLogo } = pendingUpload;
    try {
      let finalBlob = blob;
      let finalContentType = "image/jpeg";
      let finalExt = "jpg";

      // Para logos, remover o fundo automaticamente antes de salvar
      if (isLogo) {
        try {
          const dataUrl: string = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(blob);
          });
          const compressedForRB = await compressImage(dataUrl, 1024, 0.85);
          const { data: rbData, error: rbErr } = await supabase.functions.invoke("remove-background", {
            body: { imageUrl: compressedForRB },
          });
          if (!rbErr && rbData?.image && typeof rbData.image === "string" && rbData.image.startsWith("data:image/")) {
            // SEMPRE passa pelo chroma key — sem isso, fundo verde seria salvo no storage.
            const transparent = await chromaKeyAndValidate(rbData.image);
            if (transparent) {
              const resp = await fetch(transparent);
              finalBlob = await resp.blob();
              finalContentType = "image/png";
              finalExt = "png";
            } else {
              console.warn("chroma key não produziu transparência válida; salvando logo original");
            }
          } else {
            console.warn("remove-background indisponível, salvando logo com fundo original");
          }
        } catch (rbErr) {
          console.warn("Falha ao remover fundo da logo, salvando original", rbErr);
        }
      }

      const id = crypto.randomUUID();
      const path = `${user.id}/${id}.${finalExt}`;
      const { error: upErr } = await supabase.storage.from("user-uploads").upload(path, finalBlob, { contentType: finalContentType, upsert: false });
      if (upErr) throw upErr;
      // Se for logo, desmarca outras logos antes de inserir esta como ativa
      if (isLogo) {
        await supabase
          .from("user_gallery_assets")
          .update({ is_logo: false })
          .eq("user_id", user.id);
      }
      const { error: insErr } = await supabase.from("user_gallery_assets").insert({
        user_id: user.id,
        name,
        file_path: path,
        is_logo: isLogo,
        bg_removed: isLogo && finalContentType === "image/png",
      });
      if (insErr) throw insErr;
      const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(path, 60 * 60);
      const url = signed?.signedUrl || "";
      const img: OverlayImage = {
        id: crypto.randomUUID(), src: url,
        x: 200, y: 200, width: 400, height: 400,
        type: isLogo ? "logo" : "photo",
        opacity: 1,
      };
      onAddImage(img);
      // Sempre que uma logo é criada/atualizada, invalida o cache de sessão
      if (isLogo && user) clearLogoCache(user.id);
      loadUserAssets();
      toast({ title: isLogo ? "Logo salva (fundo removido)" : "Imagem salva na sua galeria" });
      setPendingUpload(null);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleAddTextBox = () => {
    onAddImage({
      id: crypto.randomUUID(), src: "",
      x: 200, y: 400, width: 600, height: 80, type: "textbox", opacity: 1,
      text: "Novo texto", textColor: textColor || "#ffffff", bgColor: "transparent",
      fontSize: 24, fontFamily: bodyFont,
    });
  };

  const handleAddIcon = (el: typeof GRAPHIC_ELEMENTS[0]) => {
    onAddImage({
      id: crypto.randomUUID(), src: iconToDataUrl(el.icon, elementColor),
      x: 460, y: 460, width: 160, height: 160, type: "element", opacity: 1,
    });
  };

  const handleAddSvg = (el: typeof SVG_ELEMENTS[0]) => {
    const wMatch = el.svg.match(/width="(\d+)"/);
    const hMatch = el.svg.match(/height="(\d+)"/);
    const w = wMatch ? parseInt(wMatch[1]) : 400;
    const h = hMatch ? parseInt(hMatch[1]) : 400;

    // Molduras: ajustar automaticamente ao formato do canvas (4:5 ou Reels 9:16)
    const isFrame = /^moldura/i.test(el.name);
    if (isFrame) {
      // Canvas: square=1080x1350 (4:5), reels=1080x1920
      const cW = 1080;
      const cH = canvasFormat === "reels" ? 1920 : 1350;
      const margin = canvasFormat === "reels" ? 80 : 60;
      onAddImage({
        id: crypto.randomUUID(), src: svgToDataUrl(el.svg, elementColor),
        x: margin, y: margin,
        width: cW - margin * 2,
        height: cH - margin * 2,
        type: "element", opacity: 1,
      });
      return;
    }

    onAddImage({
      id: crypto.randomUUID(), src: svgToDataUrl(el.svg, elementColor),
      x: 340, y: 460, width: w * 0.8, height: h * 0.8, type: "element", opacity: 1,
    });
  };

  const handleAddImageFromUrl = (url: string) => {
    onAddImage({
      id: crypto.randomUUID(), src: url,
      x: 200, y: 200, width: 400, height: 400, type: "photo", opacity: 1,
    });
  };

  const handleDeleteUserAsset = async (asset: UserAsset) => {
    try {
      await supabase.storage.from("user-uploads").remove([asset.file_path]);
      await supabase.from("user_gallery_assets").delete().eq("id", asset.id);
      setUserAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast({ title: "Imagem removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Tabs defaultValue="bgimages" className="w-full">
      <TabsList className="grid grid-cols-6 h-8 p-0.5">
        <TabsTrigger value="bgimages" className="text-[10px] h-7 px-1" title="Banco de imagens (Pexels + IA)"><Search className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="upload" className="text-[10px] h-7 px-1" title="Upload"><ImagePlus className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="gallery" className="text-[10px] h-7 px-1" title="Minha galeria"><ImageIcon className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="portraits" className="text-[10px] h-7 px-1" title="Retratos"><Camera className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="icons" className="text-[10px] h-7 px-1" title="Ícones"><Shapes className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="frames" className="text-[10px] h-7 px-1" title="Molduras"><Minus className="h-3.5 w-3.5" /></TabsTrigger>
      </TabsList>

      {/* Banco de imagens (Pexels + IA) */}
      <TabsContent value="bgimages" className="mt-3">
        <p className="text-[10px] text-muted-foreground/80 mb-2 leading-relaxed">
          Pesquise no Pexels ou gere uma imagem por IA. Ao escolher, ela substitui o fundo do card.
        </p>
        <ImageGalleryPanel
          defaultQuery={imageSearchQuery}
          format={canvasFormat === "reels" ? "portrait" : "square"}
          onAIGenerated={onAIGenerated}
          regenerationCredits={regenerationCredits}
          niche={niche}
          businessContext={businessContext}
          caption={caption}
          postBody={postBody}
          onPickImage={(url, photographer, source) => {
            if (photographer) onPexelsPick?.(photographer);
            if (onSwapBackground) {
              onSwapBackground(url, source);
            } else {
              handleAddImageFromUrl(url);
            }
          }}
        />
      </TabsContent>

      {/* Upload + text box */}
      <TabsContent value="upload" className="mt-3 space-y-2">
        <Button variant="outline" size="sm" className="gap-2 w-full h-8 text-xs" onClick={handleFileUpload} disabled={uploading}>
          {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…</> : <><ImagePlus className="h-3.5 w-3.5" /> Enviar imagem</>}
        </Button>
        <Button variant="outline" size="sm" className="gap-2 w-full h-8 text-xs" onClick={handleAddTextBox}>
          <PlusSquare className="h-3.5 w-3.5" /> Caixa de texto
        </Button>
        <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-1">As imagens enviadas ficam salvas na sua galeria.</p>
      </TabsContent>

      {/* Gallery */}
      <TabsContent value="gallery" className="mt-3 space-y-3">
        {/* User images */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Minhas imagens</p>
          {!userAssetsLoaded ? (
            <p className="text-[11px] text-muted-foreground">Carregando…</p>
          ) : userAssets.length === 0 ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">Suas imagens IA, Pexels e uploads aparecem aqui automaticamente quando usadas em posts.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {userAssets.map((a) => (
                <div key={a.id} className="relative group aspect-square rounded-md border overflow-hidden bg-muted/40">
                  <button onClick={() => handleAddImageFromUrl(a.url)} className="absolute inset-0">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                  {a.is_logo && (
                    <Badge className="absolute top-1 left-1 px-1.5 py-0 text-[9px] h-4 leading-none">Logo</Badge>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLogo(a); }}
                    className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border text-[9px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
                    title={a.is_logo ? "Desmarcar como logo" : "Marcar como logo"}
                  >
                    {a.is_logo ? "✓ Logo" : "Marcar logo"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveBgFromAsset(a); }}
                    disabled={removingBgId === a.id}
                    className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border text-[9px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    title="Remover fundo (útil para logos antigas)"
                  >
                    {removingBgId === a.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Sem fundo"}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-1 right-1 p-1 rounded-full bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação remove a imagem da sua galeria. Designs já salvos com essa imagem continuam intactos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUserAsset(a)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Portraits */}
      <TabsContent value="portraits" className="mt-3">
        {userPortraits.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhum retrato gerado ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {userPortraits.map((url, i) => (
              <button key={i} onClick={() => handleAddImageFromUrl(url)} className="aspect-square rounded-md border bg-muted/40 hover:bg-muted transition-colors overflow-hidden">
                <img src={url} alt={`Retrato ${i + 1}`} className="w-full h-full object-cover" crossOrigin="anonymous" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Icons */}
      <TabsContent value="icons" className="mt-3 space-y-2">
        <div>
          <label className="text-[11px] text-muted-foreground">
            {hasSelectedElement ? "Cor do elemento selecionado" : "Cor padrão para novos elementos"}
          </label>
          <ColorPicker
            palette={palette}
            value={hasSelectedElement ? undefined : elementColor}
            onChange={(c) => {
              if (hasSelectedElement && onRecolorSelected) {
                onRecolorSelected(c);
              } else {
                setElementColor(c);
              }
            }}
          />
        </div>
        <div className="grid grid-cols-6 gap-1">
          {GRAPHIC_ELEMENTS.map((el) => (
            <Tooltip key={el.name}>
              <TooltipTrigger asChild>
                <button onClick={() => handleAddIcon(el)} className="aspect-square flex items-center justify-center rounded-md border bg-muted/40 hover:bg-muted transition-colors">
                  <el.icon className="h-3.5 w-3.5 text-foreground/70" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{el.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TabsContent>

      {/* Frames / dividers */}
      <TabsContent value="frames" className="mt-3 space-y-2">
        <div>
          <label className="text-[11px] text-muted-foreground">
            {hasSelectedElement ? "Cor do elemento selecionado" : "Cor padrão para novos elementos"}
          </label>
          <ColorPicker
            palette={palette}
            value={hasSelectedElement ? undefined : elementColor}
            onChange={(c) => {
              if (hasSelectedElement && onRecolorSelected) {
                onRecolorSelected(c);
              } else {
                setElementColor(c);
              }
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SVG_ELEMENTS.map((el) => (
            <button key={el.name} onClick={() => handleAddSvg(el)} className="py-2 px-2 flex items-center justify-center rounded-md border bg-muted/40 hover:bg-muted transition-colors text-[10px] text-muted-foreground">
              {el.name}
            </button>
          ))}
        </div>
      </TabsContent>

      {/* Modal: confirmar se a imagem é uma logo */}
      <Dialog open={!!pendingUpload} onOpenChange={(open) => { if (!open) setPendingUpload(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Antes de enviar</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Checkbox
              id="is-logo-checkbox"
              checked={pendingUpload?.isLogo ?? false}
              onCheckedChange={(v) => setPendingUpload(prev => prev ? { ...prev, isLogo: !!v } : prev)}
            />
            <Label htmlFor="is-logo-checkbox" className="text-sm cursor-pointer">
              Esta imagem é minha logo
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Logos ficam disponíveis para serem inseridas automaticamente nos templates de posts.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingUpload(null)} disabled={uploading}>
              Cancelar
            </Button>
            <Button size="sm" onClick={confirmUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…</> : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};

export default AddElementPanel;
