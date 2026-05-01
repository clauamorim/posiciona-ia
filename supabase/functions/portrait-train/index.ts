import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Provider: Fal.ai
// Trainer: fal-ai/flux-lora-portrait-trainer (otimizado para rosto humano —
// brilho de olho, semelhança facial, detalhe fino). Treina LoRA FLUX.1 [dev]
// compatível com o endpoint de inferência fal-ai/flux-krea-lora.
const FAL_TRAINER_PATH = "fal-ai/flux-lora-portrait-trainer";
const TRAIN_COST_CREDITS = 4;

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("invalid data URL");
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

// Minimal ZIP builder (store-only, no compression). Sufficient for ~10–20 small JPEGs.
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    return (c ^ 0xffffffff) >>> 0;
  };

  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const lfh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);

    localParts.push(lfh, f.data);

    const cdh = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cdh.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);

    centralParts.push(cdh);
    offset += lfh.length + size;
    centralSize += cdh.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of localParts) {
    out.set(part, p);
    p += part.length;
  }
  for (const part of centralParts) {
    out.set(part, p);
    p += part.length;
  }
  out.set(eocd, p);
  return out;
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

interface PhysicalTraits {
  gender: "woman" | "man";
  hair_color: string;
  hair_length: string;
  hair_style: string;
  skin_tone: string;
  eye_color: string;
  apparent_age_range: "20s" | "30s" | "40s" | "50s" | "60s+";
  hair_has_grey: boolean;
}

async function extractPhysicalTraits(
  selfies: string[],
  apiKey: string,
): Promise<PhysicalTraits | null> {
  try {
    const sample: string[] = [];
    const step = Math.max(1, Math.floor(selfies.length / 3));
    for (let i = 0; i < selfies.length && sample.length < 3; i += step) {
      sample.push(selfies[i]);
    }

    const content: any[] = [
      {
        type: "text",
        text:
          "Analise as fotos da MESMA pessoa e devolva APENAS um JSON com as características físicas observadas. " +
          "Para 'apparent_age_range', escolha a faixa etária aparente da pessoa (não chute pra mais velha — se hesitar entre duas, escolha a mais jovem). " +
          "Para 'hair_has_grey', marque true APENAS se houver fios brancos visíveis MAS o cabelo NÃO for predominantemente grisalho. " +
          "Se o cabelo for majoritariamente grisalho/branco, defina hair_color = 'grey' (ou 'white') e hair_has_grey = false. " +
          "Não inclua texto fora do JSON. Schema:\n" +
          `{
  "gender": "woman" | "man",
  "hair_color": "brown | dark brown | blonde | dark blonde | black | red | auburn | grey | white",
  "hair_length": "short | medium | long | very long",
  "hair_style": "straight | wavy | curly | coily",
  "skin_tone": "fair | light | medium | olive | tan | brown | dark brown | deep",
  "eye_color": "brown | dark brown | hazel | green | blue | grey",
  "apparent_age_range": "20s | 30s | 40s | 50s | 60s+",
  "hair_has_grey": true | false
}`,
      },
      ...sample.map((dataUrl) => ({ type: "image_url", image_url: { url: dataUrl } })),
    ];

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`[portrait-train] traits extraction failed status=${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.gender !== "woman" && parsed.gender !== "man") return null;
    // Validação leve dos campos novos — se vier inválido, aplica defaults seguros
    const validAges = ["20s", "30s", "40s", "50s", "60s+"];
    if (!validAges.includes(parsed.apparent_age_range)) {
      parsed.apparent_age_range = "30s";
    }
    if (typeof parsed.hair_has_grey !== "boolean") {
      parsed.hair_has_grey = false;
    }
    return parsed as PhysicalTraits;
  } catch (e) {
    console.warn(`[portrait-train] traits extraction exception: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FAL_KEY = Deno.env.get("FAL_KEY");
    const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    if (!FAL_KEY || !WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const selfies: string[] = Array.isArray(body.selfies) ? body.selfies : [];
    if (selfies.length < 10 || selfies.length > 20) {
      return new Response(JSON.stringify({ error: "Envie de 10 a 20 selfies" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Free monthly check (active monthly subscription)
    const [subRes, lastFreeRes, balanceRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("status, current_period_end, plans:plan_id(billing_type)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("portrait_trainings")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("was_free", true)
        .gte("created_at", startOfMonthISO())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("user_balances")
        .select("portrait_credits_included, portrait_credits_extra")
        .eq("user_id", user.id)
        .single(),
    ]);

    const sub = subRes.data as any;
    const isMonthly = sub?.status === "active" && sub?.plans?.billing_type === "monthly";
    const alreadyUsedFreeThisMonth = !!lastFreeRes.data;
    // Migração legacy: se o último treino READY do usuário é Replicate, oferecer
    // um retreino GRATUITO (não consome o slot do mês nem créditos) — chamador
    // deve passar { migrate_legacy: true }.
    const migrateLegacy = body.migrate_legacy === true;
    let canUseFree = isMonthly && !alreadyUsedFreeThisMonth && !body.force_paid;

    if (migrateLegacy) {
      const { data: lastReady } = await supabaseAdmin
        .from("portrait_trainings")
        .select("id, lora_provider")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastReady && (lastReady as any).lora_provider === "replicate") {
        canUseFree = true; // migração é sempre grátis
      }
    }

    const included = balanceRes.data?.portrait_credits_included ?? 0;
    const extra = balanceRes.data?.portrait_credits_extra ?? 0;
    const totalCredits = included + extra;

    if (!canUseFree && totalCredits < TRAIN_COST_CREDITS) {
      return new Response(
        JSON.stringify({
          error: `Treino extra requer ${TRAIN_COST_CREDITS} créditos de retrato. Você tem ${totalCredits}.`,
          needs_credits: true,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Block concurrent trainings
    const { data: ongoing } = await supabaseAdmin
      .from("portrait_trainings")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "training")
      .limit(1);
    if (ongoing && ongoing.length > 0) {
      return new Response(JSON.stringify({ error: "Você já tem um treino em andamento.", training_id: ongoing[0].id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let physicalTraits: PhysicalTraits | null = null;
    if (LOVABLE_API_KEY) {
      physicalTraits = await extractPhysicalTraits(selfies, LOVABLE_API_KEY);
      if (physicalTraits) {
        console.log(`[portrait-train] traits extracted: ${JSON.stringify(physicalTraits)}`);
      } else {
        console.warn(`[portrait-train] traits extraction returned null — falling back to autocaption`);
      }
    } else {
      console.warn(`[portrait-train] LOVABLE_API_KEY not set — skipping traits extraction`);
    }

    const triggerWord = `USR${user.id.replace(/-/g, "").slice(0, 12)}`;
    const { data: training, error: trainErr } = await supabaseAdmin
      .from("portrait_trainings")
      .insert({
        user_id: user.id,
        trigger_word: triggerWord,
        status: "training",
        selfies_count: selfies.length,
        was_free: canUseFree,
        physical_traits: physicalTraits,
        lora_provider: "fal",
      })
      .select("id")
      .single();

    if (trainErr || !training) {
      console.error("[portrait-train] insert error", trainErr);
      return new Response(JSON.stringify({ error: "Falha ao criar registro de treino" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ZIP in memory
    const files = selfies.map((dataUrl, idx) => {
      const { bytes, mime } = dataUrlToBytes(dataUrl);
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      return { name: `selfie_${String(idx + 1).padStart(2, "0")}.${ext}`, data: bytes };
    });
    const zipBytes = buildZip(files);

    const zipPath = `${user.id}/${training.id}/selfies.zip`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("portrait-inputs")
      .upload(zipPath, zipBytes, { contentType: "application/zip", upsert: true });
    if (upErr) {
      console.error("[portrait-train] upload error", upErr);
      await supabaseAdmin.from("portrait_trainings").update({ status: "failed", error_message: `upload-failed: ${upErr.message}` }).eq("id", training.id);
      return new Response(JSON.stringify({ error: "Falha ao enviar selfies" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Signed URL valid for 24h
    const { data: signed } = await supabaseAdmin.storage
      .from("portrait-inputs")
      .createSignedUrl(zipPath, 60 * 60 * 24);
    const zipUrl = signed?.signedUrl;
    if (!zipUrl) {
      await supabaseAdmin.from("portrait_trainings").update({ status: "failed", error_message: "no-signed-url" }).eq("id", training.id);
      return new Response(JSON.stringify({ error: "Falha ao gerar URL assinada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Webhook URL (HMAC token assinado)
    const token = await hmacHex(WEBHOOK_SECRET, training.id);
    const webhookUrl = `${SUPABASE_URL}/functions/v1/portrait-webhook?training_id=${training.id}&token=${token}`;

    // Trigger phrase: o trainer da Fal já injeta isso no caption; manda explicit
    // pra ancorar identidade. Usamos o triggerWord como identificador único.
    let triggerPhrase = triggerWord;
    if (physicalTraits) {
      const t = physicalTraits;
      triggerPhrase = `${triggerWord} ${t.gender}`;
    }

    const trainBody: Record<string, unknown> = {
      images_data_url: zipUrl,
      trigger_phrase: triggerPhrase,
      // 1000 steps é o default e o sweet spot do trainer Fal pra portrait.
      steps: 1000,
      // Subject crop ON: o trainer detecta o rosto e corta — ideal pra identidade.
      subject_crop: true,
      // Caption automático focado em rosto (default true do portrait trainer).
      create_masks: true,
    };

    console.log(`[portrait-train] starting training=${training.id} trigger="${triggerPhrase}" provider=fal endpoint=${FAL_TRAINER_PATH}`);

    // Fal queue API. O webhook é entregue via query param `fal_webhook` (forma
    // documentada e suportada pela Fal — header é silenciosamente ignorado).
    // Protegido pelo HMAC token embutido na própria URL do webhook.
    const submitUrl =
      `https://queue.fal.run/${FAL_TRAINER_PATH}?fal_webhook=${encodeURIComponent(webhookUrl)}`;
    const trainRes = await fetch(submitUrl, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(trainBody),
    });

    if (!trainRes.ok) {
      const txt = await trainRes.text();
      console.error("[portrait-train] start failed", trainRes.status, txt);
      await supabaseAdmin
        .from("portrait_trainings")
        .update({ status: "failed", error_message: `start-${trainRes.status}: ${txt.slice(0, 200)}` })
        .eq("id", training.id);
      return new Response(JSON.stringify({ error: "Falha ao iniciar treino na Fal.ai" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trainJson = await trainRes.json();
    // Fal queue retorna { request_id, status, response_url, status_url, cancel_url }.
    const falRequestId = trainJson.request_id;

    await supabaseAdmin
      .from("portrait_trainings")
      .update({ replicate_training_id: falRequestId }) // coluna mantida — só é "external request id"
      .eq("id", training.id);

    if (!canUseFree) {
      const newIncluded = Math.max(0, included - Math.min(included, TRAIN_COST_CREDITS));
      const remainingToTake = TRAIN_COST_CREDITS - (included - newIncluded);
      const newExtra = Math.max(0, extra - remainingToTake);
      await supabaseAdmin
        .from("user_balances")
        .update({ portrait_credits_included: newIncluded, portrait_credits_extra: newExtra })
        .eq("user_id", user.id);
      await supabaseAdmin.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "portrait",
        amount: -TRAIN_COST_CREDITS,
        description: `Treino de Estúdio Pessoal (LoRA ${triggerWord})`,
      });
    } else {
      await supabaseAdmin.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "portrait",
        amount: 0,
        description: migrateLegacy
          ? `Migração gratuita de Estúdio Pessoal (LoRA ${triggerWord})`
          : `Treino mensal grátis (LoRA ${triggerWord})`,
      });
    }

    return new Response(
      JSON.stringify({
        training_id: training.id,
        replicate_training_id: falRequestId,
        was_free: canUseFree,
        cost_credits: canUseFree ? 0 : TRAIN_COST_CREDITS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("portrait-train error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
