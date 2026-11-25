-- Doador que volta da inadimplência com outro valor: guarda o valor de antes (o novo fica em valor_mensal)
-- e permite corrigir a marcação depois (ex.: o valor novo só foi confirmado depois).
alter table recuperacoes add column if not exists valor_anterior numeric(12, 2);
create policy recuperacoes_editar on recuperacoes for update
  using (privado.posso('doadores')) with check (privado.posso('doadores'));
