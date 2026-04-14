

# Plano: Corrigir upload de PDFs no Admin

## Diagnóstico

O bucket `reference-pdfs` tem políticas de INSERT e DELETE para admins, mas **falta a política de UPDATE** no `storage.objects`. O Supabase Storage usa uploads multipart que exigem permissão de UPDATE além de INSERT. Sem essa política, o upload falha silenciosamente ou retorna erro de permissão.

## Correção

Uma migration SQL para adicionar a política de UPDATE faltante:

```sql
CREATE POLICY "Admins can update reference pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reference-pdfs' AND has_role(auth.uid(), 'admin'::app_role));
```

Também vou adicionar a mesma política no bucket `asset-gallery` (prevenção):

```sql
CREATE POLICY "Admins can update gallery assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'asset-gallery' AND has_role(auth.uid(), 'admin'::app_role));
```

## Arquivo afetado

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar políticas UPDATE nos buckets de storage |

Nenhuma mudança no código frontend — apenas infraestrutura de permissões.

