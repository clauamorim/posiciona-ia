

## Plano: Corrigir análise Instagram e geração de retratos

### Diagnóstico

Ambos os erros têm a mesma causa raiz: **as imagens base64 enviadas ao edge function são grandes demais**, causando falha na requisição ("Load failed" / "Failed to send a request to the Edge Function"). Não há compressão ou redimensionamento no lado do cliente.

Um screenshot de iPhone, por exemplo, pode ter 5MB em PNG, gerando ~6.7MB em base64. Multiplicado por 5 selfies no caso dos retratos, o payload ultrapassa o limite do edge function.

### Solução

Criar uma função utilitária de compressão de imagem no cliente que redimensiona e converte para JPEG antes de enviar.

### Implementação

**1. Criar `src/lib/imageUtils.ts`**
- Função `compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string>`
- Usa Canvas API para redimensionar a imagem (mantendo proporção)
- Converte para JPEG com qualidade configurável
- Para Instagram: maxWidth=1200, quality=0.7 (~100-200KB)
- Para Retratos: maxWidth=1024, quality=0.8

**2. Atualizar `src/pages/InstagramAnalysis.tsx`**
- Importar `compressImage`
- No `handleFileChange`, comprimir a imagem após ler o arquivo
- Enviar a versão comprimida ao edge function

**3. Atualizar `src/pages/PortraitGenerator.tsx`**
- Importar `compressImage`
- No `fileToBase64` ou `handleFiles`, comprimir cada selfie após leitura
- Enviar versões comprimidas ao edge function

### Detalhe técnico

```text
Antes:
  Screenshot PNG 5MB → base64 6.7MB → POST body 6.7MB → edge function timeout/falha

Depois:
  Screenshot PNG 5MB → Canvas resize 1200px → JPEG 0.7 → ~150KB base64 → POST OK
```

### Arquivos

- `src/lib/imageUtils.ts` (novo)
- `src/pages/InstagramAnalysis.tsx` (ajuste no handleFileChange)
- `src/pages/PortraitGenerator.tsx` (ajuste no handleFiles/fileToBase64)

