import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Preserva el nombre original del archivo (espacios, guiones, etc.) sin sanitizar a guiones bajos. */
function resolveDocumentName(formData: FormData, file: File): string {
  const explicit =
    (formData.get("filename") as string | null) ||
    (formData.get("displayName") as string | null) ||
    (formData.get("name") as string | null);

  const raw = (explicit?.trim() || file.name || "").trim();
  if (!raw) return "reporte.pdf";
  return raw.toLowerCase().endsWith(".pdf") ? raw : `${raw}.pdf`;
}

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
    
    let creatorId: string;

    try {
      const jwtSecret = Deno.env.get("JWT_SECRET");
      if (jwtSecret) {
        // Verificar la firma del JWT con la clave secreta de Supabase, ignorando la expiración
        const { payload } = await jwtVerify(
          token,
          new TextEncoder().encode(jwtSecret),
          { ignoreExpiration: true }
        );
        creatorId = payload.sub as string;
      } else {
        // Fallback local decodificando el payload sin firma
        const payloadBase64 = token.split(".")[1];
        const payloadDecoded = JSON.parse(atob(payloadBase64));
        creatorId = payloadDecoded.sub;
      }

      if (!creatorId) {
        throw new Error("Token malformado: no contiene el campo 'sub'.");
      }
    } catch (authError: any) {
      return new Response(
        JSON.stringify({ error: `Token inválido: ${authError.message}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Procesar el archivo y metadatos del cuerpo multipart/formData
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const region = formData.get("region") as string || "Sin Región";
    const company = formData.get("company") as string || formData.get("empresa") as string || "PSAC";

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

    // 3. Subir el PDF original al bucket "raw-reports" (nombre sin sanitizar)
    const documentName = resolveDocumentName(formData, file);
    const fileName = `${Date.now()}-${documentName}`;
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
    const fileLinkPath = uploadData.path;

    // Obtener email del operador para la notificación (opcional)
    const { data: operatorProfile } = await supabase
      .from("users")
      .select("email")
      .eq("id", creatorId)
      .maybeSingle();
    const operatorEmail = operatorProfile?.email || creatorId;

    // 4. Registrar documento en la tabla "documents" con estado PENDIENTE
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: creatorId,
        name: documentName,
        file_link: fileLinkPath,
        status: "PENDIENTE",
        region: region,
        company: company.toUpperCase() === "ECOGOLD" ? "ECOGOLD" : "PSAC",
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
              <li><strong>Archivo:</strong> ${documentName}</li>
              <li><strong>Región:</strong> ${region}</li>
              <li><strong>Operador:</strong> ${operatorEmail}</li>
              <li><strong>Fecha y Hora:</strong> ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}</li>
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
