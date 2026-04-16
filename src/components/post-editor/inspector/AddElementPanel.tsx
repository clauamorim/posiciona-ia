import React, { useState, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImagePlus, PlusSquare, Type as TypeIcon, Shapes, Minus, Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import {
  Star, Heart, CheckCircle, Quote, ArrowRight, ArrowUp as ArrowUpIcon, Zap, Award,
  Circle, Square as SquareIcon, Triangle, Hexagon, Diamond, Flame, Target, Crown,
  ThumbsUp, Bookmark, Send, AtSign, Hash, MapPin, Clock, Eye,
  Lightbulb, Gift, Camera as CameraIcon, Coffee, Smile, Bell, Flag, Shield, Layers,
  Feather, Music, Pen, Globe, Sparkles, Lock, Unlock, Settings,
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
import type { OverlayImage } from "../PostToolbar";

const GRAPHIC_ELEMENTS = [
  { icon: Star, name: "Estrela" }, { icon: Heart, name: "Coração" },
  { icon: CheckCircle, name: "Check" }, { icon: Quote, name: "Aspas" },
  { icon: ArrowRight, name: "Seta direita" }, { icon: ArrowUpIcon, name: "Seta cima" },
  { icon: Zap, name: "Raio" }, { icon: Award, name: "Prêmio" },
  { icon: Circle, name: "Círculo" }, { icon: SquareIcon, name: "Quadrado" },
  { icon: Triangle, name: "Triângulo" }, { icon: Hexagon, name: "Hexágono" },
  { icon: Diamond, name: "Diamante" }, { icon: Flame, name: "Chama" },
  { icon: Target, name: "Alvo" }, { icon: Crown, name: "Coroa" },
  { icon: ThumbsUp, name: "Curtir" }, { icon: Bookmark, name: "Salvar" },
  { icon: Send, name: "Enviar" }, { icon: AtSign, name: "Arroba" },
  { icon: Hash, name: "Hashtag" }, { icon: MapPin, name: "Local" },
  { icon: Clock, name: "Relógio" }, { icon: Eye, name: "Olho" },
  { icon: Lightbulb, name: "Lâmpada" }, { icon: Gift, name: "Presente" },
  { icon: CameraIcon, name: "Câmera" }, { icon: Coffee, name: "Café" },
  { icon: Smile, name: "Sorriso" }, { icon: Bell, name: "Sino" },
  { icon: Flag, name: "Bandeira" }, { icon: Shield, name: "Escudo" },
  { icon: Layers, name: "Camadas" }, { icon: Feather, name: "Pena" },
  { icon: Music, name: "Música" }, { icon: Pen, name: "Caneta" },
  { icon: Globe, name: "Globo" }, { icon: Sparkles, name: "Brilho" },
  { icon: Lock, name: "Cadeado" }, { icon: Unlock, name: "Desbloq." },
  { icon: Settings, name: "Config." },
];

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
}

interface AddElementPanelProps {
  palette: PaletteColor[];
  defaultElementColor?: string;
  bodyFont: string;
  textColor?: string;
  userPortraits?: string[];
  onAddImage: (image: OverlayImage) => void;
  onPortraitsChanged?: () => void;
}

const AddElementPanel: React.FC<AddElementPanelProps> = ({
  palette, defaultElementColor, bodyFont, textColor, userPortraits = [], onAddImage, onPortraitsChanged,
}) => {
  const { user } = useAuth();
  const [elementColor, setElementColor] = useState(defaultElementColor || palette[0]?.hex || "#7c3aed");
  const [galleryAssets, setGalleryAssets] = useState<{ id: string; name: string; file_path: string; url: string }[]>([]);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [userAssetsLoaded, setUserAssetsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load Posiciona gallery (admin)
  useEffect(() => {
    if (galleryLoaded) return;
    supabase.from("gallery_assets").select("id, name, file_path").eq("is_active", true).order("created_at", { ascending: false }).then(({ data }) => {
      const assets = (data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        file_path: a.file_path,
        url: supabase.storage.from("asset-gallery").getPublicUrl(a.file_path).data.publicUrl,
      }));
      setGalleryAssets(assets);
      setGalleryLoaded(true);
    });
  }, [galleryLoaded]);

  // Load user gallery
  const loadUserAssets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_gallery_assets")
      .select("id, name, file_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!data) { setUserAssets([]); setUserAssetsLoaded(true); return; }
    const assets = await Promise.all(data.map(async (a: any) => {
      const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(a.file_path, 60 * 60);
      return { id: a.id, name: a.name, file_path: a.file_path, url: signed?.signedUrl || "" };
    }));
    setUserAssets(assets.filter(a => a.url));
    setUserAssetsLoaded(true);
  };

  useEffect(() => { if (user && !userAssetsLoaded) loadUserAssets(); }, [user, userAssetsLoaded]);

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
      setUploading(true);
      try {
        // Read file → compress → upload
        const reader = new FileReader();
        const dataUrl: string = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(file);
        });
        const compressed = await compressImage(dataUrl, 1600, 0.85);
        // Convert to blob
        const blob = await (await fetch(compressed)).blob();
        const ext = "jpg";
        const id = crypto.randomUUID();
        const path = `${user.id}/${id}.${ext}`;
        const { error: upErr } = await supabase.storage.from("user-uploads").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("user_gallery_assets").insert({
          user_id: user.id,
          name: file.name,
          file_path: path,
        });
        if (insErr) throw insErr;
        const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(path, 60 * 60);
        const url = signed?.signedUrl || compressed;
        // Add to canvas
        const img: OverlayImage = {
          id: crypto.randomUUID(), src: url,
          x: 200, y: 200, width: 400, height: 400, type: "photo", opacity: 1,
        };
        onAddImage(img);
        // Refresh gallery
        loadUserAssets();
        toast({ title: "Imagem salva na sua galeria" });
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    };
    input.click();
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
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid grid-cols-5 h-8 p-0.5">
        <TabsTrigger value="upload" className="text-[10px] h-7 px-1"><ImagePlus className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="gallery" className="text-[10px] h-7 px-1"><ImageIcon className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="portraits" className="text-[10px] h-7 px-1"><Camera className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="icons" className="text-[10px] h-7 px-1"><Shapes className="h-3.5 w-3.5" /></TabsTrigger>
        <TabsTrigger value="frames" className="text-[10px] h-7 px-1"><Minus className="h-3.5 w-3.5" /></TabsTrigger>
      </TabsList>

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
            <p className="text-[11px] text-muted-foreground">Nenhuma imagem salva.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {userAssets.map((a) => (
                <div key={a.id} className="relative group aspect-square rounded-md border overflow-hidden bg-muted/40">
                  <button onClick={() => handleAddImageFromUrl(a.url)} className="absolute inset-0">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" loading="lazy" />
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
        {/* Posiciona gallery */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Galeria Posiciona</p>
          {!galleryLoaded ? (
            <p className="text-[11px] text-muted-foreground">Carregando…</p>
          ) : galleryAssets.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhuma imagem disponível.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {galleryAssets.map((a) => (
                <Tooltip key={a.id}>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleAddImageFromUrl(a.url)} className="aspect-square rounded-md border bg-muted/40 hover:bg-muted transition-colors overflow-hidden">
                      <img src={a.url} alt={a.name} className="w-full h-full object-contain" loading="lazy" crossOrigin="anonymous" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{a.name}</TooltipContent>
                </Tooltip>
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
          <label className="text-[11px] text-muted-foreground">Cor padrão</label>
          <ColorPicker palette={palette} value={elementColor} onChange={setElementColor} />
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
          <label className="text-[11px] text-muted-foreground">Cor padrão</label>
          <ColorPicker palette={palette} value={elementColor} onChange={setElementColor} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SVG_ELEMENTS.map((el) => (
            <button key={el.name} onClick={() => handleAddSvg(el)} className="py-2 px-2 flex items-center justify-center rounded-md border bg-muted/40 hover:bg-muted transition-colors text-[10px] text-muted-foreground">
              {el.name}
            </button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default AddElementPanel;
