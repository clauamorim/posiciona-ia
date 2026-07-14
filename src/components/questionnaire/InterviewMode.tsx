import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageBubble } from "@/components/assistant/MessageBubble";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Mic, Square, Send, Loader2, CheckCircle2, ClipboardCheck } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; extractedLabels?: string[] };

interface Props {
  kind: "personal" | "business";
  intro: string;
  fields: { key: string; label: string }[];
  answers: Record<string, string>;
  profession?: string;
  niche?: string;
  onExtract: (extracted: Record<string, string>) => void;
  onFinish: () => void;
}

const MAX_RECORDING_SECONDS = 180;

function pickMimeType(): string {
  // Chrome/Android gravam webm; Safari (iPhone) grava mp4. Ambos aceitos pelo Gemini.
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function InterviewMode({ kind, intro, fields, answers, profession, niche, onExtract, onFinish }: Props) {
  const firstPending = useMemo(
    () => fields.find(f => !(answers[f.key] || "").trim()),
    // Congela a primeira pergunta na montagem; as seguintes vêm da IA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      role: "assistant",
      content: firstPending
        ? `${intro} Responda falando — toque no microfone — ou digitando. Se preferir não responder algo, diga "pular".\n\nPara começar: ${firstPending.label.toLowerCase()}?`
        : "Todas as perguntas já foram respondidas. Toque em Revisar respostas para conferir e concluir.",
    },
  ]);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [finished, setFinished] = useState(!firstPending);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Snapshot das respostas para o backend saber o que ainda falta.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const filledCount = fields.filter(f => (answers[f.key] || "").trim()).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach(t => t.stop());
  }, []);

  const sendTurn = async (payload: { userText?: string; audio?: { data: string; mimeType: string } }) => {
    setSending(true);
    // Otimista: mostra o turno do usuário imediatamente (áudio vira transcript depois).
    const placeholder = payload.userText ?? "🎙️ (transcrevendo áudio...)";
    setMessages(prev => [...prev, { role: "user", content: placeholder }]);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("questionnaire-interview", {
        body: { kind, history, ...payload, answers: answersRef.current, profession, niche },
      });
      if (error) throw new Error(error.message || "Falha na conexão");
      if (data?.error) throw new Error(data.error);

      const extracted: Record<string, string> = data?.extracted || {};
      const extractedLabels = Object.keys(extracted)
        .map(k => fields.find(f => f.key === k)?.label)
        .filter(Boolean) as string[];

      setMessages(prev => {
        const next = [...prev];
        // Substitui o placeholder pelo transcript real (vazio = nada foi ouvido).
        const transcript = payload.userText ?? (data?.transcript || "🎙️ (áudio sem fala detectada)");
        next[next.length - 1] = { role: "user", content: transcript };
        next.push({ role: "assistant", content: data?.reply || "", extractedLabels });
        return next;
      });

      if (Object.keys(extracted).length > 0) onExtract(extracted);
      if (data?.finished) setFinished(true);
    } catch (e: any) {
      // Remove o placeholder para o usuário poder tentar de novo.
      setMessages(prev => prev.slice(0, -1));
      toast({
        title: "Não consegui processar sua resposta",
        description: e?.message || "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendText = async () => {
    const text = textInput.trim();
    if (!text || sending) return;
    setTextInput("");
    await sendTurn({ userText: text });
  };

  const startRecording = async () => {
    if (sending || recording) return;
    const mimeType = pickMimeType();
    if (!mimeType) {
      toast({ title: "Gravação não suportada neste navegador", description: "Use o campo de texto abaixo.", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // toque acidental, nada gravado
        const base64 = await blobToBase64(blob);
        await sendTurn({ audio: { data: base64, mimeType } });
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) stopRecording();
      }, 1000);
    } catch {
      toast({
        title: "Microfone indisponível",
        description: "Permita o acesso ao microfone nas configurações do navegador, ou responda digitando.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Card className="border-primary/10">
      <CardContent className="p-0">
        {/* Progresso + revisar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <p className="text-xs text-muted-foreground">
            {filledCount}/{fields.length} respostas registradas
          </p>
          <Button
            variant={finished ? "default" : "ghost"}
            size="sm"
            onClick={onFinish}
            className="gap-1.5 text-xs"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Revisar respostas
          </Button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="h-[420px] overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="space-y-1.5">
              <MessageBubble role={m.role} content={m.content} />
              {m.extractedLabels && m.extractedLabels.length > 0 && (
                <div className="flex items-start gap-1.5 pl-1">
                  <CheckCircle2 className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Registrado: {m.extractedLabels.map(l => l.split("(")[0].trim()).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs pl-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processando…
            </div>
          )}
        </div>

        {/* Entrada */}
        <div className="border-t border-border/40 p-3 space-y-2">
          {finished ? (
            // Ao terminar, o botão de revisão assume o lugar do microfone —
            // no celular é o que está sob o polegar; o do topo some da vista.
            <>
              <Button onClick={onFinish} className="w-full gap-2 h-12">
                <ClipboardCheck className="h-4 w-4" />
                Revisar respostas e concluir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFinished(false)}
                className="w-full text-muted-foreground text-xs"
              >
                Continuar conversando
              </Button>
            </>
          ) : recording ? (
            <Button onClick={stopRecording} variant="destructive" className="w-full gap-2 h-12">
              <Square className="h-4 w-4" />
              Parar e enviar · {fmtTime(recordSeconds)}
            </Button>
          ) : (
            <Button onClick={startRecording} disabled={sending} className="w-full gap-2 h-12">
              <Mic className="h-4 w-4" />
              Tocar para responder falando
            </Button>
          )}
          {!finished && (
            <div className="flex gap-2">
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                placeholder="Ou digite sua resposta…"
                disabled={sending || recording}
                className="text-sm"
              />
              <Button size="icon" variant="outline" onClick={handleSendText} disabled={sending || recording || !textInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
