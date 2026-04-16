export type Producto = {
  id: string;
  name: string;
  image_url: string | null;
  quantity: number;
  created_at: string;
};

export type Movimiento = {
  id: string;
  product_id: string;
  type: "add" | "remove";
  quantity: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
};
