-- ====================================================================
-- ACTUALIZACIÓN DE ESTADOS Y ROLES EN SUPABASE
-- ====================================================================
-- Ejecuta este comando en el SQL Editor de tu Dashboard de Supabase.
-- Modificará la longitud de la columna status y actualizará los estados 
-- válidos permitidos para la tabla documents.

-- 1. Modificar longitud de columna status
ALTER TABLE public.documents ALTER COLUMN status TYPE VARCHAR(30);

-- 2. Eliminar constraint de check previo si existe
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;

-- 3. Crear el nuevo constraint con los estados vigentes
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check 
CHECK (status IN ('PENDIENTE', 'CERRADO POR BALANZA', 'HECHO', 'ERROR'));

-- 4. Opcional: Migrar registros previos con estado 'CERRADO' a 'CERRADO POR BALANZA'
UPDATE public.documents 
SET status = 'CERRADO POR BALANZA' 
WHERE status = 'CERRADO';
