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
    const body = await req.json();
    const { name, email, role, password } = body as {
      name: string;
      email: string;
      role: string;
      password?: string;
    };

    if (!name || !email || !role) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos: name, email, role." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const parts = name.trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Crear el usuario en auth.users a nivel administrativo (evita confirmaciones de correo molestas en pruebas)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password || "paltarumi123", // Contraseña temporal por defecto
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (authError) {
      throw authError;
    }

    const newUserId = authData.user.id;

    // 2. Mapear el rol asignado
    // El trigger en la base de datos (on_auth_user_created) ya insertó el usuario en public.users 
    // y le asignó el rol VIEWER (Operador). Si el rol seleccionado es Administrador o Supervisor, 
    // lo actualizamos en la tabla intermedia user_roles.
    const dbRoleName = role === "Administrador" ? "ADMIN" : (role === "Supervisor" || role === "Comercial") ? "EDITOR" : "VIEWER";

    if (dbRoleName !== "VIEWER") {
      const { data: roleData } = await supabase
        .from("roles")
        .select("id")
        .eq("name", dbRoleName)
        .single();

      if (roleData) {
        // Eliminar rol VIEWER por defecto
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", newUserId);

        // Insertar el nuevo rol correspondiente
        await supabase
          .from("user_roles")
          .insert({
            user_id: newUserId,
            role_id: roleData.id
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Usuario creado exitosamente.",
        userId: newUserId
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
