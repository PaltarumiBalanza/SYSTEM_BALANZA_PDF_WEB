import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Faltan credenciales: email y password son requeridos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente estándar de Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // 1. Iniciar sesión con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Credenciales inválidas." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 2. Verificar el estado del usuario en la base de datos pública
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("status, user_roles (roles (name))")
      .eq("id", userId)
      .single() as any;

    if (profileError || !userProfile) {
      // Si no tiene perfil público, cerramos sesión
      await supabase.auth.signOut();
      return new Response(
        JSON.stringify({ error: "Perfil de usuario no encontrado en el sistema público." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Si el usuario está desactivado (status === 'I'), denegamos el acceso
    if (userProfile.status === "I") {
      await supabase.auth.signOut();
      return new Response(
        JSON.stringify({ error: "Esta cuenta ha sido desactivada. Comuníquese con el administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleName = userProfile.user_roles?.[0]?.roles?.name || "VIEWER";

    // 3. Registrar fecha de último acceso en public.users
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await serviceClient
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", userId);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        user: {
          id: userId,
          email: authData.user.email,
          first_name: authData.user.user_metadata?.first_name || "",
          last_name: authData.user.user_metadata?.last_name || "",
          role: roleName,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
