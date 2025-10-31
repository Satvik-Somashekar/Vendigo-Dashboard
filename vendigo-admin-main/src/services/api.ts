// src/lib/api.ts
const rawBase = import.meta.env.VITE_API_BASE || "http://localhost:3000";
export const API_BASE_URL = rawBase.endsWith("/") ? `${rawBase}api` : `${rawBase}/api`;

/**
 * Simple helper for fetch with JSON + error normalization
 */
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const defaultHeaders: Record<string,string> = { "Content-Type": "application/json" };

  // include token automatically if present in localStorage
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = token ? { ...defaultHeaders, Authorization: `Bearer ${token}` } : defaultHeaders;

  const res = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), ...headers } });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let msg = `Request failed ${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(txt);
      msg = j.message || j.error || msg;
    } catch {
      if (txt) msg = txt;
    }
    throw new Error(msg);
  }
  // try parse json otherwise return empty
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // @ts-ignore
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}

/* ---------- types ---------- */
export interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
}

export interface Machine {
  id: number;
  name: string;
  location: string;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

export interface DashboardMetrics {
  total_products: number;
  total_machines: number;
  total_stock_quantity: number;
  total_stock_value: number;
  top_selling_products: Array<{
    product_name: string;
    total_sales: number;
  }>;
}

/* ---------- Products API ---------- */
export const getProducts = async (): Promise<Product[]> => {
  const data = await request<any[]>("/products");
  return data.map((p) => ({
    id: p.id ?? p.product_id,
    name: p.name,
    price: Number(p.price ?? 0),
    unit: p.unit ?? p.u ?? "",
  }));
};

export const createProduct = async (product: Omit<Product, "id">): Promise<Product> => {
  const p = await request<any>("/products", {
    method: "POST",
    body: JSON.stringify(product),
  });
  return { id: p.id ?? p.product_id, name: p.name, price: Number(p.price ?? 0), unit: p.unit ?? "" };
};

export const updateProduct = async (id: number, product: Partial<Product>): Promise<void> => {
  await request<void>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(product),
  });
};

export const deleteProduct = async (id: number): Promise<void> => {
  await request<void>(`/products/${id}`, { method: "DELETE" });
};

/* ---------- Machines API ---------- */
export const getMachines = async (): Promise<Machine[]> => {
  const data = await request<any[]>("/machines");
  return data.map((m) => {
    const id = m.id ?? m.machine_id;
    return {
      id,
      name: m.name ?? m.description ?? `Machine ${id}`,
      location: m.location ?? m.address ?? "",
    };
  });
};

/* ---------- Inventory API ---------- */
export const getInventory = async (machineId: number): Promise<InventoryItem[]> => {
  const data = await request<any[]>(`/inventory/${machineId}`);
  return data.map((i) => ({
    id: i.id ?? i.inv_id ?? i.inventory_id,
    product_id: i.product_id ?? i.pid ?? i.productId,
    product_name: i.product_name ?? i.name ?? i.productName,
    quantity: Number(i.quantity ?? i.qty ?? 0),
    price: Number(i.price ?? i.unit_price ?? 0),
  }));
};

export const updateInventory = async (invId: number, quantity: number): Promise<void> => {
  await request<void>(`/inventory/${invId}`, {
    method: "PUT",
    body: JSON.stringify({ quantity }),
  });
};

export const restockInventory = async (machineId: number, productId: number, quantity: number): Promise<void> => {
  await request<void>("/inventory", {
    method: "POST",
    body: JSON.stringify({ machine_id: machineId, product_id: productId, quantity }),
  });
};

/* ---------- Dashboard API ---------- */
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  // try two common endpoint names just in case
  try {
    return await request<DashboardMetrics>("/dashboard-metrics");
  } catch (e) {
    // fallback endpoint name
    return await request<DashboardMetrics>("/dashboard/summary");
  }
};

/* ---------- helper to debug env ---------- */
export function debugApi() {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[api] API_BASE_URL =", API_BASE_URL);
  }
}
