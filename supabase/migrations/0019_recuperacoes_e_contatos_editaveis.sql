-- 1) Histórico de contatos editável: quem registrou (ou o admin) corrige ou apaga um registro
--    (ex.: clique repetido no "Enviar no WhatsApp").
drop policy if exists contatos_apagar on contatos;
create policy contatos_apagar on contatos for delete
  using (privado.posso('doadores') and (membro = privado.meu_email() or privado.sou_admin()));
create policy contatos_editar on contatos for update
  using (privado.posso('doadores') and (membro = privado.meu_email() or privado.sou_admin()))
  with check (privado.posso('doadores'));

-- 2) Inadimplentes recuperados: o membro marca quando a abordagem terminou e o doador voltou a doar.
--    Sai das fileiras de atraso (até uma nova inadimplência) e entra na conta do que foi recuperado.
create table recuperacoes (
  id                  uuid primary key default gen_random_uuid(),
  doador_id           text not null references doadores (id) on delete cascade,
  recuperado_em       date not null default current_date,
  -- Início da inadimplência recuperada (vencimento da primeira cobrança em aberto).
  inadimplente_desde  date,
  -- Valor da doação mensal que voltou.
  valor_mensal        numeric(12, 2),
  observacao          text,
  marcado_por         text not null default privado.meu_email(),
  criado_em           timestamptz not null default now()
);
create index on recuperacoes (doador_id, recuperado_em desc);
alter table recuperacoes enable row level security;
create policy recuperacoes_ver on recuperacoes for select using (privado.posso('doadores'));
create policy recuperacoes_criar on recuperacoes for insert with check (privado.posso('doadores'));
create policy recuperacoes_apagar on recuperacoes for delete using (privado.posso('doadores'));
