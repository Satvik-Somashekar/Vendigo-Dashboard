// server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "API is running successfully!" });
});

// ======================= PRODUCTS =======================

// Get all products
app.get("/api/products", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products ORDER BY product_id");
    res.json(rows);
  } catch (e) { next(e); }
});

// Add a product
app.post("/api/products", async (req, res, next) => {
  try {
    const { name, price, unit } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: "Name and price are required" });
    }
    const [result] = await pool.query(
      "INSERT INTO products (name, price, unit) VALUES (?, ?, ?)",
      [name, price, unit || "pcs"]
    );
    res.json({ message: "Product added", product_id: result.insertId });
  } catch (e) { next(e); }
});

// Update a product
app.put("/api/products/:id", async (req, res, next) => {
  try {
    const { name, price, unit } = req.body;
    const id = req.params.id;
    await pool.query(
      "UPDATE products SET name = ?, price = ?, unit = ? WHERE product_id = ?",
      [name, price, unit, id]
    );
    res.json({ message: "Product updated" });
  } catch (e) { next(e); }
});

// Delete a product
app.delete("/api/products/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM products WHERE product_id = ?", [id]);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ======================= MACHINES =======================

app.get("/api/machines", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT machine_id, location, description FROM machines ORDER BY machine_id"
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ======================= INVENTORY =======================

// Get inventory for a machine
app.get("/api/inventory/:machineId", async (req, res, next) => {
  try {
    const mId = +req.params.machineId;
    const [rows] = await pool.query(
      `SELECT i.inv_id, i.machine_id, i.product_id, p.name AS product_name, p.price, i.qty
       FROM inventory i
       JOIN products p ON p.product_id = i.product_id
       WHERE i.machine_id = ? ORDER BY p.name`,
      [mId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Update inventory quantity for an inventory row
app.put("/api/inventory/:invId", async (req, res, next) => {
  try {
    const invId = +req.params.invId;
    const { qty } = req.body;
    if (qty == null || isNaN(qty)) {
      return res.status(400).json({ error: "qty required" });
    }
    await pool.query("UPDATE inventory SET qty = ? WHERE inv_id = ?", [qty, invId]);
    const [row] = await pool.query(
      `SELECT i.inv_id, i.machine_id, i.product_id, p.name AS product_name, p.price, i.qty
       FROM inventory i JOIN products p ON p.product_id = i.product_id WHERE inv_id = ?`,
      [invId]
    );
    res.json(row[0]);
  } catch (e) { next(e); }
});

// Add / restock inventory (machine_id, product_id, qty) — upsert add qty
app.post("/api/inventory", async (req, res, next) => {
  try {
    const { machine_id, product_id, qty } = req.body;
    if (!machine_id || !product_id || qty == null) {
      return res.status(400).json({ error: "machine_id, product_id, qty required" });
    }
    await pool.query(
      `INSERT INTO inventory (machine_id, product_id, qty, last_restock)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE qty = COALESCE(qty,0) + VALUES(qty), last_restock = NOW()`,
      [machine_id, product_id, qty]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Delete an inventory row (permanent)
app.delete("/api/inventory/:invId", async (req, res, next) => {
  try {
    const invId = +req.params.invId;
    if (!invId) return res.status(400).json({ error: "invId required" });
    await pool.query("DELETE FROM inventory WHERE inv_id = ?", [invId]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ======================= METRICS & ANALYTICS =======================

// Dashboard metrics (rich)
app.get("/api/metrics", async (req, res, next) => {
  try {
    const [[{ total_products }]] = await pool.query("SELECT COUNT(*) AS total_products FROM products");
    const [[{ total_machines }]] = await pool.query("SELECT COUNT(*) AS total_machines FROM machines");
    const [[{ total_stock_quantity }]] = await pool.query("SELECT COALESCE(SUM(qty),0) AS total_stock_quantity FROM inventory");
    const [[{ total_stock_value }]] = await pool.query(`
      SELECT COALESCE(SUM(i.qty * p.price),0) AS total_stock_value
      FROM inventory i
      JOIN products p ON p.product_id = i.product_id
    `);
    const [[{ total_revenue }]] = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM sales");
    const [[{ total_sales_count }]] = await pool.query("SELECT COUNT(*) AS total_sales_count FROM sales");

    const [top_selling_products] = await pool.query(`
      SELECT p.name AS product_name, COALESCE(SUM(si.qty), 0) AS total_sales
      FROM sale_items si
      JOIN products p ON p.product_id = si.product_id
      GROUP BY si.product_id, p.name
      ORDER BY total_sales DESC
      LIMIT 10
    `);

    res.json({
      total_products,
      total_machines,
      total_stock_quantity,
      total_stock_value: Number(total_stock_value) || 0,
      total_revenue: Number(total_revenue) || 0,
      total_sales_count,
      top_selling_products: (top_selling_products || []).map(r => ({ product_name: r.product_name, total_sales: Number(r.total_sales || 0) })),
    });
  } catch (e) { next(e); }
});

// Revenue trend (last 7 days)
app.get("/api/revenue-trend", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT DATE(sale_time) AS date, COALESCE(SUM(total_amount),0) AS revenue
      FROM sales
      WHERE sale_time >= CURDATE() - INTERVAL 7 DAY
      GROUP BY DATE(sale_time)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// Per-machine stock distribution: total qty and total value
app.get("/api/machine-distribution", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        m.machine_id,
        COALESCE(NULLIF(m.location, ''), NULLIF(m.description, ''), CONCAT('Machine ', m.machine_id)) AS machine_name,
        COALESCE(SUM(i.qty), 0) AS total_qty,
        COALESCE(SUM(i.qty * p.price), 0) AS total_value
      FROM machines m
      LEFT JOIN inventory i ON i.machine_id = m.machine_id
      LEFT JOIN products p ON p.product_id = i.product_id
      GROUP BY m.machine_id, machine_name
      ORDER BY total_qty DESC
    `);

    const out = (rows || []).map(r => ({
      machine_id: r.machine_id,
      machine_name: r.machine_name,
      total_qty: Number(r.total_qty || 0),
      total_value: Number(r.total_value || 0),
    }));

    res.json(out);
  } catch (e) { next(e); }
});

// Compatibility route for older frontend expecting different keys
app.get("/api/dashboard-metrics", async (req, res, next) => {
  try {
    const [[{ total_products }]] = await pool.query("SELECT COUNT(*) AS total_products FROM products");
    const [[{ total_machines }]] = await pool.query("SELECT COUNT(*) AS total_machines FROM machines");
    const [[{ total_stock_quantity }]] = await pool.query("SELECT COALESCE(SUM(qty),0) AS total_stock_quantity FROM inventory");
    const [[{ total_stock_value }]] = await pool.query(`
      SELECT COALESCE(SUM(i.qty * p.price),0) AS total_stock_value
      FROM inventory i
      JOIN products p ON p.product_id = i.product_id
    `);
    res.json({
      totalProducts: total_products,
      activeMachines: total_machines,
      itemsInStock: total_stock_quantity,
      stockValue: Number(total_stock_value) || 0
    });
  } catch (e) { next(e); }
});

// ------ Basic error handler ------
app.use((err, req, res, next) => {
  console.error("ERROR:", err && err.message ? err.message : err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
