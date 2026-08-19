-- ====================================================================
-- SCRIPT DE LIMPIEZA / RESET DE DATOS DE PRUEBA (SUPABASE)
-- ====================================================================
-- Este script elimina todos los datos transaccionales de prueba:
--  - Trazabilidad y logs de auditoría (audit_documents)
--  - Comentarios de retroalimentación (comments)
--  - Reportes de balanza (documents)
--  - Archivos físicos PDF en Supabase Storage (raw-reports, annex-attachments, final-reports)
--
-- CONSERVA TOTALMENTE INTACTOS:
--  - Usuarios y perfiles (auth.users, public.users)
--  - Roles y Permisos (roles, permissions, role_permissions, user_roles)
--  - Clientes / Empresas registradas (customers)
-- ====================================================================

-- 1. VACIAR TABLAS TRANSACCIONALES Y REINICIAR CONTADORES DE ID (SERIAL)
-- =====================================================================
TRUNCATE TABLE 
    public.audit_documents, 
    public.comments, 
    public.documents 
RESTART IDENTITY CASCADE;

-- 2. LIMPIAR ARCHIVOS FÍSICOS EN SUPABASE STORAGE
-- =====================================================================
-- Elimina todos los archivos guardados en los 3 buckets del sistema
DELETE FROM storage.objects 
WHERE bucket_id IN ('raw-reports', 'annex-attachments', 'final-reports');

-- =====================================================================
-- 3. VERIFICACIÓN DE ESTADO (CONSULTAS DE COMPROBACIÓN)
-- =====================================================================
-- Ejecuta estas consultas para confirmar que la limpieza fue exitosa:
--
-- SELECT 'documents' AS tabla, count(*) FROM public.documents
-- UNION ALL
-- SELECT 'comments', count(*) FROM public.comments
-- UNION ALL
-- SELECT 'audit_documents', count(*) FROM public.audit_documents
-- UNION ALL
-- SELECT 'storage.objects (PDFs)', count(*) FROM storage.objects WHERE bucket_id IN ('raw-reports', 'annex-attachments', 'final-reports')
-- UNION ALL
-- SELECT 'users (CONSERVADOS)', count(*) FROM public.users
-- UNION ALL
-- SELECT 'customers (CONSERVADOS)', count(*) FROM public.customers;
