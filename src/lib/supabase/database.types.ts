// Hand-written to match supabase/migrations/0001_init.sql exactly.
// Once your Supabase project is linked, regenerate with:
//   npm run db:types
// and this file becomes redundant (but the shape should stay the same).

export type PaymentStatus = "Paid" | "Pending";
export type PaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Card" | "N/A";
export type ExpenseCategory =
  | "Rent" | "Electricity" | "Staff Salary" | "Wastage / Expiry"
  | "Packaging" | "Miscellaneous" | "Transport" | "Maintenance";
export type UdhaarEntryType = "Credit Given" | "Payment Received";
export type SaleEntryMode = "eod_summary" | "itemized";

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          product_id: string;
          name: string;
          upc_barcode: string | null;
          category: string;
          unit: string;
          cost_price: number;
          selling_price: number;
          reorder_level: number;
          current_stock: number;
          profit_per_unit: number;       // generated
          margin_percentage: number;     // generated
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          name: string;
          upc_barcode?: string | null;
          category: string;
          unit?: string;
          cost_price: number;
          selling_price: number;
          reorder_level?: number;
          current_stock?: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      customers: {
        Row: {
          customer_id: string;
          name: string;
          phone: string | null;
          is_unspecified: boolean;
          created_at: string;
        };
        Insert: { name: string; phone?: string | null };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      sales: {
        Row: {
          transaction_id: string;
          client_uuid: string;
          sale_date: string;       // 'YYYY-MM-DD'
          entry_mode: SaleEntryMode;
          cash_amount: number;
          upi_amount: number;
          credit_amount: number;
          total_revenue: number;   // generated
          customer_id: string | null;
          remarks: string | null;
          synced_at: string | null;
          created_at: string;
        };
        Insert: {
          client_uuid: string;
          sale_date: string;
          entry_mode?: SaleEntryMode;
          cash_amount?: number;
          upi_amount?: number;
          credit_amount?: number;
          customer_id?: string | null;
          remarks?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sales"]["Insert"]>;
      };
      sale_items: {
        Row: {
          sale_item_id: string;
          transaction_id: string;
          product_id: string;
          qty: number;
          unit_price: number;
          unit_cost: number | null;
          line_total: number; // generated
        };
        Insert: {
          transaction_id: string;
          product_id: string;
          qty: number;
          unit_price: number;
          unit_cost?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["sale_items"]["Insert"]>;
      };
      udhaar_transactions: {
        Row: {
          udhaar_id: string;
          customer_id: string;
          transaction_id: string | null;
          entry_type: UdhaarEntryType;
          amount: number;
          entry_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          customer_id: string;
          transaction_id?: string | null;
          entry_type: UdhaarEntryType;
          amount: number;
          entry_date?: string;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["udhaar_transactions"]["Insert"]>;
      };
      purchases: {
        Row: {
          purchase_id: string;
          client_uuid: string;
          purchase_date: string;
          product_id: string;
          supplier_name: string;
          qty: number;
          unit_cost: number;
          total_amount: number; // generated
          payment_status: PaymentStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          client_uuid: string;
          purchase_date: string;
          product_id: string;
          supplier_name: string;
          qty: number;
          unit_cost: number;
          payment_status?: PaymentStatus;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Insert"]>;
      };
      expenses: {
        Row: {
          expense_id: string;
          client_uuid: string;
          expense_date: string;
          category: ExpenseCategory;
          description: string | null;
          amount: number;
          payment_mode: PaymentMode;
          created_at: string;
        };
        Insert: {
          client_uuid: string;
          expense_date: string;
          category: ExpenseCategory;
          description?: string | null;
          amount: number;
          payment_mode?: PaymentMode;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
    };
    Views: {
      v_low_stock_alerts: {
        Row: {
          product_id: string;
          name: string;
          category: string;
          unit: string;
          current_stock: number;
          reorder_level: number;
          units_short: number;
        };
      };
      v_customer_balances: {
        Row: {
          customer_id: string;
          name: string;
          phone: string | null;
          is_unspecified: boolean;
          outstanding_balance: number;
        };
      };
      v_daily_sales_vs_expenses: {
        Row: { day: string; revenue: number; expenses: number };
      };
      v_pnl_summary: {
        Row: {
          cash: number;
          upi: number;
          credit: number;
          gross_revenue: number;
          cogs: number;
          total_expenses: number;
          active_credit: number;
          net_profit: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      payment_status: PaymentStatus;
      payment_mode: PaymentMode;
      expense_category: ExpenseCategory;
      udhaar_entry_type: UdhaarEntryType;
    };
    CompositeTypes: Record<string, never>;
  };
}
