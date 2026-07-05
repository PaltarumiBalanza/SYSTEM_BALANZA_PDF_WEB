-- ====================================================================
-- SCRIPT DE CREACIÓN DE BUCKETS Y POLÍTICAS DE ALMACENAMIENTO (SUPABASE)
-- ====================================================================
-- Ejecuta este script en el editor SQL de tu Dashboard de Supabase.

-- 1. CREACIÓN DE LOS BUCKETS DE STORAGE
-- ==========================================

-- Bucket para reportes originales (PDFs preliminares de balanzas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'raw-reports', 
  'raw-reports', 
  false, 
  52428800, -- Límite de 50MB por reporte
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para archivos anexos que adjuntan los supervisores en el editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'annex-attachments', 
  'annex-attachments', 
  false, 
  20971520, -- Límite de 20MB por anexo
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket para los PDFs finales inmutables y firmados para el área comercial
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'final-reports', 
  'final-reports', 
  true, -- Público para facilitar descargas directas de enlaces
  52428800, -- Límite de 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- 2. POLÍTICAS DE SEGURIDAD RLS EN STORAGE.OBJECTS
-- ==========================================
-- Asegura que solo usuarios autorizados accedan a los archivos correspondientes.

-- Habilitar RLS en objetos de almacenamiento
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1 Políticas para 'raw-reports' (Reportes crudos de balanza)
-----------------------------------------------------------------

-- Permitir leer reportes crudos a cualquier usuario autenticado en el sistema
CREATE POLICY "Permitir lectura de raw-reports a autenticados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'raw-reports');

-- (La subida a raw-reports la realiza la Edge Function usando la llave SERVICE_ROLE, 
-- por ende no requiere política explícita de INSERT en el RLS público)


-- 2.2 Políticas para 'annex-attachments' (Anexos subidos por supervisores)
-----------------------------------------------------------------

-- Permitir lectura de anexos a usuarios autenticados
CREATE POLICY "Permitir lectura de anexos a autenticados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'annex-attachments');

-- Permitir subir anexos a supervisores/editores (usuarios autenticados en el portal)
CREATE POLICY "Permitir subida de anexos a autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'annex-attachments');

-- Permitir eliminar anexos a usuarios autenticados
CREATE POLICY "Permitir eliminar anexos a autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'annex-attachments');


-- 2.3 Políticas para 'final-reports' (PDFs firmados finales)
-----------------------------------------------------------------

-- Permitir descargar reportes finales a cualquier usuario autenticado (área comercial, etc.)
CREATE POLICY "Permitir lectura de reportes finales a autenticados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'final-reports');

-- (Al igual que raw-reports, la escritura de reportes firmados la hace únicamente 
-- la Edge Function 'compile-and-sign-pdf' con privilegios de Service Role, asegurando 
-- la inmutabilidad de los reportes terminados frente a manipulaciones de clientes)
