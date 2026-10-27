// Hand-written to match supabase/schema.sql. Replace with
// `supabase gen types typescript` output once the Supabase CLI is set up.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Workspace = { id: string; name: string; slug: string; created_at: string; updated_at: string };
export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
};
export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  identifier: string;
  deleted_at: string | null;
  created_at: string;
};
export type WorkItem = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "backlog" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  assignee_id: string | null;
  deleted_at: string | null;
  created_at: string;
};
export type Diagram = {
  id: string;
  project_id: string;
  name: string;
  type: "flowchart" | "erd";
  nodes: Json;
  edges: Json;
  deleted_at: string | null;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      workspaces: Table<Workspace, "name" | "slug">;
      workspace_members: Table<WorkspaceMember, "workspace_id" | "user_id">;
      projects: Table<Project, "workspace_id" | "name" | "identifier">;
      work_items: Table<WorkItem, "project_id" | "title">;
      diagrams: Table<Diagram, "project_id" | "name" | "type">;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_workspace: { Args: { ws_name: string; ws_slug: string }; Returns: Workspace };
      // Both are defined in supabase/invite.sql.
      invite_workspace_member: {
        Args: { ws_id: string; invite_email: string; member_role: WorkspaceMember["role"] };
        Returns: undefined;
      };
      list_workspace_members: {
        Args: { ws_id: string };
        Returns: { user_id: string; email: string; role: WorkspaceMember["role"]; joined_at: string }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
