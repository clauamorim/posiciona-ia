import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Copy, Check } from "lucide-react";

interface Member {
  member_id: string;
  member_user_id: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const WorkspaceMembersDialog = ({ open, onOpenChange }: Props) => {
  const { activeWorkspace } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase.rpc("list_workspace_members", { p_workspace_id: activeWorkspace.id }),
      supabase
        .from("workspace_invites")
        .select("id, email, role, token, created_at, expires_at")
        .eq("workspace_id", activeWorkspace.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setMembers((membersRes.data as Member[]) ?? []);
    setInvites((invitesRes.data as PendingInvite[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWorkspace?.id]);

  const handleInvite = async () => {
    if (!activeWorkspace) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast({ title: "Digite um e-mail válido", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("workspace_invites").insert({
      workspace_id: activeWorkspace.id,
      email,
      role: "editor",
    });
    setSending(false);
    if (error) {
      toast({ title: "Não foi possível criar o convite", description: error.message, variant: "destructive" });
      return;
    }
    setInviteEmail("");
    toast({ title: "Convite criado", description: "Copie o link abaixo e envie pra pessoa — ainda não temos envio automático de e-mail." });
    load();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("workspace_invites").delete().eq("id", id);
    load();
  };

  const removeMember = async (memberId: string) => {
    await supabase.from("workspace_members").delete().eq("id", memberId);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros de "{activeWorkspace?.name}"</DialogTitle>
          <DialogDescription>
            Quem é convidado só acessa Diagnóstico, Sua História, História de Venda e Arquétipos (preenche e vê as próprias respostas). Relatório, linha editorial, Stories de Venda, Análise do Instagram e créditos/plano continuam só com você.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e-mail@exemplo.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
            />
            <Button onClick={handleInvite} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {members.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membros</p>
                  {members.map((m) => (
                    <div key={m.member_id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span>{m.email}</span>
                        <Badge variant="outline" className="text-[10px]">{m.role === "editor" ? "Editor" : m.role}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeMember(m.member_id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {invites.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Convites pendentes</p>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground">{inv.email}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.token)}>
                          {copiedToken === inv.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeInvite(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {members.length === 0 && invites.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro convidado ainda.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkspaceMembersDialog;
