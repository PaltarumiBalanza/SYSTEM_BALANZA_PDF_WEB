-- ====================================================================
-- CREACIÓN DE LA TABLA CUSTOMERS (CLIENTES)
-- ====================================================================
-- Ejecuta este comando en el SQL Editor de tu Dashboard de Supabase.

CREATE TABLE IF NOT EXISTS public.customers (
    id SERIAL PRIMARY KEY,
    customer VARCHAR(100) NOT NULL,
    ruc VARCHAR(20) NOT NULL UNIQUE
);

-- Habilitar RLS de forma básica (opcional, permite acceso público/autenticado rápido)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Crear política de lectura/escritura para usuarios autenticados
CREATE POLICY "Permitir todo a usuarios autenticados" 
ON public.customers 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
