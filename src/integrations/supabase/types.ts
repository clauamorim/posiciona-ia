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
      archetype_answers: {
        Row: {
          created_at: string
          id: string
          question_id: string
          score: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          score: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          score?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "archetype_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "archetype_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_questions: {
        Row: {
          archetype_name: string
          id: string
          question_number: number
          statement: string
        }
        Insert: {
          archetype_name: string
          id?: string
          question_number: number
          statement: string
        }
        Update: {
          archetype_name?: string
          id?: string
          question_number?: number
          statement?: string
        }
        Relationships: []
      }
      archetype_scores: {
        Row: {
          archetype_name: string
          created_at: string
          id: string
          total_score: number
          user_id: string
          version: number
        }
        Insert: {
          archetype_name: string
          created_at?: string
          id?: string
          total_score?: number
          user_id: string
          version?: number
        }
        Update: {
          archetype_name?: string
          created_at?: string
          id?: string
          total_score?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      business_questionnaires: {
        Row: {
          authority_proofs: string | null
          client_fears: string | null
          company_name: string | null
          created_at: string
          empathic_statements: string | null
          external_problems: string | null
          hiring_steps: string | null
          id: string
          internal_problems: string | null
          is_complete: boolean
          main_cta: string | null
          negative_consequences: string | null
          promised_transformations: string | null
          services: string | null
          status: string
          target_audience: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          authority_proofs?: string | null
          client_fears?: string | null
          company_name?: string | null
          created_at?: string
          empathic_statements?: string | null
          external_problems?: string | null
          hiring_steps?: string | null
          id?: string
          internal_problems?: string | null
          is_complete?: boolean
          main_cta?: string | null
          negative_consequences?: string | null
          promised_transformations?: string | null
          services?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          authority_proofs?: string | null
          client_fears?: string | null
          company_name?: string | null
          created_at?: string
          empathic_statements?: string | null
          external_problems?: string | null
          hiring_steps?: string | null
          id?: string
          internal_problems?: string | null
          is_complete?: boolean
          main_cta?: string | null
          negative_consequences?: string | null
          promised_transformations?: string | null
          services?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      credit_logs: {
        Row: {
          amount: number
          created_at: string
          credit_type: string
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_type: string
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_type?: string
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      gallery_assets: {
        Row: {
          category: string
          created_at: string
          file_path: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_path: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          file_path?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      instagram_analyses: {
        Row: {
          analysis: Json
          created_at: string
          id: string
          user_id: string
          username: string | null
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          user_id: string
          username?: string | null
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          billing_type: string
          created_at: string
          id: string
          name: string
          portrait_credits: number
          price_cents: number
          reanalysis_credits: number
          regeneration_credits: number
          slug: string
          stripe_price_id: string | null
          weekly_cycles: number
        }
        Insert: {
          active?: boolean
          billing_type?: string
          created_at?: string
          id?: string
          name: string
          portrait_credits?: number
          price_cents: number
          reanalysis_credits?: number
          regeneration_credits?: number
          slug: string
          stripe_price_id?: string | null
          weekly_cycles?: number
        }
        Update: {
          active?: boolean
          billing_type?: string
          created_at?: string
          id?: string
          name?: string
          portrait_credits?: number
          price_cents?: number
          reanalysis_credits?: number
          regeneration_credits?: number
          slug?: string
          stripe_price_id?: string | null
          weekly_cycles?: number
        }
        Relationships: []
      }
      portrait_generations: {
        Row: {
          created_at: string
          id: string
          portraits: Json
          style_index: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          portraits?: Json
          style_index?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          portraits?: Json
          style_index?: number | null
          user_id?: string
        }
        Relationships: []
      }
      portrait_packs: {
        Row: {
          active: boolean
          created_at: string
          credits: number
          id: string
          name: string
          price_cents: number
          stripe_price_id: string | null
          stripe_price_ids: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          credits: number
          id?: string
          name: string
          price_cents: number
          stripe_price_id?: string | null
          stripe_price_ids?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          credits?: number
          id?: string
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          stripe_price_ids?: Json
        }
        Relationships: []
      }
      post_background_cache: {
        Row: {
          created_at: string
          image_url: string
          keywords: string | null
          source: string
          theme_hash: string
        }
        Insert: {
          created_at?: string
          image_url: string
          keywords?: string | null
          source?: string
          theme_hash: string
        }
        Update: {
          created_at?: string
          image_url?: string
          keywords?: string | null
          source?: string
          theme_hash?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          gender: string | null
          id: string
          is_blocked: boolean
          main_goal: string | null
          niche: string | null
          phone: string | null
          profession: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          main_goal?: string | null
          niche?: string | null
          phone?: string | null
          profession?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          main_goal?: string | null
          niche?: string | null
          phone?: string | null
          profession?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      reference_documents: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: Json | null
          created_at: string
          editorial_weeks: Json | null
          error_message: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: Json | null
          created_at?: string
          editorial_weeks?: Json | null
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: Json | null
          created_at?: string
          editorial_weeks?: Json | null
          error_message?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          id: string
          portrait_credits_extra: number
          portrait_credits_included: number
          reanalysis_credits: number
          regeneration_credits: number
          updated_at: string
          user_id: string
          weekly_cycles: number
        }
        Insert: {
          id?: string
          portrait_credits_extra?: number
          portrait_credits_included?: number
          reanalysis_credits?: number
          regeneration_credits?: number
          updated_at?: string
          user_id: string
          weekly_cycles?: number
        }
        Update: {
          id?: string
          portrait_credits_extra?: number
          portrait_credits_included?: number
          reanalysis_credits?: number
          regeneration_credits?: number
          updated_at?: string
          user_id?: string
          weekly_cycles?: number
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_designs: {
        Row: {
          created_at: string
          day_index: number | null
          id: string
          is_template: boolean
          state: Json
          thumbnail: string | null
          title: string
          updated_at: string
          user_id: string
          week_index: number | null
        }
        Insert: {
          created_at?: string
          day_index?: number | null
          id?: string
          is_template?: boolean
          state?: Json
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id: string
          week_index?: number | null
        }
        Update: {
          created_at?: string
          day_index?: number | null
          id?: string
          is_template?: boolean
          state?: Json
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          week_index?: number | null
        }
        Relationships: []
      }
      user_gallery_assets: {
        Row: {
          attribution: Json | null
          bg_removed: boolean
          created_at: string
          file_path: string
          id: string
          is_logo: boolean
          name: string
          source: string
          user_id: string
        }
        Insert: {
          attribution?: Json | null
          bg_removed?: boolean
          created_at?: string
          file_path: string
          id?: string
          is_logo?: boolean
          name: string
          source?: string
          user_id: string
        }
        Update: {
          attribution?: Json | null
          bg_removed?: boolean
          created_at?: string
          file_path?: string
          id?: string
          is_logo?: boolean
          name?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_top_archetypes: {
        Row: {
          archetype_name: string
          created_at: string
          id: string
          rank: number
          score: number
          user_id: string
          version: number
        }
        Insert: {
          archetype_name: string
          created_at?: string
          id?: string
          rank: number
          score: number
          user_id: string
          version?: number
        }
        Update: {
          archetype_name?: string
          created_at?: string
          id?: string
          rank?: number
          score?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
