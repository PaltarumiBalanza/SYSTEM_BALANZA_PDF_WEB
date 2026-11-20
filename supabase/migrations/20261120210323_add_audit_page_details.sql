ALTER TABLE public.audit_documents
ADD COLUMN IF NOT EXISTS details JSONB;

COMMENT ON COLUMN public.audit_documents.details IS
'Contexto estructurado del evento: estado anterior, operaciones de páginas antes/después y metadatos de la acción.';
