import { z } from "zod";
import { isValidISODate, isFutureIST } from "@/lib/utils/date";

const isoDate = z
  .string()
  .refine(isValidISODate, { message: "Date must be in YYYY-MM-DD format" })
  .refine((d) => !isFutureIST(d), { message: "Date can't be in the future (IST)" });

export const eodSaleSchema = z
  .object({
    sale_date: isoDate,
    cash_amount: z.coerce.number().min(0, "Can't be negative"),
    upi_amount: z.coerce.number().min(0, "Can't be negative"),
    credit_amount: z.coerce.number().min(0, "Can't be negative"),
    customer_id: z.string().uuid().nullable().optional(),
    remarks: z.string().max(280).optional(),
  })
  .refine((v) => v.cash_amount + v.upi_amount + v.credit_amount > 0, {
    message: "Enter at least one of Cash, UPI, or Credit",
    path: ["cash_amount"],
  });

export type EodSaleInput = z.infer<typeof eodSaleSchema>;

export const saleLineSchema = z.object({
  product_id: z.string().min(1),
  qty: z.coerce.number().int().positive("Qty must be at least 1"),
  unit_price: z.coerce.number().min(0),
});

export const itemizedSaleSchema = z.object({
  sale_date: isoDate,
  lines: z.array(saleLineSchema).min(1, "Add at least one item"),
  cash_amount: z.coerce.number().min(0),
  upi_amount: z.coerce.number().min(0),
  credit_amount: z.coerce.number().min(0),
  customer_id: z.string().uuid().nullable().optional(),
  remarks: z.string().max(280).optional(),
});

export type ItemizedSaleInput = z.infer<typeof itemizedSaleSchema>;
