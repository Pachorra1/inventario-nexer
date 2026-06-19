"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { actualizarProductoAction, guardarMovimientoAction } from "@/app/actions";
import type { Producto } from "@/lib/types";

type InventarioBoardProps = {
  products: Producto[];
  supportsSortOrder: boolean;
};

async function downloadPdf() {
  const response = await fetch("/api/productos/pdf", {
    method: "GET",
    headers: {
      Accept: "application/pdf",
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo generar el PDF");
  }

  const blob = await response.blob();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `Inventario Insumos ${dateStamp}.pdf`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function saveOrder(ids: string[]) {
  const response = await fetch("/api/productos/reorder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar el nuevo orden");
  }
}

const LOCAL_ORDER_KEY = "inventario-nexer-order";

function getOrderedProducts(products: Producto[], supportsSortOrder: boolean) {
  if (supportsSortOrder) {
    return products;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_ORDER_KEY);
    if (!stored) {
      return products;
    }

    const storedIds = JSON.parse(stored) as string[];
    if (!Array.isArray(storedIds)) {
      return products;
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    const reordered = storedIds
      .map((id) => byId.get(id))
      .filter((product): product is Producto => Boolean(product));
    const remaining = products.filter((product) => !storedIds.includes(product.id));

    return [...reordered, ...remaining];
  } catch {
    return products;
  }
}

export function InventarioBoard({ products, supportsSortOrder }: InventarioBoardProps) {
  const [query, setQuery] = useState("");
  const [orderedProducts, setOrderedProducts] = useState(products);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previousRectsRef = useRef(new Map<string, DOMRect>());

  useEffect(() => {
    setOrderedProducts(getOrderedProducts(products, supportsSortOrder));
  }, [products, supportsSortOrder]);

  useLayoutEffect(() => {
    const previousRects = previousRectsRef.current;
    if (previousRects.size === 0) {
      return;
    }

    const animations: Animation[] = [];

    orderedProducts.forEach((product) => {
      const element = cardRefs.current.get(product.id);
      const previous = previousRects.get(product.id);

      if (!element || !previous) {
        return;
      }

      const next = element.getBoundingClientRect();
      const deltaX = previous.left - next.left;
      const deltaY = previous.top - next.top;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const animation = element.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(${product.id === draggedId ? 1.03 : 1})`,
          },
          {
            transform: "translate(0, 0) scale(1)",
          },
        ],
        {
          duration: 240,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        }
      );

      animations.push(animation);
    });

    previousRectsRef.current = new Map();

    return () => {
      animations.forEach((animation) => animation.cancel());
    };
  }, [orderedProducts, draggedId]);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleProducts = useMemo(() => {
    if (!normalizedQuery) {
      return orderedProducts;
    }

    return orderedProducts.filter((product) => {
      const searchable = `${product.name} ${product.code}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, orderedProducts]);

  const totalQuantity = useMemo(
    () => visibleProducts.reduce((sum, product) => sum + product.quantity, 0),
    [visibleProducts]
  );

  function swapProducts(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    const sourceIndex = orderedProducts.findIndex((product) => product.id === sourceId);
    const targetIndex = orderedProducts.findIndex((product) => product.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextProducts = [...orderedProducts];
    const [sourceProduct] = nextProducts.splice(sourceIndex, 1);
    nextProducts.splice(targetIndex, 0, sourceProduct);

    const previousProducts = orderedProducts;
    const rects = new Map<string, DOMRect>();
    orderedProducts.forEach((product) => {
      const element = cardRefs.current.get(product.id);
      if (element) {
        rects.set(product.id, element.getBoundingClientRect());
      }
    });
    previousRectsRef.current = rects;
    setOrderedProducts(nextProducts);
    setIsSavingOrder(true);

    void (async () => {
      try {
        if (supportsSortOrder) {
          await saveOrder(nextProducts.map((product) => product.id));
          setStatus("Orden guardado");
        } else {
          window.localStorage.setItem(
            LOCAL_ORDER_KEY,
            JSON.stringify(nextProducts.map((product) => product.id))
          );
          setStatus("Orden guardado en este navegador");
        }
      } catch {
        setStatus("No se pudo guardar el orden");
        setOrderedProducts(previousProducts);
      } finally {
        setIsSavingOrder(false);
      }
    })();
  }

  function handleDrop(targetId: string) {
    if (!reorderMode || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setHoveredId(null);
      return;
    }

    swapProducts(draggedId, targetId);
    setDraggedId(null);
    setHoveredId(null);
  }

  function handleDragEnter(targetId: string) {
    if (!reorderMode || !draggedId || draggedId === targetId || hoveredId === targetId) {
      return;
    }

    setHoveredId(targetId);
    swapProducts(draggedId, targetId);
  }

  function toggleReorderMode() {
    setReorderMode((current) => !current);
    setDraggedId(null);
    setHoveredId(null);
    setStatus(null);
  }

  return (
    <section className="space-y-4">
      <div className="panel border border-[var(--border)] bg-white/90 p-4 shadow-[0_12px_32px_rgba(16,42,32,0.08)] backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <div>
            <label className="label" htmlFor="search-toners">
              Buscar toner
            </label>
            <input
              className="field"
              id="search-toners"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por modelo o codigo"
              value={query}
            />
          </div>

          <button
            className="btn-secondary lg:w-auto lg:self-end"
            disabled={isDownloading}
            onClick={() => {
              if (isDownloading) {
                return;
              }

              setStatus(null);
              setIsDownloading(true);

              void (async () => {
                try {
                  await downloadPdf();
                  setStatus("PDF descargado");
                } catch {
                  setStatus("No se pudo descargar el PDF");
                } finally {
                  setIsDownloading(false);
                }
              })();
            }}
            type="button"
          >
            Exportar PDF
          </button>

          <button
            className={
              reorderMode
                ? "btn-primary lg:w-auto lg:self-end"
                : "btn-secondary lg:w-auto lg:self-end"
            }
            disabled={isSavingOrder}
            onClick={toggleReorderMode}
            type="button"
          >
            {reorderMode ? "Salir de ordenar" : "Modo ordenar"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span>{visibleProducts.length} toners visibles</span>
          <span>-</span>
          <span>{totalQuantity} unidades visibles</span>
          {reorderMode ? (
            <>
              <span>-</span>
              <span>Arrastra y suelta para cambiar el orden</span>
            </>
          ) : null}
        </div>

        {status ? <p className="mt-3 status-ok">{status}</p> : null}
      </div>

      {visibleProducts.length === 0 ? (
        <section className="panel p-6">
          <p className="text-[var(--muted)]">
            No hay toners que coincidan con esa busqueda.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((producto) => {
            const isDragging = draggedId === producto.id;
            const isHoverTarget = hoveredId === producto.id && draggedId !== producto.id;

            return (
              <article
                className={`panel overflow-hidden transition-all duration-200 ease-out ${
                  reorderMode ? "cursor-grab" : ""
                } ${isDragging ? "scale-[1.02] opacity-70 shadow-[0_18px_36px_rgba(16,42,32,0.18)]" : ""} ${
                  isHoverTarget ? "ring-2 ring-dashed ring-[var(--accent)]" : ""
                }`}
                draggable={reorderMode}
                key={producto.id}
                ref={(node) => {
                  if (node) {
                    cardRefs.current.set(producto.id, node);
                  } else {
                    cardRefs.current.delete(producto.id);
                  }
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setHoveredId(null);
                }}
                onDragEnter={() => handleDragEnter(producto.id)}
                onDragOver={(event) => {
                  if (reorderMode) {
                    event.preventDefault();
                  }
                }}
                onDrop={() => handleDrop(producto.id)}
                onDragStart={() => {
                  if (reorderMode) {
                    previousRectsRef.current = new Map();
                    setDraggedId(producto.id);
                    setHoveredId(producto.id);
                  }
                }}
              >
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
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-xl font-extrabold tracking-tight text-[#103126]">
                          {producto.name}
                        </h2>
                        {reorderMode ? (
                          <span className="rounded-full bg-[#edf9f4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#0d5e44]">
                            Arrastrar
                          </span>
                        ) : null}
                      </div>
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
                        <select
                          className="field"
                          defaultValue="add"
                          id={`type-${producto.id}`}
                          name="type"
                        >
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
            );
          })}
        </section>
      )}
    </section>
  );
}
