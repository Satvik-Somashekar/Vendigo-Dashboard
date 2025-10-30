// Smart Vending API Backend (CommonJS version)

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Setup MySQL connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ✅ Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "API is running successfully!" });
});

// ======================= PRODUCTS =======================

// Get all products
app.get("/api/products", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM products");
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
    // FK/triggers may block this — return message to UI
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

app.get("/api/inventory/:machineId", async (req, res, next) => {
  try {
    const mId = +req.params.machineId;
    const [rows] = await pool.query(
      `SELECT i.inv_id, i.machine_id, i.product_id, p.name AS product_name, p.price, i.qty
       FROM inventory i JOIN products p ON p.product_id = i.product_id
       WHERE i.machine_id = ? ORDER BY p.name`,
      [mId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

app.put("/api/inventory/:invId", async (req, res, next) => {
  try {
    const invId = +req.params.invId;
    const { qty } = req.body;
    if (qty == null || isNaN(qty)) {
      return res.status(400).json({ error: "qty required" });
    }
    await pool.query("UPDATE inventory SET qty=? WHERE inv_id=?", [qty, invId]);
    const [row] = await pool.query(
      `SELECT i.inv_id, i.machine_id, i.product_id, p.name AS product_name, p.price, i.qty
       FROM inventory i JOIN products p ON p.product_id = i.product_id WHERE inv_id=?`,
      [invId]
    );
    res.json(row[0]);
  } catch (e) { next(e); }
});

app.post("/api/inventory", async (req, res, next) => {
  try {
    const { machine_id, product_id, qty } = req.body;
    if (!machine_id || !product_id || !qty) {
      return res.status(400).json({ error: "machine_id, product_id, qty required" });
    }
    await pool.query(
      `INSERT INTO inventory(machine_id, product_id, qty, last_restock)
       VALUES (?,?,?,NOW())
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), last_restock = NOW()`,
      [machine_id, product_id, qty]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ======================= METRICS & ANALYTICS =======================

// Dashboard Metrics (₹ rupees, sales-aware)
app.get("/api/metrics", async (req, res, next) => {
  try {
    const [[{ total_products }]] = await pool.query(
      "SELECT COUNT(*) AS total_products FROM products"
    );

    const [[{ total_machines }]] = await pool.query(
      "SELECT COUNT(*) AS total_machines FROM machines"
    );

    const [[{ total_stock_quantity }]] = await pool.query(
      "SELECT COALESCE(SUM(qty),0) AS total_stock_quantity FROM inventory"
    );

    const [[{ total_stock_value }]] = await pool.query(`
      SELECT COALESCE(SUM(i.qty * p.price),0) AS total_stock_value
      FROM inventory i
      JOIN products p ON p.product_id = i.product_id
    `);

    const [[{ total_revenue }]] = await pool.query(
      "SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM sales"
    );

    const [[{ total_sales_count }]] = await pool.query(
      "SELECT COUNT(*) AS total_sales_count FROM sales"
    );

    const [top_selling_products] = await pool.query(`
      SELECT p.name AS product_name, COALESCE(SUM(si.qty), 0) AS total_sales
      FROM sale_items si
      JOIN products p ON p.product_id = si.product_id
      GROUP BY si.product_id, p.name
      ORDER BY total_sales DESC
      LIMIT 5
    `);

    res.json({
      total_products,
      total_machines,
      total_stock_quantity,
      total_stock_value: Number(total_stock_value) || 0,
      total_revenue: Number(total_revenue) || 0,
      total_sales_count,
      top_selling_products: top_selling_products.map(row => ({
        product_name: row.product_name,
        total_sales: Number(row.total_sales) || 0,
      })),
    });
  } catch (e) { next(e); }
});

// Revenue Trend: last 7 days (₹)
app.get("/api/revenue-trend", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE(sale_time) AS date,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM sales
      WHERE sale_time >= CURDATE() - INTERVAL 7 DAY
      GROUP BY DATE(sale_time)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// ------ Basic error handler ------
app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🟢 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
