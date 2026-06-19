import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Movimiento } from "@/lib/types";

export const dynamic = "force-dynamic";

function resolverNombreProducto(movimiento: Movimiento) {
  const relacion = movimiento.products;
  if (!relacion) return "Producto";
  return Array.isArray(relacion) ? relacion[0]?.name || "Producto" : relacion.name;
}

export default async function HistorialPage() {
  const supabase = getSupabaseServerClient();

  const movementsResponse = await supabase
    .from("movements")
    .select("id, product_id, type, quantity, reason, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(50);

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
