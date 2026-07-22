import { z } from "zod";

export const productSchema = z.object({
  product_id: z
    .string()
    .min(1, "Product ID is required")
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, hyphens, underscores"),
  name: z.string().min(1, "Name is required").max(120),
  upc_barcode: z.string().max(30).optional().nullable(),
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  cost_price: z.coerce.number().min(0, "Must be ≥ 0"),
  selling_price: z.coerce.number().min(0, "Must be ≥ 0"),
  reorder_level: z.coerce.number().int().min(0, "Must be ≥ 0"),
  current_stock: z.coerce.number().int().min(0, "Must be ≥ 0"),
  is_active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const CATEGORIES = [
  "Staples (Atta, Rice, Oil)",
  "Beverages (Tea, Coffee, Juices)",
  "Snacks & Packaged Foods",
  "Personal Care (Soaps, Shampoos)",
  "Household Supplies (Cleaners)",
  "Dairy & Bakery",
  "Fruits & Vegetables",
  "Frozen Foods",
  "Baby Products",
  "Medicines & Health",
  "Stationery",
  "Miscellaneous",
] as const;

export const UNITS = ["Pc", "Kg", "g", "L", "ml", "Pack", "Box", "Dozen", "Pair"] as const;
