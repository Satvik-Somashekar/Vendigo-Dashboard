# Smart Vending Admin Panel - Frontend

A modern, dark-themed admin dashboard for managing vending machine operations built with React, TypeScript, and Tailwind CSS.

## Features

- 📊 **Real-time Dashboard** - Live metrics and analytics with interactive charts
- 🛍️ **Product Management** - Full CRUD operations with inline editing
- 📦 **Inventory Control** - Manage stock levels across multiple machines
- 🎨 **Modern Dark UI** - Professional SaaS-style interface with glass morphism effects
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS with custom design system
- **UI Components:** Shadcn/ui
- **Charts:** Recharts
- **Routing:** React Router v6
- **State Management:** React Query (TanStack Query)
- **Build Tool:** Vite

## Prerequisites

- Node.js 18+ and npm
- Backend API running at `http://localhost:3000`

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:8080`

## Backend Connection

The frontend connects to your Node.js/Express backend at `http://localhost:3000/api`.

### Required Backend Endpoints

Ensure your backend implements these endpoints:

- `GET /api/dashboard-metrics` - Dashboard statistics
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/machines` - List all machines
- `GET /api/inventory/:machineId` - Get machine inventory
- `PUT /api/inventory/:invId` - Update inventory quantity
- `POST /api/inventory` - Restock product

### API Configuration

The API base URL is configured in `src/services/api.ts`. To change it:

```typescript
const API_BASE_URL = 'http://localhost:3000/api';
```

## Project Structure

```
src/
├── components/
│   ├── dashboard/       # Dashboard-specific components
│   ├── layout/          # Layout components (Sidebar, etc.)
│   └── ui/             # Reusable UI components (shadcn)
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Products.tsx    # Product management
│   └── Inventory.tsx   # Inventory management
├── services/           # API service layer
│   └── api.ts         # API client functions
├── hooks/             # Custom React hooks
└── lib/               # Utility functions
```

## Design System

The app uses a carefully crafted dark theme with:

- **Primary Color:** Electric Blue (HSL: 199 89% 48%)
- **Accent Color:** Emerald Green (HSL: 142 76% 36%)
- **Backgrounds:** Deep slate with subtle gradients
- **Effects:** Glass morphism, glow effects, smooth transitions

All design tokens are defined in `src/index.css` and `tailwind.config.ts`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features Guide

### Dashboard Page
- View total products, machines, stock quantity, and stock value
- Interactive bar chart showing top-selling products
- Real-time metrics updates

### Products Page
- Add new products with name, price, and unit
- Inline editing of product details
- Delete products with confirmation dialog
- Sortable and filterable product table

### Inventory Page
- Select machine from dropdown
- View current stock levels per machine
- Inline quantity editing
- Restock products with quantity input
- Low stock warnings (< 5 items)

## Troubleshooting

### Backend Connection Issues

If you see "Failed to load" errors:

1. Ensure backend is running at `http://localhost:3000`
2. Check CORS is enabled on the backend
3. Verify all API endpoints are implemented
4. Check browser console for specific errors

### CORS Configuration (Backend)

Add to your Express backend:

```javascript
const cors = require('cors');
app.use(cors());
```

## Deployment

Build the production version:

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

## Contributing

This is a Lovable-generated project. To make changes:

1. Use the Lovable editor at https://lovable.dev
2. Or clone and edit locally, then push changes
3. Changes pushed to GitHub will sync with Lovable

## Support

For issues or questions:
- Check the [Lovable Documentation](https://docs.lovable.dev)
- Review API service code in `src/services/api.ts`
- Verify backend is running and endpoints are correct
