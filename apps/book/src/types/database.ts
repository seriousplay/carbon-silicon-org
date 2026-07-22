/**
 * Database Types for Supabase
 *
 * These types are derived from supabase/schema.sql
 * They provide type safety for Supabase queries.
 *
 * To regenerate after schema changes:
 * 1. npx supabase gen types typescript --project-id uxaxvzqskqsujmlmxvhj > src/types/database.ts
 * 2. Or use: npm run db:types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          slug: string;
          title: string;
          event_date: string | null;
          access_code: string | null;
          status: string;
          run_type: string;
          audience: string | null;
          description: string | null;
          show_on_home: boolean;
          start_date: string | null;
          end_date: string | null;
          config: Json;
          organization_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          event_date?: string | null;
          access_code?: string | null;
          status?: string;
          run_type?: string;
          audience?: string | null;
          description?: string | null;
          show_on_home?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          config?: Json;
          organization_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          event_date?: string | null;
          access_code?: string | null;
          status?: string;
          run_type?: string;
          audience?: string | null;
          description?: string | null;
          show_on_home?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          config?: Json;
          organization_id?: string | null;
          created_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          org_type: string;
          status: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          org_type?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          org_type?: string;
          status?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          role: string | null;
          default_organization_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          role?: string | null;
          default_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          role?: string | null;
          default_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          member_role: string;
          status: string;
          joined_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          member_role?: string;
          status?: string;
          joined_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          member_role?: string;
          status?: string;
          joined_at?: string | null;
          created_at?: string;
        };
      };
      organization_invites: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          member_role: string;
          status: string;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          member_role?: string;
          status?: string;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          code?: string;
          member_role?: string;
          status?: string;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          organization_id: string | null;
          display_name: string;
          role: string | null;
          industry: string | null;
          org_size: string | null;
          company_name: string | null;
          contact: string | null;
          contact_consent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id?: string | null;
          organization_id?: string | null;
          display_name: string;
          role?: string | null;
          industry?: string | null;
          org_size?: string | null;
          company_name?: string | null;
          contact?: string | null;
          contact_consent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string | null;
          organization_id?: string | null;
          display_name?: string;
          role?: string | null;
          industry?: string | null;
          org_size?: string | null;
          company_name?: string | null;
          contact?: string | null;
          contact_consent?: boolean;
          created_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          module: string;
          dimension: string | null;
          title: string;
          description: string | null;
          question_type: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          module: string;
          dimension?: string | null;
          title: string;
          description?: string | null;
          question_type: string;
          sort_order: number;
        };
        Update: {
          id?: string;
          module?: string;
          dimension?: string | null;
          title?: string;
          description?: string | null;
          question_type?: string;
          sort_order?: number;
        };
      };
      assessments: {
        Row: {
          id: string;
          event_id: string;
          participant_id: string;
          user_id: string | null;
          status: string;
          submitted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          participant_id: string;
          user_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          participant_id?: string;
          user_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          created_at?: string;
        };
      };
      assessment_answers: {
        Row: {
          id: string;
          assessment_id: string;
          question_id: string;
          answer_value: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          question_id: string;
          answer_value: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          question_id?: string;
          answer_value?: Json;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          assessment_id: string;
          report_type: string;
          report_payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          report_type: string;
          report_payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          report_type?: string;
          report_payload?: Json;
          created_at?: string;
        };
      };
      tools: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          category: string | null;
          chapters: string[] | null;
          use_cases: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          category?: string | null;
          chapters?: string[] | null;
          use_cases?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          chapters?: string[] | null;
          use_cases?: string[] | null;
          created_at?: string;
        };
      };
      tool_sessions: {
        Row: {
          id: string;
          tool_id: string;
          event_id: string | null;
          participant_id: string | null;
          user_id: string | null;
          session_data: Json;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tool_id: string;
          event_id?: string | null;
          participant_id?: string | null;
          user_id?: string | null;
          session_data: Json;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tool_id?: string;
          event_id?: string | null;
          participant_id?: string | null;
          user_id?: string | null;
          session_data?: Json;
          duration_seconds?: number | null;
          created_at?: string;
        };
      };
      admin_profiles: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      event_status: "draft" | "active" | "completed" | "archived";
      event_run_type:
        | "workshop"
        | "corporate_diagnostic"
        | "cohort_program"
        | "public_assessment"
        | "book_launch";
      member_role: "admin" | "member";
      invite_status: "active" | "used" | "expired";
      assessment_status: "in_progress" | "submitted" | "graded";
      report_type: "personal" | "admin_summary" | "insights";
      tool_category:
        | "strategy"
        | "execution"
        | "culture"
        | "diagnostic"
        | "experiment"
        | "governance";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
