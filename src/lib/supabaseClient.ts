import { createClient } from '@supabase/supabase-js';

// Usamos fallbacks válidos (con formato URL) para evitar que la app Next.js se rompa al iniciarse si no hay variables de entorno aún
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.warn(
      'ADVERTENCIA: Las credenciales de Supabase no están configuradas. Reemplaza NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
