import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Archivo no encontrado" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const fileName = `${Date.now()}-${file.name}`;

    const { data, error } = await supabase.storage
      .from("INIT_FILES")
      .upload(fileName, file, {
        contentType: file.type,
      });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("INIT_FILES")
      .getPublicUrl(data.path);

    return Response.json({
      success: true,
      path: data.path,
      url: publicUrl.publicUrl,
    });
  } catch (err) {
    return Response.json(
      {
        error: String(err),
      },
      { status: 500 }
    );
  }
});