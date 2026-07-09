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
    // 1. Obtener y validar el token Bearer en la cabecera Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado. Se requiere cabecera 'Authorization: Bearer <token>' válida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Inicializar cliente estándar con el token del usuario para validar sesión
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida o expirada. Vuelva a iniciar sesión desde el sistema de escritorio." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creatorId = user.id; // UUID del operador que sube el reporte

    // 2. Procesar el archivo y metadatos del cuerpo multipart/formData
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const region = formData.get("region") as string || "Sin Región";

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Archivo PDF no encontrado en el cuerpo de la petición." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente administrativo (service_role) para saltar RLS en almacenamiento y escritura masiva
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Subir el PDF original al bucket "raw-reports"
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("raw-reports")
      .upload(fileName, file, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Obtener la ruta del archivo relativa
    const fileLinkPath = uploadData.path; // Guardamos la ruta relativa para descargas directas del bucket

    // 4. Registrar documento en la tabla "documents" con estado PENDIENTE
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: creatorId,
        name: file.name,
        file_link: fileLinkPath, // Guardamos la ruta del archivo en el bucket
        status: "PENDIENTE",
      })
      .select()
      .single();

    if (docError) {
      throw docError;
    }

    // 5. Crear traza de auditoría de creación en 'audit_documents'
    await supabase.from("audit_documents").insert({
      document_id: docData.id,
      user_id: creatorId,
      action: "CREATE",
    });

    // 6. Enviar notificación por correo utilizando la API de Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailStatus = "no_key";

    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Paltarumi Hub <onboarding@resend.dev>",
          to: ["supervisores@paltarumi.com"], // Cambiar por bandeja real de supervisión
          subject: `Nuevo reporte de balanza en revisión - Región ${region}`,
          html: `
            <h3>Nuevo Reporte Preliminar Recibido</h3>
            <p>Se ha subido un nuevo reporte preliminar de pesaje listo para ser auditado en el sistema web.</p>
            <ul>
              <li><strong>Archivo:</strong> ${file.name}</li>
              <li><strong>Región:</strong> ${region}</li>
              <li><strong>Operador:</strong> ${user.email}</li>
              <li><strong>Fecha y Hora:</strong> ${new Date().toLocaleString("es-PE")}</li>
            </ul>
            <p>Puedes revisarlo, reordenar sus páginas y firmarlo desde el <a href="${Deno.env.get("FRONTEND_URL") || "http://localhost:3000"}/editor/${docData.id}">Editor de Reportes</a>.</p>
          `,
        }),
      });

      if (emailResponse.ok) {
        emailStatus = "sent";
      } else {
        const errorText = await emailResponse.text();
        console.error("Error enviando email con Resend:", errorText);
        emailStatus = "error_sending";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reporte de balanza subido y registrado exitosamente.",
        document: docData,
        emailStatus,
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
