import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ReorderPayload = {
  ids?: string[];
};

export async function POST(request: Request) {
  let payload: ReorderPayload;

  try {
    payload = (await request.json()) as ReorderPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No hay productos para ordenar" }, { status: 400 });
  }

  const uniqueIds = Array.from(new Set(ids));
  const supabase = getSupabaseServerClient();

  const updates = uniqueIds.map((id, index) =>
    supabase.from("products").update({ sort_order: index }).eq("id", id)
  );

  const results = await Promise.all(updates);
  const failure = results.find((result) => result.error);

  if (failure?.error) {
    return NextResponse.json(
      { error: "No se pudo guardar el nuevo orden" },
      { status: 500 }
    );
  }

  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
