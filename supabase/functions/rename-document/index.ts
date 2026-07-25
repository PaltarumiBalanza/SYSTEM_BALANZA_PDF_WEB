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
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado. Se requiere un token de sesión válido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida o expirada." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request body
    const body = await req.json();
    const { documentId, newName } = body as {
      documentId: number;
      newName: string;
    };

    if (!documentId || !newName) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos: documentId, newName." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Clean and validate new name
    let cleanNewName = newName.trim();
    if (!cleanNewName) {
      return new Response(
        JSON.stringify({ error: "El nuevo nombre no puede estar vacío." }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!cleanNewName.toLowerCase().endsWith(".pdf")) {
      cleanNewName += ".pdf";
    }

    // 3. Initialize admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Query current document data
    const { data: docData, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, name, file_link, status")
      .eq("id", documentId)
      .single();

    if (docError || !docData) {
      return new Response(
        JSON.stringify({ error: "El documento no existe o no se pudo consultar." }),
        { status: 404, headers: corsHeaders }
      );
    }

    const currentFileLink = docData.file_link;
    if (!currentFileLink) {
      return new Response(
        JSON.stringify({ error: "El documento no tiene un archivo físico asociado." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Determine bucket and current storage path
    let bucket = "raw-reports";
    let oldPath = currentFileLink;

    if (docData.status === "HECHO") {
      bucket = "final-reports";
      if (currentFileLink.startsWith("http")) {
        const parts = currentFileLink.split("/");
        oldPath = parts[parts.length - 1];
      }
    }

    // Parse the prefix (timestamp/system prefix) to maintain uniqueness
    let prefix = "";
    if (docData.status === "HECHO") {
      const match = oldPath.match(/^(signed-\d+-\d+)-?/);
      prefix = match ? `${match[1]}-` : `signed-${documentId}-${Date.now()}-`;
    } else {
      const match = oldPath.match(/^(\d+-)/);
      prefix = match ? match[1] : "";
    }

    const newPath = `${prefix}${cleanNewName}`;

    // 5. Rename/Move the file in Storage
    console.log(`Renaming in Storage bucket "${bucket}": "${oldPath}" -> "${newPath}"`);
    const { error: moveError } = await supabaseAdmin.storage
      .from(bucket)
      .move(oldPath, newPath);

    // If the file was not found in storage, we can still proceed or return an error depending on preference.
    // Here we will fail the operation so that the DB and Storage don't go out of sync.
    if (moveError) {
      console.error("Storage move error:", moveError);
      return new Response(
        JSON.stringify({ error: `Fallo al renombrar archivo en storage: ${moveError.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 6. Calculate new database file_link
    let newFileLink = newPath;
    if (docData.status === "HECHO") {
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("final-reports")
        .getPublicUrl(newPath);
      newFileLink = publicUrlData.publicUrl;
    }

    // 7. Update database record
    const { data: updatedDoc, error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        name: cleanNewName,
        file_link: newFileLink
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) {
      // Revert the storage move to keep consistency
      await supabaseAdmin.storage.from(bucket).move(newPath, oldPath);
      throw updateError;
    }

    // 8. Cascade update in draft_operations of other documents
    const { data: allDocs, error: allDocsError } = await supabaseAdmin
      .from("documents")
      .select("id, draft_operations")
      .not("draft_operations", "is", null);

    if (!allDocsError && allDocs) {
      for (const doc of allDocs) {
        if (Array.isArray(doc.draft_operations)) {
          let changed = false;
          const updatedOps = doc.draft_operations.map((op: any) => {
            if (op.bucket === bucket && op.path === oldPath) {
              changed = true;
              return { ...op, path: newPath };
            }
            return op;
          });

          if (changed) {
            console.log(`Updating draft references in document ID: ${doc.id}`);
            await supabaseAdmin
              .from("documents")
              .update({ draft_operations: updatedOps })
              .eq("id", doc.id);
          }
        }
      }
    }

    // 9. Add Audit Trail Log
    await supabaseAdmin.from("audit_documents").insert({
      document_id: documentId,
      user_id: user.id,
      action: `RENAME: ${docData.name} -> ${cleanNewName}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        document: updatedDoc,
        file_link: newFileLink
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
