import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb } from "npm:pdf-lib";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PageOperation {
  bucket: string;       // Bucket origen (ej: 'raw-reports' o 'annex-attachments')
  path: string;         // Ruta del archivo en el bucket (ej: '1720000000000-file.pdf')
  pageIndex: number;    // Índice de la página a copiar (1-based index)
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { documentId, supervisorId, operations, sign, targetStatus } = body as {
      documentId: number;
      supervisorId: number;
      operations: PageOperation[];
      sign: boolean;
      targetStatus?: string;
    };

    if (!documentId || !operations || operations.length === 0) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos o las operaciones de páginas están vacías." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Crear documento PDF destino vacío
    const finalPdf = await PDFDocument.create();

    // Cache local de archivos descargados para evitar descargar el mismo PDF varias veces
    const pdfCache: Record<string, PDFDocument> = {};

    // Obtener información del documento original para autorecuperación por file_link
    const { data: docRecord } = await supabase
      .from("documents")
      .select("file_link")
      .eq("id", documentId)
      .maybeSingle();

    let originalCleanPath = docRecord?.file_link || "";
    if (originalCleanPath.startsWith("http://") || originalCleanPath.startsWith("https://")) {
      const parts = originalCleanPath.split("/");
      originalCleanPath = parts[parts.length - 1];
    }

    // 2. Reconstruir el PDF en base a las instrucciones de las páginas
    for (const op of operations) {
      let cleanPath = op.path || "";
      if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
        const parts = cleanPath.split("/");
        cleanPath = parts[parts.length - 1];
      }

      let bucket = op.bucket || "raw-reports";
      if (cleanPath.startsWith("signed-")) {
        bucket = "final-reports";
      }

      const cacheKey = `${bucket}/${cleanPath}`;
      let srcDoc = pdfCache[cacheKey];

      if (!srcDoc) {
        let { data, error } = await supabase.storage.from(bucket).download(cleanPath);

        // Fallback 1: Autorecuperación probando en todas las cubetas disponibles (annex-attachments, raw-reports, final-reports)
        if (error || !data) {
          const bucketsToTry = ["annex-attachments", "raw-reports", "final-reports"].filter(b => b !== bucket);
          for (const b of bucketsToTry) {
            const res = await supabase.storage.from(b).download(cleanPath);
            if (!res.error && res.data) {
              data = res.data;
              error = null;
              bucket = b;
              break;
            }
          }
        }

        // Fallback 2: Autorecuperación probando con la ruta original file_link si la clave de borrador no existe
        if ((error || !data) && originalCleanPath && originalCleanPath !== cleanPath) {
          const origBuckets = ["raw-reports", "final-reports", "annex-attachments"];
          for (const b of origBuckets) {
            const res = await supabase.storage.from(b).download(originalCleanPath);
            if (!res.error && res.data) {
              data = res.data;
              error = null;
              bucket = b;
              cleanPath = originalCleanPath;
              break;
            }
          }
        }

        if (error || !data) {
          throw new Error(
            `Error descargando "${cleanPath}" desde Storage (${bucket}). ` +
            `También se intentó file_link="${originalCleanPath || 'N/A'}". ` +
            `Detalle: ${error?.message || "Archivo no encontrado"}`
          );
        }
        const arrayBuffer = await data.arrayBuffer();
        srcDoc = await PDFDocument.load(arrayBuffer);
        pdfCache[cacheKey] = srcDoc;
      }

      // Validar índice de página (pdf-lib usa 0-based indices) ajustando límites de forma segura
      const pageCount = srcDoc.getPageCount();
      const safePageIndex = Math.min(Math.max(1, op.pageIndex), pageCount);

      // Copiar la página seleccionada al nuevo documento
      const [copiedPage] = await finalPdf.copyPages(srcDoc, [safePageIndex - 1]);
      finalPdf.addPage(copiedPage);
    }

    // 3. Estampar la firma/sello de "Revisado" si se solicita
    if (sign) {
      const pages = finalPdf.getPages();
      if (pages.length > 0) {
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        // Dibujar caja de firma estilo industrial
        firstPage.drawRectangle({
          x: width - 160,
          y: height - 70,
          width: 140,
          height: 50,
          borderColor: rgb(0.06, 0.73, 0.5), // Emerald Green (#10b981)
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
        firstPage.drawText(`SUP: ID #${supervisorId}\nFec: ${fechaStamp}`, {
          x: width - 145,
          y: height - 60,
          size: 8,
          color: rgb(0.2, 0.3, 0.25),
          lineHeight: 10,
        });
      }
    }

    // 4. Serializar y guardar el PDF final resultante en bytes
    const pdfBytes = await finalPdf.save();

    // 5. Guardar en el bucket "final-reports"
    const finalFileName = `signed-${documentId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("final-reports")
      .upload(finalFileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Obtener la URL pública del reporte firmado
    const { data: publicUrl } = supabase.storage
      .from("final-reports")
      .getPublicUrl(uploadData.path);

    // 6. Actualizar registro del documento en la tabla SQL
    const finalStatus = targetStatus || "HECHO";

    // Verificar si el supervisorId existe en public.users para evitar fallos de Foreign Key (fk_encargado_cierre)
    let validSupervisorId: string | null = null;
    if (supervisorId) {
      const { data: userCheck } = await supabase
        .from("users")
        .select("id")
        .eq("id", supervisorId)
        .maybeSingle();
      if (userCheck) {
        validSupervisorId = userCheck.id;
      }
    }

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .update({
        status: finalStatus,
        file_link: publicUrl.publicUrl,
        draft_operations: operations,
        encargado_cierre: validSupervisorId,
      })
      .eq("id", documentId)
      .select()
      .single();

    if (docError) {
      throw new Error(`Error al actualizar estado en base de datos: ${docError.message}`);
    }

    // 7. Insertar logs de auditoría (Cierre / Firma)
    await supabase.from("audit_documents").insert({
      document_id: documentId,
      user_id: validSupervisorId,
      action: finalStatus === "CERRADO POR BALANZA" ? "CLOSE_BALANZA" : "CLOSE",
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: docData,
        path: uploadData.path,
        url: publicUrl.publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
