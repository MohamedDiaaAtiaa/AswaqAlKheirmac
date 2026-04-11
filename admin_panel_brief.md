# Brief: Supermarket App Admin Panel

## Project Context
We are building a premium supermarket mobile application ("FreshMart") using **Expo (React Native)** and **Supabase**. The core mobile app is functional and fetches its product catalogue and app settings from a Supabase PostgreSQL database.

**Your Goal**: Build a professional, web-based (or secondary React Native) Admin Dashboard that allows store managers to oversee the entire business.

---

## 🛠️ Technical Stack
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email/Password)
- **Role System**: Custom `is_admin` boolean on the `profiles` table.

---

## 🗄️ Database Schema & RLS

### 1. `profiles` Table
- `id` (UUID, PK)
- `full_name` (Text)
- `phone` (Text)
- `is_admin` (Boolean) - **Crucial**: Only users with `is_admin = true` can access administrative data.

### 2. `products` Table
- `id` (UUID, PK)
- `name` (Text)
- `emoji` (Text)
- `category` (Text)
- `description` (Text)
- `badge` (Text, Nullable)
- `sizes` (JSONB) - Array of objects: `[{"label": "1L", "price": 2.50}, ...]`
- `default_size` (Integer)
- `is_active` (Boolean) - For hiding/showing in the app.

### 3. `orders` & `order_items`
- `orders` stores customer info (`customer_name`, `customer_address`, `payment_method`, etc.).
- `order_items` links to `orders` and contains individual product snapshots (`product_name`, `price`, `quantity`).

### 4. `app_settings`
- Simple Key-Value store (`key` Text, `value` JSONB).
- **Key: `banners`**: Stores the array of promotional cards shown on the Home Screen.

---

## 🎯 Admin Dashboard Requirements

### 1. Product Management
- **View All**: Search and filter products by category.
- **Create/Edit**: Full form for all product fields, including adding/removing size variants dynamically.
- **Toggle Active**: Instantly show or hide a product from the shop.

### 2. Order Fulfillment
- **Incoming Orders**: Live list of new orders sorted by `created_at`.
- **Details**: View full recipient details and item breakdown.
- **Status Mapping**: (Optional) Add a status column to track `Pending`, `Packed`, `Dispatched`, `Delivered`.

### 3. User Management
- View list of registered customers.
- Ability to grant/revoke admin privileges.

### 4. App Control (Marketing)
- **Banner Editor**: Update the `app_settings('banners')` JSON. This allows the admin to change the Home Screen promo carousel without code changes.

---

## 🔐 Security Instructions
All tables have **Row Level Security (RLS)** enabled. Your application MUST authenticate with a user who has `is_admin = true` in their profile to perform any CRUD operations. The RLS policies verify this via:
`USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)`

---

## 💡 Style Guidelines
The Admin Panel should feel as premium as the mobile app. Use:
- Clean dashboards (Sidebar navigation).
- Clear data tables.
- Image/Emoji previews for products.
- Real-time updates where possible.

---

**Starting Point**: You have the Supabase URL and Anon Key. The tables are already created and seeded with 16 products.
Connection:
 URL: 'https://db.kymguooufnfewrnoaqhw.supabase.co',
 ANON KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWd1b291Zm5mZXdybm9hcWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTIyMzAsImV4cCI6MjA5MTMyODIzMH0.zMwIIENekDTzCB2C2fUb-BSTSwzKC1bLra_uTTYTmis'
