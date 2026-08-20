// src/types/database.types.ts — Tipos gerados do schema PostgreSQL do Supabase (FinPlan)
// Gerado manualmente com base em src/services/supabaseSchema.ts
// Para regenerar via CLI: npx supabase gen types typescript --project-id xlshtwvnaqkfrbcucjwq --schema public > src/types/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          name: string
          type: string
          initial_balance: number
          credit_limit: number | null
          statement_closing_day: number | null
          payment_due_day: number | null
          color: string
          icon: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          name: string
          type: string
          initial_balance?: number
          credit_limit?: number | null
          statement_closing_day?: number | null
          payment_due_day?: number | null
          color?: string
          icon?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string
          initial_balance?: number
          credit_limit?: number | null
          statement_closing_day?: number | null
          payment_due_day?: number | null
          color?: string
          icon?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      category_groups: {
        Row: {
          id: string
          name: string
          type: string | null
          sort_order: number
          is_hidden: boolean
          is_system: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          name: string
          type?: string | null
          sort_order?: number
          is_hidden?: boolean
          is_system?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string | null
          sort_order?: number
          is_hidden?: boolean
          is_system?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      categories: {
        Row: {
          id: string
          group_id: string
          name: string
          sort_order: number
          is_hidden: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          group_id: string
          name: string
          sort_order?: number
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          sort_order?: number
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      budget_months: {
        Row: {
          id: string
          month: string
          category_id: string
          budgeted: number
          activity: number
          available: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          month: string
          category_id: string
          budgeted?: number
          activity?: number
          available?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          month?: string
          category_id?: string
          budgeted?: number
          activity?: number
          available?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          account_id: string
          date: string
          amount: number
          payee: string
          category_id: string | null
          notes: string | null
          cleared: boolean
          type: string
          transfer_account_id: string | null
          transfer_transaction_id: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          split_group_id: string | null
          is_scheduled_projection: boolean
          scheduled_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          account_id: string
          date: string
          amount: number
          payee?: string
          category_id?: string | null
          notes?: string | null
          cleared?: boolean
          type?: string
          transfer_account_id?: string | null
          transfer_transaction_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          split_group_id?: string | null
          is_scheduled_projection?: boolean
          scheduled_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          account_id?: string
          date?: string
          amount?: number
          payee?: string
          category_id?: string | null
          notes?: string | null
          cleared?: boolean
          type?: string
          transfer_account_id?: string | null
          transfer_transaction_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          split_group_id?: string | null
          is_scheduled_projection?: boolean
          scheduled_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      installment_groups: {
        Row: {
          id: string
          description: string
          total_amount: number
          installment_count: number
          installment_amount: number
          start_date: string
          account_id: string
          category_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          description: string
          total_amount: number
          installment_count: number
          installment_amount: number
          start_date: string
          account_id: string
          category_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          description?: string
          total_amount?: number
          installment_count?: number
          installment_amount?: number
          start_date?: string
          account_id?: string
          category_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      scheduled_transactions: {
        Row: {
          id: string
          account_id: string
          amount: number
          payee: string
          category_id: string | null
          type: string
          transfer_account_id: string | null
          frequency: string
          next_date: string
          end_date: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          account_id: string
          amount: number
          payee: string
          category_id?: string | null
          type?: string
          transfer_account_id?: string | null
          frequency?: string
          next_date: string
          end_date?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          account_id?: string
          amount?: number
          payee?: string
          category_id?: string | null
          type?: string
          transfer_account_id?: string | null
          frequency?: string
          next_date?: string
          end_date?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      payees: {
        Row: {
          id: string
          name: string
          default_category_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          name: string
          default_category_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          default_category_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      debt_accounts: {
        Row: {
          id: string
          name: string
          phone: string | null
          notes: string | null
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          name: string
          phone?: string | null
          notes?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          notes?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      debt_items: {
        Row: {
          id: string
          debt_account_id: string
          description: string
          type: string
          amount: number
          due_date: string | null
          settled_date: string | null
          status: string
          notes: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          total_amount: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          debt_account_id: string
          description: string
          type: string
          amount: number
          due_date?: string | null
          settled_date?: string | null
          status?: string
          notes?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          total_amount?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          debt_account_id?: string
          description?: string
          type?: string
          amount?: number
          due_date?: string | null
          settled_date?: string | null
          status?: string
          notes?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          total_amount?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helpers de conveniência — mesma API do supabase gen types oficial
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
