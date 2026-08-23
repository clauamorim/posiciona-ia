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
      account_deletion_requests: {
        Row: {
          email: string
          id: string
          niche: string | null
          profession: string | null
          requested_at: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          niche?: string | null
          profession?: string | null
          requested_at?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          niche?: string | null
          profession?: string | null
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      archetype_answers: {
        Row: {
          created_at: string
          id: string
          question_id: string
          score: number
          updated_at: string
          user_id: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          score: number
          updated_at?: string
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          score?: number
          updated_at?: string
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archetype_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "archetype_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archetype_answers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_questions: {
        Row: {
          archetype_name: string
          brand_type: Database["public"]["Enums"]["brand_type"]
          id: string
          question_number: number
          statement: string
        }
        Insert: {
          archetype_name: string
          brand_type?: Database["public"]["Enums"]["brand_type"]
          id?: string
          question_number: number
          statement: string
        }
        Update: {
          archetype_name?: string
          brand_type?: Database["public"]["Enums"]["brand_type"]
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
          workspace_id: string | null
        }
        Insert: {
          archetype_name: string
          created_at?: string
          id?: string
          total_score?: number
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          archetype_name?: string
          created_at?: string
          id?: string
          total_score?: number
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archetype_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "assistant_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_questionnaires_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_jobs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          payload: Json
          progress_message: string | null
          report_id: string
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          week_index: number
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress_message?: string | null
          report_id: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          week_index: number
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress_message?: string | null
          report_id?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          week_index?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
        }
        Insert: {
          analysis: Json
          created_at?: string
          id?: string
          user_id: string
          username?: string | null
          workspace_id?: string | null
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: string
          user_id?: string
          username?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_trends_cache: {
        Row: {
          expires_at: string
          key: string
          trends: Json
          updated_at: string
        }
        Insert: {
          expires_at: string
          key: string
          trends?: Json
          updated_at?: string
        }
        Update: {
          expires_at?: string
          key?: string
          trends?: Json
          updated_at?: string
        }
        Relationships: []
      }
      personal_questionnaires: {
        Row: {
          advice_to_20yo: string | null
          biggest_influence: string | null
          created_at: string
          defended_belief: string | null
          dependents: string | null
          desired_feeling: string | null
          failure_lesson: string | null
          formative_story: string | null
          guiding_belief: string | null
          hobby: string | null
          id: string
          is_complete: boolean
          pets: string | null
          pre_meeting_ritual: string | null
          proud_moment: string | null
          social_cause: string | null
          sports: string | null
          status: string
          sunday_morning: string | null
          unblock_method: string | null
          updated_at: string
          user_id: string
          version: number
          work_routine: string | null
          workspace_id: string | null
        }
        Insert: {
          advice_to_20yo?: string | null
          biggest_influence?: string | null
          created_at?: string
          defended_belief?: string | null
          dependents?: string | null
          desired_feeling?: string | null
          failure_lesson?: string | null
          formative_story?: string | null
          guiding_belief?: string | null
          hobby?: string | null
          id?: string
          is_complete?: boolean
          pets?: string | null
          pre_meeting_ritual?: string | null
          proud_moment?: string | null
          social_cause?: string | null
          sports?: string | null
          status?: string
          sunday_morning?: string | null
          unblock_method?: string | null
          updated_at?: string
          user_id: string
          version?: number
          work_routine?: string | null
          workspace_id?: string | null
        }
        Update: {
          advice_to_20yo?: string | null
          biggest_influence?: string | null
          created_at?: string
          defended_belief?: string | null
          dependents?: string | null
          desired_feeling?: string | null
          failure_lesson?: string | null
          formative_story?: string | null
          guiding_belief?: string | null
          hobby?: string | null
          id?: string
          is_complete?: boolean
          pets?: string | null
          pre_meeting_ritual?: string | null
          proud_moment?: string | null
          social_cause?: string | null
          sports?: string | null
          status?: string
          sunday_morning?: string | null
          unblock_method?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          work_routine?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_questionnaires_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          billing_type: string
          created_at: string
          id: string
          max_workspaces: number
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
          max_workspaces?: number
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
          max_workspaces?: number
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
          completed_at: string | null
          created_at: string
          engine: string
          error_message: string | null
          fal_request_ids: Json
          id: string
          kept_indices: number[] | null
          portraits: Json
          prompts_meta: Json
          status: string
          style_index: number | null
          used_hand_poses: Json
          used_outfits: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engine?: string
          error_message?: string | null
          fal_request_ids?: Json
          id?: string
          kept_indices?: number[] | null
          portraits?: Json
          prompts_meta?: Json
          status?: string
          style_index?: number | null
          used_hand_poses?: Json
          used_outfits?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engine?: string
          error_message?: string | null
          fal_request_ids?: Json
          id?: string
          kept_indices?: number[] | null
          portraits?: Json
          prompts_meta?: Json
          status?: string
          style_index?: number | null
          used_hand_poses?: Json
          used_outfits?: Json
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
      portrait_references: {
        Row: {
          created_at: string
          file_path: string
          id: string
          is_active: boolean
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          is_active?: boolean
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          is_active?: boolean
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      portrait_trainings: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          lora_provider: string
          lora_weights_url: string | null
          physical_traits: Json | null
          replicate_training_id: string | null
          selfies_count: number
          status: string
          trigger_word: string
          updated_at: string
          user_id: string
          was_free: boolean
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lora_provider?: string
          lora_weights_url?: string | null
          physical_traits?: Json | null
          replicate_training_id?: string | null
          selfies_count?: number
          status?: string
          trigger_word: string
          updated_at?: string
          user_id: string
          was_free?: boolean
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lora_provider?: string
          lora_weights_url?: string | null
          physical_traits?: Json | null
          replicate_training_id?: string | null
          selfies_count?: number
          status?: string
          trigger_word?: string
          updated_at?: string
          user_id?: string
          was_free?: boolean
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
      post_embeddings: {
        Row: {
          created_at: string
          day_index: number
          embedding: string
          id: string
          named_cases: string[]
          post_kind: string
          report_id: string
          text_used: string
          user_id: string
          week_index: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          day_index: number
          embedding: string
          id?: string
          named_cases?: string[]
          post_kind: string
          report_id: string
          text_used: string
          user_id: string
          week_index: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          day_index?: number
          embedding?: string
          id?: string
          named_cases?: string[]
          post_kind?: string
          report_id?: string
          text_used?: string
          user_id?: string
          week_index?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_embeddings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_deletion_requested_at: string | null
          created_at: string
          full_name: string
          gender: string | null
          id: string
          is_blocked: boolean
          main_goal: string | null
          niche: string | null
          phone: string | null
          profession: string | null
          profile_completed: boolean
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          account_deletion_requested_at?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          main_goal?: string | null
          niche?: string | null
          phone?: string | null
          profession?: string | null
          profile_completed?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          account_deletion_requested_at?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_blocked?: boolean
          main_goal?: string | null
          niche?: string | null
          phone?: string | null
          profession?: string | null
          profile_completed?: boolean
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
      report_generation_jobs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          payload: Json
          progress_message: string | null
          report_id: string
          report_version: number
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress_message?: string | null
          report_id: string
          report_version: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          progress_message?: string | null
          report_id?: string
          report_version?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_generation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_narrative_questionnaires: {
        Row: {
          audience_objections: string | null
          career_turn: string | null
          created_at: string
          forbidden_topics: string | null
          id: string
          is_complete: boolean
          negative_comments: string | null
          personal_expressions: string | null
          previous_profession: string | null
          proof_cases: string | null
          start_year_motivation: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          audience_objections?: string | null
          career_turn?: string | null
          created_at?: string
          forbidden_topics?: string | null
          id?: string
          is_complete?: boolean
          negative_comments?: string | null
          personal_expressions?: string | null
          previous_profession?: string | null
          proof_cases?: string | null
          start_year_motivation?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          audience_objections?: string | null
          career_turn?: string | null
          created_at?: string
          forbidden_topics?: string | null
          id?: string
          is_complete?: boolean
          negative_comments?: string | null
          personal_expressions?: string | null
          previous_profession?: string | null
          proof_cases?: string | null
          start_year_motivation?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_narrative_questionnaires_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_story_sequences: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          offer_context: string
          sequence_type: string
          stories: Json
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          offer_context?: string
          sequence_type: string
          stories?: Json
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          offer_context?: string
          sequence_type?: string
          stories?: Json
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_story_sequences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      story_embeddings: {
        Row: {
          created_at: string
          day_index: number
          embedding: string
          id: string
          report_id: string | null
          story_text: string
          user_id: string
          week_index: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          day_index: number
          embedding: string
          id?: string
          report_id?: string | null
          story_text: string
          user_id: string
          week_index: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          day_index?: number
          embedding?: string
          id?: string
          report_id?: string | null
          story_text?: string
          user_id?: string
          week_index?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_embeddings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_embeddings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      used_market_trends: {
        Row: {
          created_at: string
          id: string
          report_id: string | null
          trends_used: Json
          user_id: string
          week_index: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          report_id?: string | null
          trends_used: Json
          user_id: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string | null
          trends_used?: Json
          user_id?: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "used_market_trends_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "used_market_trends_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      used_personal_traits: {
        Row: {
          created_at: string
          id: string
          report_id: string | null
          traits_used: string[]
          user_id: string
          week_index: number | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          report_id?: string | null
          traits_used?: string[]
          user_id: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string | null
          traits_used?: string[]
          user_id?: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "used_personal_traits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      used_title_patterns: {
        Row: {
          central_concepts: string[]
          created_at: string
          day_index: number
          id: string
          named_cases: string[]
          pillar: string
          report_id: string | null
          title_anchors: string[]
          title_formula: string
          user_id: string
          week_index: number
          workspace_id: string | null
        }
        Insert: {
          central_concepts?: string[]
          created_at?: string
          day_index: number
          id?: string
          named_cases?: string[]
          pillar?: string
          report_id?: string | null
          title_anchors?: string[]
          title_formula?: string
          user_id: string
          week_index: number
          workspace_id?: string | null
        }
        Update: {
          central_concepts?: string[]
          created_at?: string
          day_index?: number
          id?: string
          named_cases?: string[]
          pillar?: string
          report_id?: string | null
          title_anchors?: string[]
          title_formula?: string
          user_id?: string
          week_index?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "used_title_patterns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_archetype_symbols: {
        Row: {
          application: string | null
          applies_to: string[]
          archetype_role: string
          created_at: string
          emoji: string | null
          id: string
          meaning: string | null
          priority: number
          report_id: string | null
          report_version: number
          symbol_name: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          application?: string | null
          applies_to?: string[]
          archetype_role?: string
          created_at?: string
          emoji?: string | null
          id?: string
          meaning?: string | null
          priority?: number
          report_id?: string | null
          report_version?: number
          symbol_name: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          application?: string | null
          applies_to?: string[]
          archetype_role?: string
          created_at?: string
          emoji?: string | null
          id?: string
          meaning?: string | null
          priority?: number
          report_id?: string | null
          report_version?: number
          symbol_name?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_archetype_symbols_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      user_brand_palette: {
        Row: {
          color_name: string
          created_at: string
          hex: string
          id: string
          priority: number
          report_id: string | null
          report_version: number
          role: string
          usage: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color_name: string
          created_at?: string
          hex: string
          id?: string
          priority?: number
          report_id?: string | null
          report_version?: number
          role?: string
          usage?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color_name?: string
          created_at?: string
          hex?: string
          id?: string
          priority?: number
          report_id?: string | null
          report_version?: number
          role?: string
          usage?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_brand_palette_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          archetype: string | null
          created_at: string
          day_index: number | null
          id: string
          is_global: boolean
          is_template: boolean
          state: Json
          thumbnail: string | null
          title: string
          updated_at: string
          user_id: string
          week_index: number | null
          workspace_id: string | null
        }
        Insert: {
          archetype?: string | null
          created_at?: string
          day_index?: number | null
          id?: string
          is_global?: boolean
          is_template?: boolean
          state?: Json
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Update: {
          archetype?: string | null
          created_at?: string
          day_index?: number | null
          id?: string
          is_global?: boolean
          is_template?: boolean
          state?: Json
          thumbnail?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          week_index?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_designs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_gallery_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
        }
        Insert: {
          archetype_name: string
          created_at?: string
          id?: string
          rank: number
          score: number
          user_id: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          archetype_name?: string
          created_at?: string
          id?: string
          rank?: number
          score?: number
          user_id?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_top_archetypes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_type: Database["public"]["Enums"]["brand_type"]
          created_at: string
          handle: string | null
          id: string
          is_default: boolean
          name: string
          niche: string | null
          owner_id: string
          profession: string | null
          updated_at: string
        }
        Insert: {
          brand_type?: Database["public"]["Enums"]["brand_type"]
          created_at?: string
          handle?: string | null
          id?: string
          is_default?: boolean
          name: string
          niche?: string | null
          owner_id?: string
          profession?: string | null
          updated_at?: string
        }
        Update: {
          brand_type?: Database["public"]["Enums"]["brand_type"]
          created_at?: string
          handle?: string | null
          id?: string
          is_default?: boolean
          name?: string
          niche?: string | null
          owner_id?: string
          profession?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_balances: {
        Args: {
          p_log_amount: number
          p_log_description: string
          p_log_type: string
          p_portrait_credits_extra: number
          p_portrait_credits_included: number
          p_reanalysis_credits: number
          p_regeneration_credits: number
          p_user_id: string
          p_weekly_cycles: number
        }
        Returns: undefined
      }
      consume_credit: {
        Args: { p_amount: number; p_credit_type: string; p_description: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_access: {
        Args: {
          _min_role?: Database["public"]["Enums"]["workspace_role"]
          _workspace_id: string
        }
        Returns: boolean
      }
      match_post_embeddings: {
        Args: {
          p_limit: number
          p_query: string
          p_since: string
          p_threshold: number
          p_user_id: string
          p_workspace_id?: string
        }
        Returns: {
          created_at: string
          day_index: number
          id: string
          named_cases: string[]
          post_kind: string
          report_id: string
          similarity: number
          text_used: string
          week_index: number
        }[]
      }
      match_story_embeddings: {
        Args: {
          p_day_index: number
          p_exclude_report_id?: string
          p_query_embedding: string
          p_threshold?: number
          p_user_id: string
          p_window_days?: number
          p_workspace_id?: string
        }
        Returns: {
          id: string
          similarity: number
          story_text: string
          week_index: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      brand_type: "pessoal" | "institucional"
      workspace_role: "owner" | "editor" | "viewer"
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
      brand_type: ["pessoal", "institucional"],
      workspace_role: ["owner", "editor", "viewer"],
    },
  },
} as const
