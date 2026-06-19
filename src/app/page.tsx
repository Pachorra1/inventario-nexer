import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InventarioBoard } from "@/components/InventarioBoard";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Producto } from "@/lib/types";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

async function fetchProducts() {
  const supabase = getSupabaseServerClient();

  const orderedResponse = await supabase
    .from("products")
    .select("id, name, code, image_url, quantity, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!orderedResponse.error && orderedResponse.data) {
    return {
      products: orderedResponse.data as Producto[],
      supportsSortOrder: true,
    };
  }

  const fallbackResponse = await supabase
    .from("products")
    .select("id, name, code, image_url, quantity, created_at")
    .order("created_at", { ascending: true });

  if (fallbackResponse.error || !fallbackResponse.data) {
    return {
      products: [],
      supportsSortOrder: false,
    };
  }

  return {
    products: fallbackResponse.data.map((producto, index) => ({
      ...producto,
      sort_order: index,
    })) as Producto[],
    supportsSortOrder: false,
  };
}

export default async function InventarioPage({ searchParams }: Props) {
  const params = await searchParams;
  const { products: productos, supportsSortOrder } = await fetchProducts();
  const ok = typeof params.ok === "string" ? params.ok : "";
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <AppShell
      currentPath="/"
      action={
        <Link className="btn-primary" href="/">
          Inventario
        </Link>
      }
    >
      <main className="space-y-4">
        {ok ? <p className="status-ok">{ok}</p> : null}
        {error ? <p className="status-error">{error}</p> : null}
        <InventarioBoard products={productos} supportsSortOrder={supportsSortOrder} />
      </main>
    </AppShell>
  );
}
