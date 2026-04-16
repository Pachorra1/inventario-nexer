import Link from "next/link";
import Image from "next/image";
import { actualizarProductoAction, guardarMovimientoAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { Producto } from "@/lib/types";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function InventarioPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = getSupabaseServerClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, code, image_url, quantity, created_at")
    .order("created_at", { ascending: false });

  const productos = (data || []) as Producto[];
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
        {productos.length === 0 ? (
          <section className="panel p-6">
            <p className="text-[var(--muted)]">
              No hay productos todavia. Empeza usando el boton Agregar producto.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((producto) => (
              <article className="panel overflow-hidden" key={producto.id}>
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="relative h-44 w-full bg-[#e5ece9]">
                      <Image
                        alt={producto.name}
                        className="h-full w-full object-contain p-2"
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        src={producto.image_url || "/window.svg"}
                        unoptimized
                      />
                    </div>
                    <div className="space-y-1 p-4">
                      <h2 className="text-xl font-extrabold tracking-tight text-[#103126]">
                        {producto.name}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        Codigo: <span className="font-semibold">{producto.code}</span>
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Cantidad actual: <span className="font-semibold">{producto.quantity}</span>
                      </p>
                    </div>
                  </summary>

                  <div className="border-t border-[#e5ece9] p-4">
                    <details>
                      <summary className="inline-flex cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        Editar datos
                      </summary>
                      <form action={actualizarProductoAction} className="mt-3 space-y-3">
                        <input name="product_id" type="hidden" value={producto.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="label" htmlFor={`name-${producto.id}`}>
                              Nombre
                            </label>
                            <input
                              className="field"
                              defaultValue={producto.name}
                              id={`name-${producto.id}`}
                              name="name"
                              required
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`code-${producto.id}`}>
                              Codigo
                            </label>
                            <input
                              className="field"
                              defaultValue={producto.code}
                              id={`code-${producto.id}`}
                              name="code"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="label" htmlFor={`image-${producto.id}`}>
                            Imagen (opcional)
                          </label>
                          <input
                            accept="image/*"
                            capture="environment"
                            className="field"
                            id={`image-${producto.id}`}
                            name="image"
                            type="file"
                          />
                        </div>
                        <button className="btn-secondary" type="submit">
                          Guardar datos
                        </button>
                      </form>
                    </details>
                  </div>

                  <form action={guardarMovimientoAction} className="space-y-3 border-t border-[#e5ece9] p-4">
                    <input name="product_id" type="hidden" value={producto.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor={`quantity-${producto.id}`}>
                          Cantidad
                        </label>
                        <input
                          className="field"
                          defaultValue={1}
                          id={`quantity-${producto.id}`}
                          min={1}
                          name="quantity"
                          required
                          type="number"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`type-${producto.id}`}>
                          Tipo
                        </label>
                        <select className="field" defaultValue="add" id={`type-${producto.id}`} name="type">
                          <option value="add">Agregar</option>
                          <option value="remove">Quitar</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor={`reason-${producto.id}`}>
                        Motivo
                      </label>
                      <textarea className="field min-h-20" id={`reason-${producto.id}`} name="reason" />
                    </div>
                    <button className="btn-primary" type="submit">
                      Guardar
                    </button>
                  </form>
                </details>
              </article>
            ))}
          </section>
        )}
      </main>
    </AppShell>
  );
}
