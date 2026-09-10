export type ProfileRole = "admin" | "student" | "teacher" | "parent";

export type Database = {
  public: {
    Tables: {
      planner_days: {
        Row: {
          day: string;
          file_name: string;
          markdown: string;
          pdf_path: string;
          term: number;
          updated_at: string;
          updated_by: string | null;
          week: number;
        };
        Insert: {
          day: string;
          file_name: string;
          markdown: string;
          pdf_path: string;
          term: number;
          updated_at?: string;
          updated_by?: string | null;
          week: number;
        };
        Update: {
          day?: string;
          file_name?: string;
          markdown?: string;
          pdf_path?: string;
          term?: number;
          updated_at?: string;
          updated_by?: string | null;
          week?: number;
        };
        Relationships: [];
      };
      planner_terms: {
        Row: {
          created_at: string;
          created_by: string | null;
          number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          number: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          number?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          email: string;
          id: string;
          name: string;
          role: ProfileRole;
        };
        Insert: {
          email: string;
          id: string;
          name: string;
          role: ProfileRole;
        };
        Update: {
          email?: string;
          id?: string;
          name?: string;
          role?: ProfileRole;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin_or_teacher: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      role: ProfileRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
