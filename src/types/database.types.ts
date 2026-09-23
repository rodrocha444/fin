// src/types/database.types.ts — Tipos gerados do schema PostgreSQL do Supabase (Fin)
// Gerado com base em src/services/supabaseSchema.ts

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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
          month: string
          category_id: string
          budget_type?: string | null
          budgeted: number
          activity: number
          available: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          user_id?: string
          month: string
          category_id: string
          budget_type?: string | null
          budgeted?: number
          activity?: number
          available?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          month?: string
          category_id?: string
          budget_type?: string | null
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
          name: string
          default_category_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          user_id?: string
          name: string
          default_category_id?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
          user_id: string
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
          user_id?: string
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
          user_id?: string
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
      debt_item_changes: {
        Row: {
          id: string
          user_id: string
          debt_item_id: string
          previous_amount: number
          new_amount: number
          changed_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id?: string
          debt_item_id: string
          previous_amount: number
          new_amount: number
          changed_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          debt_item_id?: string
          previous_amount?: number
          new_amount?: number
          changed_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
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

// Helpers de conveniência
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
