import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb } from "npm:pdf-lib";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestMode = "FINALIZE" | "APPROVE" | "PREVIEW";
type TargetStatus = "HECHO" | "CERRADO POR BALANZA";

interface PageOperation {
  bucket: string;
  path: string;
  pageIndex: number;
  sha256?: string;
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return jsonResponse({ error: "Sesión no válida." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Sesión expirada o inválida." }, 401);

    const body = await req.json();
    const {
      documentId,
      operations = [],
      sign = false,
      mode,
      targetStatus,
      auditDetails,
    } = body as {
      documentId: number;
      operations?: PageOperation[];
      sign?: boolean;
      mode?: RequestMode;
      targetStatus?: TargetStatus | string;
      auditDetails?: Record<string, unknown>;
    };

    if (!documentId) {
      return jsonResponse({ error: "La solicitud debe indicar documentId." }, 400);
    }

    // Compatibilidad temporal con clientes aún no desplegados: solo se permite inferir
    // un cierre de Balanza explícito. Nunca se infiere HECHO/Comercial por omisión.
    const requestedMode: RequestMode | undefined = mode ||
      (targetStatus === "CERRADO POR BALANZA" ? "FINALIZE" : undefined);
    if (!requestedMode || !["FINALIZE", "APPROVE", "PREVIEW"].includes(requestedMode)) {
      return jsonResponse({ error: "Actualice la aplicación antes de procesar este reporte." }, 409);
    }

    const { data: roleRows, error: roleError } = await adminClient
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", user.id);
    if (roleError) throw new Error(`No se pudo validar el rol: ${roleError.message}`);

    const roles = (roleRows || [])
      .map((row) => {
        const relation = row.roles as unknown as { name?: string } | null;
        return relation?.name;
      })
      .filter((name): name is string => Boolean(name));
    const isAdmin = roles.includes("ADMIN");
    const isCommercial = roles.includes("EDITOR") || roles.includes("SUPERVISOR");
    const isBalanza = roles.includes("VIEWER");

    const { data: currentDocument, error: documentError } = await adminClient
      .from("documents")
      .select("id, status, file_link, draft_operations")
      .eq("id", documentId)
      .single();
    if (documentError || !currentDocument) return jsonResponse({ error: "Reporte no encontrado." }, 404);

    if (requestedMode === "APPROVE") {
      if (!isAdmin && !isCommercial) {
        return jsonResponse({ error: "Solo Comercial o Administración puede aprobar el reporte." }, 403);
      }
      if (currentDocument.status !== "CERRADO POR BALANZA") {
        return jsonResponse({ error: "Solo se puede aprobar un reporte cerrado previamente por Balanza." }, 409);
      }

      const { data: approved, error: approveError } = await adminClient
        .from("documents")
        .update({ status: "HECHO" })
        .eq("id", documentId)
        .eq("status", "CERRADO POR BALANZA")
        .select()
        .single();
      if (approveError) throw new Error(`No se pudo aprobar el reporte: ${approveError.message}`);

      const { error: auditError } = await adminClient.from("audit_documents").insert({
        document_id: documentId,
        user_id: user.id,
        action: "CLOSE",
        details: { mode: "APPROVE", previousStatus: currentDocument.status },
      });
      if (auditError) throw new Error(`No se pudo registrar la auditoría: ${auditError.message}`);

      return jsonResponse({ success: true, document: approved });
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      return jsonResponse({ error: "Las operaciones de páginas no pueden estar vacías." }, 400);
    }

    if (requestedMode === "FINALIZE") {
      if (!targetStatus || !["HECHO", "CERRADO POR BALANZA"].includes(targetStatus)) {
        return jsonResponse({ error: "FINALIZE requiere un targetStatus explícito y válido." }, 400);
      }
      if (targetStatus === "CERRADO POR BALANZA" && !isAdmin && !isBalanza) {
        return jsonResponse({ error: "Solo Balanza o Administración puede cerrar por Balanza." }, 403);
      }
      if (targetStatus === "HECHO" && !isAdmin && !isCommercial) {
        return jsonResponse({ error: "Solo Comercial o Administración puede completar el reporte." }, 403);
      }
    }

    const allowedBuckets = new Set(["raw-reports", "annex-attachments"]);
    const hashPaths = new Map<string, string>();
    for (const op of operations) {
      const cleanPath = (op.path || "").split("/").pop() || "";
      if (!allowedBuckets.has(op.bucket) || !cleanPath || cleanPath.startsWith("signed-")) {
        return jsonResponse({ error: `Fuente PDF no permitida: ${op.bucket}/${cleanPath}` }, 400);
      }
      if (!Number.isInteger(op.pageIndex) || op.pageIndex < 1) {
        return jsonResponse({ error: `Índice de página inválido para ${cleanPath}.` }, 400);
      }
      if (op.sha256) {
        const previousPath = hashPaths.get(op.sha256);
        if (previousPath && previousPath !== cleanPath) {
          return jsonResponse({ error: `El mismo PDF fue adjuntado más de una vez (${previousPath} y ${cleanPath}).` }, 409);
        }
        hashPaths.set(op.sha256, cleanPath);
      }
    }

    const finalPdf = await PDFDocument.create();
    const pdfCache: Record<string, PDFDocument> = {};

    for (const op of operations) {
      const cleanPath = op.path.split("/").pop()!;
      const cacheKey = `${op.bucket}/${cleanPath}`;
      let srcDoc = pdfCache[cacheKey];
      if (!srcDoc) {
        const { data, error } = await adminClient.storage.from(op.bucket).download(cleanPath);
        if (error || !data) {
          throw new Error(`No se encontró la fuente exacta ${cacheKey}. Se canceló para evitar reutilizar un PDF firmado.`);
        }
        srcDoc = await PDFDocument.load(await data.arrayBuffer());
        pdfCache[cacheKey] = srcDoc;
      }

      const pageCount = srcDoc.getPageCount();
      if (op.pageIndex > pageCount) {
        throw new Error(`La página ${op.pageIndex} no existe en ${cacheKey}; el archivo tiene ${pageCount} páginas.`);
      }
      const [copiedPage] = await finalPdf.copyPages(srcDoc, [op.pageIndex - 1]);
      finalPdf.addPage(copiedPage);
    }

    if (sign) {
      const pages = finalPdf.getPages();
      if (pages.length > 0) {
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        firstPage.drawRectangle({
          x: width - 160,
          y: height - 70,
          width: 140,
          height: 50,
          borderColor: rgb(0.06, 0.73, 0.5),
          borderWidth: 2,
          color: rgb(0.95, 0.99, 0.97),
          opacity: 0.9,
        });
        firstPage.drawText("REVISADO", {
          x: width - 145,
          y: height - 42,
          size: 14,
          color: rgb(0.06, 0.73, 0.5),
          lineHeight: 14,
        });
        const fechaStamp = new Date().toLocaleDateString("es-PE", { timeZone: "America/Lima" });
        firstPage.drawText(`SUP: ${user.id.slice(0, 8)}\nFec: ${fechaStamp}`, {
          x: width - 145,
          y: height - 60,
          size: 8,
          color: rgb(0.2, 0.3, 0.25),
          lineHeight: 10,
        });
      }
    }

    const pdfBytes = await finalPdf.save();
    const finalFileName = `${requestedMode === "PREVIEW" ? "preview" : "signed"}-${documentId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("final-reports")
      .upload(finalFileName, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = adminClient.storage.from("final-reports").getPublicUrl(uploadData.path);

    if (requestedMode === "PREVIEW") {
      return jsonResponse({ success: true, path: uploadData.path, url: publicUrl.publicUrl });
    }

    const finalStatus = targetStatus as TargetStatus;
    const { data: updated, error: updateError } = await adminClient
      .from("documents")
      .update({
        status: finalStatus,
        file_link: publicUrl.publicUrl,
        draft_operations: operations,
        encargado_cierre: user.id,
      })
      .eq("id", documentId)
      .select()
      .single();
    if (updateError) throw new Error(`No se pudo actualizar el reporte: ${updateError.message}`);

    const { error: auditError } = await adminClient.from("audit_documents").insert({
      document_id: documentId,
      user_id: user.id,
      action: finalStatus === "CERRADO POR BALANZA" ? "CLOSE_BALANZA" : "CLOSE",
      details: {
        mode: "FINALIZE",
        previousStatus: currentDocument.status,
        before: currentDocument.draft_operations,
        after: operations,
        ...(auditDetails || {}),
      },
    });
    if (auditError) throw new Error(`El PDF se generó, pero falló la auditoría: ${auditError.message}`);

    return jsonResponse({ success: true, document: updated, path: uploadData.path, url: publicUrl.publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 400);
  }
});
