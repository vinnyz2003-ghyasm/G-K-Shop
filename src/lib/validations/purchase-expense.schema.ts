import { z } from "zod";
import { isValidISODate, isFutureIST } from "@/lib/utils/date";

const isoDate = z
  .string()
  .refine(isValidISODate, { message: "Date must be YYYY-MM-DD" })
  .refine((d) => !isFutureIST(d), { message: "Date can't be in the future (IST)" });

export const purchaseSchema = z.object({
  purchase_date: isoDate,
  product_id: z.string().min(1, "Select a product"),
  supplier_name: z.string().min(1, "Supplier name is required").max(100),
  qty: z.coerce.number().int().positive("Qty must be at least 1"),
  unit_cost: z.coerce.number().min(0, "Must be ≥ 0"),
  payment_status: z.enum(["Paid", "Pending"]),
  notes: z.string().max(280).optional(),
});
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const expenseSchema = z.object({
  expense_date: isoDate,
  category: z.enum([
    "Rent","Electricity","Staff Salary","Wastage / Expiry",
    "Packaging","Miscellaneous","Transport","Maintenance",
  ]),
  description: z.string().max(280).optional(),
  amount: z.coerce.number().positive("Amount must be > 0"),
  payment_mode: z.enum(["Cash","UPI","Bank Transfer","Card","N/A"]),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const udhaarPaymentSchema = z.object({
  customer_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be > 0"),
  entry_date: isoDate,
  notes: z.string().max(280).optional(),
});
export type UdhaarPaymentInput = z.infer<typeof udhaarPaymentSchema>;
