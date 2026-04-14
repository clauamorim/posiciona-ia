

# Plano: Personalizar e-mail de confirmação de conta

## Situação atual

O e-mail de confirmação usa o template padrão do sistema, que mostra "Archetype Story" como remetente e conteúdo em inglês. Para personalizar, é necessário configurar um domínio de e-mail e criar templates customizados.

## O que será feito

1. **Configurar domínio de e-mail** — O primeiro passo é configurar um domínio de envio para que os e-mails possam ser personalizados. Isso será feito através do painel de configuração de e-mail.

2. **Criar templates de e-mail de autenticação** — Templates customizados em português com a marca "Posiciona":
   - Remetente: **Posiciona**
   - Assunto: "Confirme seu e-mail" (em vez de "Confirm your signup")
   - Corpo todo em português
   - Cores da marca (roxo `hsl(258, 76%, 57%)` como cor primária)
   - Logo do Posiciona no topo

3. **Templates afetados** (todos em português):
   - Confirmação de cadastro
   - Recuperação de senha
   - Magic link
   - Convite
   - Alteração de e-mail
   - Reautenticação

## Primeiro passo

Como não há domínio de e-mail configurado ainda, o primeiro passo é configurar um. Clique no botão abaixo para iniciar:

<lov-actions>
<lov-open-email-setup>Configurar domínio de e-mail</lov-open-email-setup>
</lov-actions>

