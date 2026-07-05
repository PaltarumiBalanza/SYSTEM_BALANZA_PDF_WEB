import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS Preflight para permitir peticiones desde cualquier origen (ej: app de escritorio o frontend)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const region = formData.get("region") as string || "Sin Región";
    const creatorId = formData.get("creator_id") as string; // user_id del operador/sistema

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Archivo no encontrado en el cuerpo formData" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Guardar PDF en bucket "raw-reports"
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("raw-reports")
      .upload(fileName, file, {
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Obtener URL pública del archivo
    const { data: publicUrl } = supabase.storage
      .from("raw-reports")
      .getPublicUrl(uploadData.path);

    // 2. Registrar documento en la tabla "documents" con estado PENDIENTE
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: creatorId ? parseInt(creatorId) : 1, // Fallback a usuario ID 1
        name: file.name,
        file_link: publicUrl.publicUrl,
        status: "PENDIENTE",
      })
      .select()
      .single();

    if (docError) {
      throw docError;
    }

    // 3. Crear traza de auditoría de creación
    await supabase.from("audit_documents").insert({
      document_id: docData.id,
      user_id: creatorId ? parseInt(creatorId) : 1,
      action: "CREATE",
    });

    // 4. Enviar notificación por correo utilizando la API de Resend
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
          to: ["supervisores@paltarumi.com"], // Destinatario configurado o lista
          subject: `Nuevo reporte de balanza en revisión - Región ${region}`,
          html: `
            <h3>Nuevo Reporte Preliminar Recibido</h3>
            <p>Se ha subido un nuevo reporte preliminar de pesaje listo para ser auditado en el sistema web.</p>
            <ul>
              <li><strong>Archivo:</strong> ${file.name}</li>
              <li><strong>Región:</strong> ${region}</li>
              <li><strong>Fecha y Hora:</strong> ${new Date().toLocaleString()}</li>
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
