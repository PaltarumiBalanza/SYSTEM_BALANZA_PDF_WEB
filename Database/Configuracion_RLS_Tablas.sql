-- ====================================================================
-- CONFIGURACIÓN DE SEGURIDAD (RLS) PARA TABLAS DE BASE DE DATOS
-- ====================================================================
-- En Supabase, las tablas creadas suelen tener habilitado Row Level Security (RLS)
-- por defecto. Si RLS está activo y no hay políticas creadas, las consultas desde 
-- el sitio web (Next.js) retornarán 0 registros.

-- Tienes DOS opciones a continuación para ejecutar en el SQL Editor de Supabase:

-- ====================================================================
-- OPCIÓN A: DESHABILITAR RLS EN TABLAS (Recomendado para pruebas/prototipado rápido)
-- ====================================================================
-- Esto permitirá que el frontend de Next.js lea y escriba directamente sin restricciones.

ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_documents DISABLE ROW LEVEL SECURITY;


-- ====================================================================
-- OPCIÓN B: HABILITAR RLS Y CREAR POLÍTICAS PERMISIVAS DE AUTENTICACIÓN (Producción)
-- ====================================================================
-- Descomenta este bloque completo si deseas seguridad estricta en producción.
/*
-- 1. Habilitar RLS en las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_documents ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas de lectura para usuarios autenticados
CREATE POLICY "Permitir lectura completa a autenticados" ON public.users 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.user_roles 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.roles 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.permissions 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.role_permissions 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.documents 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.comments 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir lectura completa a autenticados" ON public.audit_documents 
    FOR SELECT TO authenticated USING (true);

-- 3. Crear políticas de escritura básicas
CREATE POLICY "Permitir a autenticados comentar" ON public.comments 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir modificar perfiles a administradores" ON public.users 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir modificar roles de usuario a administradores" ON public.user_roles 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir modificar documentos a autenticados" ON public.documents 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/
