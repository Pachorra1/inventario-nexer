import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Movimiento, Producto } from "@/lib/types";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function resolverNombreProducto(movimiento: Movimiento) {
  const relacion = movimiento.products;
  if (!relacion) return "Producto";
  return Array.isArray(relacion) ? relacion[0]?.name || "Producto" : relacion.name;
}

export default async function HistorialPage({ searchParams }: Props) {
  const params = await searchParams;
  const selectedProduct = typeof params.product_id === "string" ? params.product_id : "";
  const supabase = getSupabaseServerClient();

  const [{ data: productsData }, movementsResponse] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, code, image_url, quantity, created_at")
      .order("name"),
    (selectedProduct
      ? supabase
          .from("movements")
          .select("id, product_id, type, quantity, reason, created_at, products(name)")
          .eq("product_id", selectedProduct)
      : supabase
          .from("movements")
          .select("id, product_id, type, quantity, reason, created_at, products(name)"))
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const products = (productsData || []) as Producto[];
  const movements = (movementsResponse.data || []) as Movimiento[];

  return (
    <AppShell
      currentPath="/historial"
      action={
        <Link className="btn-secondary" href="/">
          Inventario
        </Link>
      }
    >
      <main className="space-y-4">
        <section className="panel p-5 md:p-6">
          <form action="/historial" className="grid gap-4 md:max-w-md">
            <div>
              <label className="label" htmlFor="product_id">
                Filtrar por producto
              </label>
              <select className="field" defaultValue={selectedProduct} id="product_id" name="product_id">
                <option value="">Todos</option>
                {products.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" type="submit">
              Ver historial
            </button>
          </form>
        </section>

        <section className="panel overflow-hidden">
          <ul className="divide-y divide-[#e6ece9]">
            {movements.length === 0 ? (
              <li className="p-5 text-[var(--muted)]">No hay movimientos para mostrar.</li>
            ) : (
              movements.map((movimiento) => {
                const isAdd = movimiento.type === "add";
                const dateText = new Date(movimiento.created_at).toLocaleString("es-AR");

                return (
                  <li className="flex items-start justify-between gap-4 p-5" key={movimiento.id}>
                    <div>
                      <p className="font-semibold">{resolverNombreProducto(movimiento)}</p>
                      <p className="text-sm text-[var(--muted)]">
                        Motivo: {movimiento.reason || "Sin motivo"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">{dateText}</p>
                    </div>
                    <p className={isAdd ? "font-bold text-[#0d5e44]" : "font-bold text-[#962f2f]"}>
                      {isAdd ? "+" : "-"}
                      {movimiento.quantity}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
