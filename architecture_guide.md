# Supermarket Demo: Architecture & Integration Guide

This guide explains how the Admin Dashboard and Expo Mobile App work together, specifically focusing on data synchronization and asset management.

## 1. Product Image Management
Images for products are no longer just emojis; they are real image files.

### 🗺️ Storage Location
- **System**: Supabase Storage
- **Project URL**: `https://ezcfulijxtfglpfarxtl.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y2Z1bGlqeHRmZ2xwZmFyeHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDkwNzYsImV4cCI6MjA5MTk4NTA3Nn0.6mRjNCZIlE5Y9LOYwCXxVXczqflL3YiF6QxbvcszTJ0`
- **Bucket**: `product-images`
- **Visibility**: Public (Anyone with the link can view)
- **Database Field**: `products.image_url` (Contains the full public URL to the image)

### 📱 Expo Implementation
To show these images in the React Native app:
1. **Fetching**: The `products` table query now returns `image_url`.
2. **Component**: Use the standard `Image` component from `react-native`.
3. **Fallback**: Always implement a fallback (like a default icon or the existing `emoji` field) if `image_url` is null.

```javascript
// Example in Expo
<Image 
  source={{ uri: product.image_url || 'https://fallback-url.com' }} 
  style={styles.productImage} 
/>
```

## 2. Order Synchronization & Notifications
The Admin panel and Expo app communicate in real-time via Supabase.

### 🔔 Order Flow
1. **Creation**: The Expo app inserts a record into the `orders` table.
2. **Admin Alert**: The Admin Dashboard listens to the `orders` table using `supabase.channel()`. It shows a real-time badge and live-reloads the list.
3. **Status Update**: Admins can change order status (e.g., `Pending` -> `Preparing` -> `Out for Delivery`).
4. **User Notification**:
   - The Expo app should subscribe to its own orders: `.from('orders').on('UPDATE', ...)`.
   - When the status changes, the app can trigger a local notification or update the UI instantly.

## 3. Marketing & Banners
The Home Screen banners are dynamic and managed in the Admin panel.

### 🎨 Logic
- **Storage**: `app_settings` table where `key = 'banners'`.
- **Format**: A JSON array of banner objects `{ id, title, subtitle, emoji, color, image_url, ... }`.
- **Integration**: The Expo app should fetch this record on app launch to render the top carousel.
- **Visual Editor**: The Admin panel now provides a "Figma-like" visual editor instead of raw JSON, allowing admins to see exactly what the user will see.

## 4. Overall Integration Strategy
The "source of truth" is the Supabase database. 
- **Admin Panel**: The management layer (Web, Vite).
- **Expo App**: The consumption layer (Mobile, React Native).
- **Shared Schemas**: Both apps must refer to the same table structures: `products`, `orders`, `profiles`, and `app_settings`.
- **Security**: Both use the same `check_is_admin()` SQL function to verify permissions via Row Level Security (RLS).

## 5. Category Management
Categories are no longer hardcoded in the mobile app; they are fully dynamic and data-driven.

### 🗂️ Logic
- **Storage**: `app_settings` table where `key = 'categories'`.
- **Format**: A JSON array of category objects, for example: `[{"id": "dairy", "label": "Dairy", "emoji": "🥛"}, ...]`.
- **Integration**: The mobile app fetches this configuration (e.g., in `HomeScreen` and `ShopScreen`) to display dynamic category tiles. If the key is missing, it falls back to hardcoded defaults.
- **Admin Setup**: The admin panel should provide a visual way to manage this list, allowing admins to add, edit, or remove categories (name, ID, and emoji) directly from the `app_settings` table.
