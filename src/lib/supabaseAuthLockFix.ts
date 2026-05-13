// Desabilita o Web Locks API ANTES do cliente Supabase ser criado.
//
// Motivo: a versão atual do @supabase/auth-js usa `navigator.locks` por padrão
// quando disponível. Em alguns cenários (React Strict Mode, abas reabertas,
// recargas durante refresh de token) o lock pode ficar órfão e causar
// deadlock — chamadas como `signInWithPassword` ficam presas indefinidamente,
// resultando em timeout no login mesmo com o backend saudável.
//
// Ao remover `navigator.locks`, o GoTrueClient cai automaticamente para o
// `lockNoOp` interno, que serializa operações dentro da mesma aba sem usar a
// Web Locks API. Isso é seguro para apps single-tab/SPA como este.
//
// IMPORTANTE: este arquivo precisa ser importado em `main.tsx` ANTES de
// qualquer import que carregue o cliente Supabase, e a remoção precisa ser
// permanente (sem restaurar) para que o GoTrueClient nunca veja `locks`.

const FLAG = "__posicionaAuthLockDisabled__";

const disableNavigatorLocks = () => {
  if (typeof navigator === "undefined") return;
  const w = window as unknown as Record<string, boolean>;
  if (w[FLAG]) return;

  try {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      get: () => undefined,
    });
    w[FLAG] = true;
  } catch {
    // Se o navegador bloquear a sobrescrita, o timeout do form de login
    // ainda protege a UI; nada mais a fazer aqui.
  }
};

disableNavigatorLocks();
