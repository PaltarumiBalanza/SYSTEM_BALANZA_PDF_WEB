-- ====================================================================
-- ADICIÓN DE COLUMNA EMPRESA A LA TABLA DE DOCUMENTOS
-- ====================================================================
-- Ejecuta este comando en el SQL Editor de tu Dashboard de Supabase.
-- Agregará el campo 'company' con valores válidos 'PSAC' o 'ECOGOLD'.

-- 1. Añadir la columna con restricción CHECK y valor por defecto 'PSAC'
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS company VARCHAR(20) DEFAULT 'PSAC' CHECK (company IN ('PSAC', 'ECOGOLD'));

-- 2. Asegurar que los registros históricos queden configurados como 'PSAC'
UPDATE public.documents 
SET company = 'PSAC' 
WHERE company IS NULL;
