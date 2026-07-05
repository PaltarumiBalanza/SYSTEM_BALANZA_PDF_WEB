-- ====================================================================
-- SCRIPT DE MIGRACIÓN: MIGRACIÓN A UUID Y SINCRONIZACIÓN CON SUPABASE AUTH
-- ====================================================================
-- Ejecuta este script en el editor SQL de Supabase para enlazar la tabla
-- pública 'users' con el sistema de autenticación 'auth.users' de Supabase.

-- 1. ELIMINAR CONSTRICCIONES Y LLAVES FORÁNEAS ANTIGUAS
-- ==========================================================
ALTER TABLE IF EXISTS documents DROP CONSTRAINT IF EXISTS fk_documents_user;
ALTER TABLE IF EXISTS documents DROP CONSTRAINT IF EXISTS fk_encargado_cierre;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS fk_comments_user;
ALTER TABLE IF EXISTS audit_documents DROP CONSTRAINT IF EXISTS fk_audit_user;
ALTER TABLE IF EXISTS user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS user_roles DROP CONSTRAINT IF EXISTS fk_user_roles_user;

-- 2. MODIFICAR LA TABLA DE USUARIOS PÚBLICA (public.users)
-- ==========================================================

-- Eliminar PK antigua
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;

-- Eliminar el DEFAULT antiguo de tipo entero (SERIAL)
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Cambiar columna ID a UUID y agregar columna email
ALTER TABLE users ALTER COLUMN id TYPE UUID USING (gen_random_uuid());
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Definir ID como Primary Key y agregar Llave Foránea hacia auth.users
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE users ADD CONSTRAINT fk_users_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- 3. ADAPTAR LAS COLUMNAS RELACIONADAS A UUID EN LAS DEMÁS TABLAS
-- ==========================================================
ALTER TABLE documents ALTER COLUMN user_id TYPE UUID USING (gen_random_uuid());
ALTER TABLE documents ALTER COLUMN encargado_cierre TYPE UUID;

ALTER TABLE comments ALTER COLUMN user_id TYPE UUID;

ALTER TABLE audit_documents ALTER COLUMN user_id TYPE UUID;

ALTER TABLE user_roles ALTER COLUMN user_id TYPE UUID;


-- 4. VOLVER A CREAR LAS LLAVES FORÁNEAS APUNTANDO AL NUEVO UUID
-- ==========================================================
ALTER TABLE documents 
  ADD CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE documents 
  ADD CONSTRAINT fk_encargado_cierre FOREIGN KEY (encargado_cierre) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE comments 
  ADD CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE audit_documents 
  ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_roles 
  ADD CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


-- 5. TRIGGER AUTOMÁTICO DE SINCRONIZACIÓN (AUTH -> PUBLIC)
-- ==========================================================
-- Esta función se dispara automáticamente cada vez que creas un usuario en el panel
-- de Authentication (auth.users) de Supabase, insertando su perfil en public.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id INTEGER;
BEGIN
  -- 1. Insertar perfil en public.users
  INSERT INTO public.users (id, first_name, last_name, email, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    'A' -- Activo por defecto
  );
  
  -- 2. Obtener el ID del rol VIEWER
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'VIEWER';
  
  -- 3. Asignar rol de lectura (VIEWER) en user_roles
  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (new.id, default_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el disparador en la tabla auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
