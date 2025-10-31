# Vendigo

Vendigo is a vending machine management system I am building. It helps manage products, machines, and stock in a simple way. Everything runs locally with a backend and a frontend.

This project is useful for people who want to control vending machines or test the idea on campus, offices, gyms, or public areas.

---

## What Vendigo Does

- Add and manage products
- Keep track of stock in each machine
- Restock machines
- See live inventory data in charts
- View total products, machines, and inventory value in one place

Right now, it handles inventory management. I will add sales tracking and revenue features next.

---

## Tech Used

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts (for charts)

Backend:
- Node.js (Express)
- MySQL

---

## Folder Structure

vendigo/
├── smart-vending-api # Backend
├── vendigo-admin-main # Frontend
└── README.md

---

## How to Run the Backend

1. Go to the backend folder:

cd smart-vending-api
npm install

2. Create a file named .env and add this:

DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=yourpassword
DB_NAME=smart_vend
PORT=3000


3. Start the backend:

npm run dev

## How to Run the Frontend

1. Go to the frontend folder:

cd vendigo-admin
npm install


2. Create a file named .env.local and add this:

VITE_API_URL=http://localhost:3000/api


3. Start the frontend:

npm run dev


## The frontend will run on http://localhost:8080 and backend on http://localhost:3000.


## Features I Have Completed

* Products page
* Machines list
* Inventory control
* Graphs that update by machine
* Dashboard with totals
* Pie chart containing products

---

## What I Will Add Next

* Sales tracking
* Revenue chart
* Low stock alerts

---

## Why I Built This

I wanted to create a full-stack system that feels real, not just another demo. Most vending systems online are paid or restricted. Vendigo is something I want to own, customize, and use for business later.

---

## Author

Built by **Satvik Somashekar**

---


