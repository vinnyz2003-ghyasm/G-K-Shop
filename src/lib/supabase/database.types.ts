export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          customer_id: string
          is_unspecified: boolean
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string
          is_unspecified?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          is_unspecified?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          client_uuid: string
          created_at: string
          description: string | null
          expense_date: string
          expense_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          client_uuid?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          client_uuid?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          cost_price: number
          created_at: string
          current_stock: number
          is_active: boolean
          margin_percentage: number | null
          name: string
          product_id: string
          profit_per_unit: number | null
          reorder_level: number
          selling_price: number
          unit: string
          upc_barcode: string | null
          updated_at: string
        }
        Insert: {
          category: string
          cost_price: number
          created_at?: string
          current_stock?: number
          is_active?: boolean
          margin_percentage?: number | null
          name: string
          product_id: string
          profit_per_unit?: number | null
          reorder_level?: number
          selling_price: number
          unit?: string
          upc_barcode?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          cost_price?: number
          created_at?: string
          current_stock?: number
          is_active?: boolean
          margin_percentage?: number | null
          name?: string
          product_id?: string
          profit_per_unit?: number | null
          reorder_level?: number
          selling_price?: number
          unit?: string
          upc_barcode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          client_uuid: string
          created_at: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          product_id: string
          purchase_date: string
          purchase_id: string
          qty: number
          supplier_name: string
          total_amount: number | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          client_uuid?: string
          created_at?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id: string
          purchase_date?: string
          purchase_id?: string
          qty: number
          supplier_name: string
          total_amount?: number | null
          unit_cost: number
          updated_at?: string
        }
        Update: {
          client_uuid?: string
          created_at?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          product_id?: string
          purchase_date?: string
          purchase_id?: string
          qty?: number
          supplier_name?: string
          total_amount?: number | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["product_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          line_total: number | null
          product_id: string
          qty: number
          sale_item_id: string
          transaction_id: string
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          line_total?: number | null
          product_id: string
          qty: number
          sale_item_id?: string
          transaction_id: string
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          line_total?: number | null
          product_id?: string
          qty?: number
          sale_item_id?: string
          transaction_id?: string
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock_alerts"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_amount: number
          client_uuid: string
          created_at: string
          credit_amount: number
          customer_id: string | null
          entry_mode: string
          remarks: string | null
          sale_date: string
          synced_at: string | null
          total_revenue: number | null
          transaction_id: string
          upi_amount: number
        }
        Insert: {
          cash_amount?: number
          client_uuid?: string
          created_at?: string
          credit_amount?: number
          customer_id?: string | null
          entry_mode?: string
          remarks?: string | null
          sale_date?: string
          synced_at?: string | null
          total_revenue?: number | null
          transaction_id?: string
          upi_amount?: number
        }
        Update: {
          cash_amount?: number
          client_uuid?: string
          created_at?: string
          credit_amount?: number
          customer_id?: string | null
          entry_mode?: string
          remarks?: string | null
          sale_date?: string
          synced_at?: string | null
          total_revenue?: number | null
          transaction_id?: string
          upi_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_balances"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      table_name: {
        Row: {
          data: Json | null
          id: number
          inserted_at: string
          name: string | null
          updated_at: string
        }
        Insert: {
          data?: Json | null
          id?: number
          inserted_at?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          data?: Json | null
          id?: number
          inserted_at?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      udhaar_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          entry_date: string
          entry_type: Database["public"]["Enums"]["udhaar_entry_type"]
          notes: string | null
          transaction_id: string | null
          udhaar_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          entry_date?: string
          entry_type: Database["public"]["Enums"]["udhaar_entry_type"]
          notes?: string | null
          transaction_id?: string | null
          udhaar_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["udhaar_entry_type"]
          notes?: string | null
          transaction_id?: string | null
          udhaar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "udhaar_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "udhaar_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "udhaar_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["transaction_id"]
          },
        ]
      }
    }
    Views: {
      v_customer_balances: {
        Row: {
          customer_id: string | null
          is_unspecified: boolean | null
          name: string | null
          outstanding_balance: number | null
          phone: string | null
        }
        Relationships: []
      }
      v_daily_sales_vs_expenses: {
        Row: {
          day: string | null
          expenses: number | null
          revenue: number | null
        }
        Relationships: []
      }
      v_low_stock_alerts: {
        Row: {
          category: string | null
          current_stock: number | null
          name: string | null
          product_id: string | null
          reorder_level: number | null
          unit: string | null
          units_short: number | null
        }
        Insert: {
          category?: string | null
          current_stock?: number | null
          name?: string | null
          product_id?: string | null
          reorder_level?: number | null
          unit?: string | null
          units_short?: never
        }
        Update: {
          category?: string | null
          current_stock?: number | null
          name?: string | null
          product_id?: string | null
          reorder_level?: number | null
          unit?: string | null
          units_short?: never
        }
        Relationships: []
      }
      v_pnl_perpetual: {
        Row: {
          cogs_perpetual: number | null
        }
        Relationships: []
      }
      v_pnl_summary: {
        Row: {
          active_credit: number | null
          cash: number | null
          cogs: number | null
          credit: number | null
          gross_revenue: number | null
          net_profit: number | null
          total_expenses: number | null
          upi: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_filtered_pnl: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_credit: number
          cash: number
          cogs: number
          credit: number
          gross_revenue: number
          net_profit: number
          sale_count: number
          total_expenses: number
          upi: number
        }[]
      }
    }
    Enums: {
      expense_category:
        | "Rent"
        | "Electricity"
        | "Staff Salary"
        | "Wastage / Expiry"
        | "Packaging"
        | "Miscellaneous"
        | "Transport"
        | "Maintenance"
      payment_mode: "Cash" | "UPI" | "Bank Transfer" | "Card" | "N/A"
      payment_status: "Paid" | "Pending"
      udhaar_entry_type: "Credit Given" | "Payment Received"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      expense_category: [
        "Rent",
        "Electricity",
        "Staff Salary",
        "Wastage / Expiry",
        "Packaging",
        "Miscellaneous",
        "Transport",
        "Maintenance",
      ],
      payment_mode: ["Cash", "UPI", "Bank Transfer", "Card", "N/A"],
      payment_status: ["Paid", "Pending"],
      udhaar_entry_type: ["Credit Given", "Payment Received"],
    },
  },
} as const
