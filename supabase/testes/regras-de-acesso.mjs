// Testa as regras de acesso (RLS) num Postgres em memória, com papéis inventados.
// Rode com: npm run test:banco
import { PGlite } from '@electric-sql/pglite'
import fs from "fs"
const db = new PGlite()
const q = async (sql) => { try { return await db.query(sql) } catch (e) { return { error: e.message } } }
await db.exec(`
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create role authenticated;
create role anon;
grant usage on schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
`)
for (const m of ["0001_estrutura.sql", "0002_funcoes_privadas.sql", "0003_editais.sql"]) await db.exec(fs.readFileSync(new URL("../migrations/" + m, import.meta.url), 'utf8'))
await db.exec(`
insert into membros values ('admin@casd.org','Admin','admin',true,now()),('doa@casd.org','Doa','doadores',true,now()),('edi@casd.org','Edi','editais',true,now()),('ex@casd.org','Ex','doadores',false,now());
insert into doadores (id,nome) values ('D1','Fulano');
insert into doacoes (id,doador_id,valor) values ('X1','D1',50);
insert into projetos (titulo) values ('Projeto A');
insert into editais (nome) values ('Edital A');
grant execute on all functions in schema public to authenticated;
grant usage on schema auth to authenticated; grant execute on all functions in schema auth to authenticated;
`)
async function as(email, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '{"email":"${email}"}', false); set role authenticated;`)
  const r = await q(sql); await db.exec('reset role'); return r.error ? 'ERRO: ' + r.error.slice(0, 80) : r.rows
}
const casos = [
  ['doa@casd.org', 'select count(*)::int n from doadores'],
  ['edi@casd.org', 'select count(*)::int n from doadores'],
  ['ex@casd.org', 'select count(*)::int n from doadores'],
  ['estranho@x.com', 'select count(*)::int n from doadores'],
  ['doa@casd.org', "update doadores set nome='hack' where id='D1' returning id"],
  ['admin@casd.org', "update doadores set nome='Fulano 2' where id='D1' returning id"],
  ['doa@casd.org', "insert into relacionamento (doador_id, anotacoes) values ('D1','ok') returning atualizado_por"],
  ['edi@casd.org', "insert into relacionamento (doador_id, anotacoes) values ('D1','x') returning doador_id"],
  ['doa@casd.org', "insert into contatos (doador_id, canal, motivo) values ('D1','whatsapp','cobranca') returning membro"],
  ['doa@casd.org', "insert into contatos (doador_id, canal, motivo, membro) values ('D1','whatsapp','cobranca','admin@casd.org') returning membro"],
  ['doa@casd.org', 'select count(*)::int n from projetos'],
  ['doa@casd.org', 'select count(*)::int n from editais'],
  ['edi@casd.org', 'select count(*)::int n from editais'],
  ['edi@casd.org', "insert into editais (nome, situacao) values ('x','em_escrita') returning situacao, criado_por"],
  ['edi@casd.org', "update editais set situacao='em_analise' where nome='Edital A' returning situacao"],
  ['edi@casd.org', "delete from editais where nome='Edital A' returning id"],
  ['doa@casd.org', "insert into editais (nome) values ('y') returning id"],
  ['edi@casd.org', "insert into editais (nome, situacao) values ('z','inventada') returning id"],
  ['edi@casd.org', "insert into projetos (titulo) values ('Novo') returning titulo"],
  ['doa@casd.org', 'select count(*)::int n from acessos'],
  ['doa@casd.org', "insert into acessos (doador_id, acao) values ('D1','abriu_ficha')"],['admin@casd.org','select membro, acao from acessos'],
  ['doa@casd.org', 'select email from membros'],
  ['admin@casd.org', 'select count(*)::int n from membros'],
  ['doa@casd.org', "insert into importacoes (tipo, linhas_lidas, linhas_ok) values ('doacoes',1,1) returning id"],
]
for (const [e, s] of casos) console.log(e.padEnd(16), s.slice(0, 70).padEnd(72), JSON.stringify(await as(e, s)))
