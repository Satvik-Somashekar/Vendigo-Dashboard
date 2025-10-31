// src/pages/inventory.tsx
import { useEffect, useState } from "react";
import { RefreshCw, Check, X, Package, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMachines,
  getInventory,
  getProducts,
  Machine,
  InventoryItem,
  Product,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";

// derive API base (same logic as other pages)
const rawBase = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const API_BASE = rawBase.endsWith("/") ? `${rawBase}api` : `${rawBase}/api`;

export default function Inventory() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [restockForm, setRestockForm] = useState({ productId: "", quantity: "" });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadMachines();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      loadInventory(selectedMachine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  // --- helpers to normalize shapes returned by API ---
  function normalizeMachine(raw: any): Machine {
    const id = Number(raw?.machine_id ?? raw?.id ?? raw?.machineId ?? raw?.machine);
    const name = raw?.name ?? raw?.location ?? `Machine ${id}`;
    const location = raw?.location ?? raw?.description ?? "";
    return { id, name, location } as Machine;
  }

  function normalizeProduct(raw: any): Product {
    const id = Number(raw?.product_id ?? raw?.id ?? raw?.productId);
    const name = raw?.name ?? raw?.product_name ?? `Product ${id}`;
    const price = Number(raw?.price ?? raw?.unit_price ?? 0);
    return { id, name, price } as Product;
  }

  function normalizeInventoryItem(raw: any): InventoryItem {
    const id = Number(raw?.inv_id ?? raw?.id ?? raw?.invId ?? raw?.inventory_id);
    const product_name = raw?.product_name ?? raw?.name ?? raw?.productName ?? "";
    const price = Number(raw?.price ?? raw?.product_price ?? 0);
    const quantity = Number(raw?.qty ?? raw?.quantity ?? 0);
    return {
      id,
      product_name,
      price,
      quantity,
      raw,
    } as unknown as InventoryItem;
  }

  // --- loading functions ---
  const loadMachines = async () => {
    try {
      const data = await getMachines();
      const list = (data || []).map((m: any) => normalizeMachine(m));
      setMachines(list);
      if (list.length > 0) {
        setSelectedMachine((prev) => prev ?? list[0].id);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load machines", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      const list = (data || []).map((p: any) => normalizeProduct(p));
      setProducts(list);
    } catch (error) {
      console.error("Failed to load products", error);
    }
  };

  const loadInventory = async (machineId: number) => {
    try {
      const data = await getInventory(machineId);
      const list = (data || []).map((i: any) => normalizeInventoryItem(i));
      setInventory(list);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load inventory", variant: "destructive" });
    }
  };

  // --- editing row handlers ---
  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditQuantity(item.quantity ?? 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuantity(0);
  };

  const saveEdit = async () => {
    if (!editingId || !selectedMachine) return;
    const qty = parseInt(String(editQuantity || 0), 10);
    if (isNaN(qty) || qty < 0) {
      toast({ title: "Validation", description: "Quantity must be a non-negative integer", variant: "destructive" });
      return;
    }

    try {
      // direct API call to ensure correct URL and payload
      const res = await fetch(`${API_BASE}/inventory/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty }),
      });

      const text = await res.text().catch(() => "");
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

      if (!res.ok) {
        const errMsg = (json && (json.error || json.message)) || text || `Status ${res.status}`;
        throw new Error(errMsg);
      }

      setEditingId(null);
      await loadInventory(selectedMachine);
      toast({ title: "Success", description: "Inventory updated successfully" });
    } catch (err: any) {
      console.error("saveEdit error:", err);
      toast({ title: "Error", description: err?.message || "Failed to update inventory", variant: "destructive" });
    }
  };

  // --- REMOVE stock handler (delete capability) ---
  // This will delete the inventory row when removeAll is true, otherwise it sets qty to newQty.
  const handleRemove = async (item: InventoryItem) => {
    if (!item || !selectedMachine) return;

    // ask user whether to delete row or remove quantity
    const mode = window.prompt(
      `Remove stock from "${item.product_name}"\n` +
      `Type 'all' to DELETE the inventory row entirely.\n` +
      `Or enter the number of units to remove (empty = cancel):`,
      ""
    );

    if (mode === null) return; // cancelled

    const trimmed = mode.trim().toLowerCase();
    if (trimmed === "") return; // treat as cancel

    if (trimmed === "all") {
      // confirm delete
      const conf = window.confirm(`Permanently delete inventory row for "${item.product_name}"? This cannot be undone.`);
      if (!conf) return;

      try {
        const res = await fetch(`${API_BASE}/inventory/${item.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        const text = await res.text().catch(() => "");
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

        if (!res.ok) {
          const errMsg = (json && (json.error || json.message)) || text || `Status ${res.status}`;
          throw new Error(errMsg);
        }

        await loadInventory(selectedMachine);
        toast({ title: "Success", description: `Inventory row deleted for ${item.product_name}` });
      } catch (err: any) {
        console.error("delete error:", err);
        toast({ title: "Error", description: err?.message || "Failed to delete inventory", variant: "destructive" });
      }

      return;
    }

    // otherwise assume number to remove
    const removeQty = parseInt(trimmed, 10);
    if (isNaN(removeQty) || removeQty < 0) {
      toast({ title: "Validation", description: "Invalid remove quantity", variant: "destructive" });
      return;
    }

    const newQty = Math.max(0, (item.quantity ?? 0) - removeQty);

    try {
      const res = await fetch(`${API_BASE}/inventory/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: newQty }),
      });

      const text = await res.text().catch(() => "");
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }

      if (!res.ok) {
        const errMsg = (json && (json.error || json.message)) || text || `Status ${res.status}`;
        throw new Error(errMsg);
      }

      await loadInventory(selectedMachine);
      toast({ title: "Success", description: `Removed ${removeQty} units. New qty: ${newQty}` });
    } catch (err: any) {
      console.error("handleRemove error:", err);
      toast({ title: "Error", description: err?.message || "Failed to remove stock", variant: "destructive" });
    }
  };

  // --- RESTOCK: send keys backend expects: machine_id, product_id, qty ---
  const handleRestock = async () => {
    if (!selectedMachine) {
      toast({ title: "Error", description: "Select a machine first", variant: "destructive" });
      return;
    }

    const productId = parseInt(restockForm.productId, 10);
    const qty = parseInt(restockForm.quantity, 10);

    if (!productId || isNaN(productId) || !qty || isNaN(qty) || qty <= 0) {
      toast({ title: "Error", description: "Enter a valid product and positive quantity", variant: "destructive" });
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machine_id: selectedMachine,
          product_id: productId,
          qty: qty,
        }),
      });

      const txt = await resp.text().catch(() => "");
      let json: any = null;
      try { json = txt ? JSON.parse(txt) : null; } catch { /* not JSON */ }

      if (!resp.ok) {
        const message = (json && (json.error || json.message)) || txt || `Status ${resp.status}`;
        throw new Error(message);
      }

      setRestockForm({ productId: "", quantity: "" });
      await loadInventory(selectedMachine);
      toast({ title: "Success", description: "Inventory restocked successfully" });
    } catch (error: any) {
      console.error("restock error", error);
      const msg = error?.message || "Failed to restock inventory";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading inventory...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <p className="text-muted-foreground mt-1">Manage stock levels across machines</p>
      </div>

      <Card className="glass p-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Select Machine</h2>

          <Select
            value={selectedMachine?.toString() ?? ""}
            onValueChange={(value) => setSelectedMachine(Number(value))}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Select a machine" />
            </SelectTrigger>

            <SelectContent>
              {machines.map((machine) => (
                <SelectItem key={machine.id} value={String(machine.id)}>
                  {machine.name} {machine.location ? `- ${machine.location}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selectedMachine && (
        <>
          <Card className="glass p-6">
            <h2 className="text-lg font-semibold mb-4">Restock Product</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                value={restockForm.productId}
                onValueChange={(value) => setRestockForm({ ...restockForm, productId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>

                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Quantity"
                value={restockForm.quantity}
                onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                min={1}
              />

              <Button onClick={handleRestock} className="gradient-primary">
                <Package className="h-4 w-4 mr-2" />
                Restock
              </Button>
            </div>
          </Card>

          <Card className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium">Product</th>
                    <th className="px-6 py-4 text-left text-sm font-medium">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-medium">Stock Quantity</th>
                    <th className="px-6 py-4 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/50">
                  {inventory.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">{item.product_name}</td>
                      <td className="px-6 py-4">${Number(item.price ?? 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {editingId === item.id ? (
                          <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            className="max-w-xs"
                          />
                        ) : (
                          <span className={item.quantity < 5 ? "text-destructive font-semibold" : ""}>
                            {item.quantity} {item.quantity < 5 && "⚠️ Low stock"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === item.id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={saveEdit}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemove(item)}
                              title="Remove or delete stock"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
