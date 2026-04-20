"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStorageBucket, getSupabaseServerClient } from "@/lib/supabaseServer";

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getInt(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? Math.trunc(value) : NaN;
}

export async function agregarProductoAction(formData: FormData) {
  const name = getText(formData, "name");
  const codeRaw = getText(formData, "code");
  const code = codeRaw || null;
  const quantity = getInt(formData, "quantity");
  const file = formData.get("image");

  if (!name || Number.isNaN(quantity) || quantity < 0) {
    redirect("/agregar-producto?error=Datos+invalidos");
  }

  const supabase = getSupabaseServerClient();
  const bucket = getStorageBucket();

  let imageUrl: string | null = null;

  // 👇 SOLO sube imagen si existe
  if (file instanceof File && file.size > 0) {
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()
      : file.type.split("/").pop() || "jpg";

    const safeExt = (extension || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${crypto.randomUUID()}.${safeExt || "jpg"}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await supabase.storage.from(bucket).upload(path, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadResult.error) {
      redirect("/agregar-producto?error=No+se+pudo+subir+la+imagen");
    }

    imageUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const insertPayload: any = {
    name,
    quantity,
    ...(code ? { code } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  const insertResult = await supabase.from("products").insert(insertPayload);

  if (insertResult.error) {
    redirect("/agregar-producto?error=No+se+pudo+guardar+el+producto");
  }

  revalidatePath("/");
  revalidatePath("/historial");
  redirect("/?ok=Producto+agregado");
}

export async function guardarMovimientoAction(formData: FormData) {
  const productId = getText(formData, "product_id");
  const type = getText(formData, "type");
  const reason = getText(formData, "reason");
  const quantity = getInt(formData, "quantity");

  if (
    !productId ||
    !["add", "remove"].includes(type) ||
    Number.isNaN(quantity) ||
    quantity <= 0
  ) {
    redirect("/?error=Datos+invalidos");
  }

  const supabase = getSupabaseServerClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, quantity")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    redirect("/?error=Producto+invalido");
  }

  const newQuantity =
    type === "add" ? product.quantity + quantity : product.quantity - quantity;

  if (newQuantity < 0) {
    redirect("/?error=Stock+insuficiente");
  }

  const updateResult = await supabase
    .from("products")
    .update({ quantity: newQuantity })
    .eq("id", product.id);

  if (updateResult.error) {
    redirect("/?error=No+se+pudo+actualizar+el+stock");
  }

  const insertMovement = await supabase.from("movements").insert({
    product_id: product.id,
    type,
    quantity,
    reason: reason || "Sin motivo",
  });

  if (insertMovement.error) {
    redirect("/?error=No+se+pudo+guardar+el+movimiento");
  }

  revalidatePath("/");
  revalidatePath("/historial");
  redirect("/?ok=Movimiento+guardado");
}

export async function actualizarProductoAction(formData: FormData) {
  const productId = getText(formData, "product_id");
  const name = getText(formData, "name");
  const codeRaw = getText(formData, "code");
  const code = codeRaw || null;
  const file = formData.get("image");

  if (!productId || !name) {
    redirect("/?error=Completa+el+nombre");
  }

  const supabase = getSupabaseServerClient();
  const bucket = getStorageBucket();
  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    const extension = file.name.includes(".")
      ? file.name.split(".").pop()
      : file.type.split("/").pop() || "jpg";

    const safeExt = (extension || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${crypto.randomUUID()}.${safeExt || "jpg"}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await supabase.storage.from(bucket).upload(path, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadResult.error) {
      redirect("/?error=No+se+pudo+subir+la+nueva+imagen");
    }

    imageUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  const updatePayload: any = {
    name,
    ...(code !== null ? { code } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  const updateResult = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", productId);

  if (updateResult.error) {
    redirect("/?error=No+se+pudo+actualizar+el+producto");
  }

  revalidatePath("/");
  revalidatePath("/historial");
  redirect("/?ok=Producto+actualizado");
}