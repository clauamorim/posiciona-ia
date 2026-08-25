import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type BrandType = "pessoal" | "institucional";
export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  brand_type: BrandType;
  profession: string | null;
  niche: string | null;
  is_default: boolean;
  role: WorkspaceRole;
}

interface CreateWorkspaceInput {
  name: string;
  brandType: BrandType;
  importFrom?: { profession?: string | null; niche?: string | null };
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  switchWorkspace: (id: string) => void;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<{ ok: boolean; id?: string; error?: string }>;
  deleteWorkspace: (id: string) => Promise<{ ok: boolean; error?: string }>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  isLoading: true,
  switchWorkspace: () => {},
  createWorkspace: async () => ({ ok: false, error: "no-provider" }),
  deleteWorkspace: async () => ({ ok: false, error: "no-provider" }),
  refreshWorkspaces: async () => {},
});

export const useWorkspace = () => useContext(WorkspaceContext);

const storageKey = (userId: string) => `posiciona-active-workspace-${userId}`;

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveId(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Sem filtro de owner_id: a RLS de workspaces já retorna tanto os
    // perfis próprios quanto os perfis de outra conta onde este usuário
    // foi convidado como membro ("Members can view workspace").
    const [{ data }, { data: memberRows }] = await Promise.all([
      supabase
        .from("workspaces")
        .select("id, name, brand_type, profession, niche, is_default, owner_id")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("workspace_members").select("workspace_id, role").eq("user_id", user.id),
    ]);

    const roleByWorkspace = new Map((memberRows ?? []).map((m: any) => [m.workspace_id, m.role as WorkspaceRole]));
    const list: Workspace[] = (data ?? []).map((w: any) => ({
      id: w.id,
      name: w.name,
      brand_type: w.brand_type,
      profession: w.profession,
      niche: w.niche,
      is_default: w.is_default,
      role: w.owner_id === user.id ? "owner" : (roleByWorkspace.get(w.id) ?? "viewer"),
    }));
    setWorkspaces(list);

    const saved = localStorage.getItem(storageKey(user.id));
    const savedValid = saved && list.some(w => w.id === saved);
    const fallback = list.find(w => w.is_default)?.id ?? list[0]?.id ?? null;
    const resolved = savedValid ? saved : fallback;
    setActiveId(resolved);
    if (resolved) localStorage.setItem(storageKey(user.id), resolved);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const switchWorkspace = useCallback((id: string) => {
    if (!user) return;
    setActiveId(id);
    localStorage.setItem(storageKey(user.id), id);
  }, [user]);

  const createWorkspace = useCallback(async (input: CreateWorkspaceInput) => {
    if (!user) return { ok: false, error: "no-user" };
    // owner_id NÃO é enviado — o banco preenche sozinho via DEFAULT auth.uid(),
    // eliminando qualquer chance de descompasso entre cliente e RLS.
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        name: input.name.trim(),
        brand_type: input.brandType,
        profession: input.importFrom?.profession ?? null,
        niche: input.importFrom?.niche ?? null,
        is_default: false,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message || "Falha ao criar perfil." };
    await load();
    switchWorkspace(data.id);
    return { ok: true, id: data.id };
  }, [user, load, switchWorkspace]);

  const deleteWorkspace = useCallback(async (id: string) => {
    if (!user) return { ok: false, error: "no-user" };
    const { error } = await supabase.from("workspaces").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    // load() já resolve sozinho um novo activeId válido caso o excluído
    // fosse o ativo (o salvo no localStorage deixa de existir na lista).
    await load();
    return { ok: true };
  }, [user, load]);

  const activeWorkspace = workspaces.find(w => w.id === activeId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        switchWorkspace,
        createWorkspace,
        deleteWorkspace,
        refreshWorkspaces: load,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
