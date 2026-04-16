import Link from "next/link";
import { agregarProductoAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AgregarProductoPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <AppShell
      currentPath="/agregar-producto"
      action={
        <Link className="btn-secondary" href="/">
          Inventario
        </Link>
      }
    >
      <main className="panel p-5 md:p-6">
        <form action={agregarProductoAction} className="space-y-4">
          {error ? <p className="status-error">{error}</p> : null}
          <div>
            <label className="label" htmlFor="name">
              Nombre
            </label>
            <input className="field" id="name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="image">
              Imagen
            </label>
            <input
              accept="image/*"
              className="field"
              id="image"
              name="image"
              required
              type="file"
            />
          </div>
          <div>
            <label className="label" htmlFor="quantity">
              Cantidad inicial
            </label>
            <input
              className="field"
              defaultValue={0}
              id="quantity"
              min={0}
              name="quantity"
              required
              type="number"
            />
          </div>
          <button className="btn-primary" type="submit">
            Guardar
          </button>
        </form>
      </main>
    </AppShell>
  );
}
