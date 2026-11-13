-- Lembrete de checkpoint dispensado sem registrar contato (ex.: já falou com o doador por fora).
create table marcos_dispensados (
  doador_id      text not null references doadores(id) on delete cascade,
  data_marco     date not null,
  checkpoint     text not null,
  dispensado_por text default privado.meu_email(),
  dispensado_em  timestamptz not null default now(),
  primary key (doador_id, data_marco)
);

alter table marcos_dispensados enable row level security;
create policy marcos_dispensados_ver on marcos_dispensados for select using (privado.posso('doadores'));
create policy marcos_dispensados_criar on marcos_dispensados for insert with check (privado.posso('doadores'));
create policy marcos_dispensados_apagar on marcos_dispensados for delete using (privado.posso('doadores'));
