-- ====================================================================
-- ADICIÓN DE COLUMNA DE BORRADOR A LA TABLA DE DOCUMENTOS
-- ====================================================================
-- Ejecuta este comando en el SQL Editor de Supabase para habilitar la capacidad
-- de guardar borradores temporales en el editor de PDF sin finalizar.

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS draft_operations JSONB;

-- Comentario explicativo en la base de datos
COMMENT ON COLUMN public.documents.draft_operations 
IS 'Guarda la secuencia temporal de páginas ordenadas y anexadas del editor de PDF.';
