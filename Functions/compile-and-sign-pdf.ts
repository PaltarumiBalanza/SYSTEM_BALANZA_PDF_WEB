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
    const { documentId, supervisorId, operations, sign } = body as {
      documentId: number;
      supervisorId: number;
      operations: PageOperation[];
      sign: boolean;
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

    // 2. Reconstruir el PDF en base a las instrucciones de las páginas
    for (const op of operations) {
      const cacheKey = `${op.bucket}/${op.path}`;
      let srcDoc = pdfCache[cacheKey];

      if (!srcDoc) {
        const { data, error } = await supabase.storage.from(op.bucket).download(op.path);
        if (error) {
          throw new Error(`Error descargando ${cacheKey} desde Storage: ${error.message}`);
        }
        const arrayBuffer = await data.arrayBuffer();
        srcDoc = await PDFDocument.load(arrayBuffer);
        pdfCache[cacheKey] = srcDoc;
      }

      // Validar índice de página (pdf-lib usa 0-based indices)
      const pageCount = srcDoc.getPageCount();
      if (op.pageIndex < 1 || op.pageIndex > pageCount) {
        throw new Error(`Índice de página ${op.pageIndex} fuera de rango. El archivo tiene ${pageCount} páginas.`);
      }

      // Copiar la página seleccionada al nuevo documento
      const [copiedPage] = await finalPdf.copyPages(srcDoc, [op.pageIndex - 1]);
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

        const fechaStamp = new Date().toLocaleDateString("es-PE");
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
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .update({
        status: "HECHO",
        file_link: publicUrl.publicUrl,
        encargado_cierre: supervisorId,
      })
      .eq("id", documentId)
      .select()
      .single();

    if (docError) {
      throw docError;
    }

    // 7. Insertar logs de auditoría (Cierre / Firma)
    await supabase.from("audit_documents").insert({
      document_id: documentId,
      user_id: supervisorId,
      action: "CLOSE",
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
