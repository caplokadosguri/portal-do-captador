-- Encerramento da cobrança: além de "recuperado" (voltou a doar), "desistiu" (pediu para parar de doar).
-- Os dois tiram o doador das pendências; só "recuperado" conta no placar de recuperação.
alter table recuperacoes add column if not exists tipo text not null default 'recuperado'
  check (tipo in ('recuperado', 'desistiu'));
