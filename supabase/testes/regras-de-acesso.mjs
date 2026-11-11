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
for (const m of ["0001_estrutura.sql", "0002_funcoes_privadas.sql", "0003_editais.sql", "0004_modelos_casd.sql", "0005_configuracoes.sql", "0006_eventos.sql", "0007_resumo_e_subabas.sql", "0008_funil_e_escala.sql", "0009_aniversario_endereco_mensagens.sql", "0010_cadastros_para_converter.sql", "0011_texto_convite_cadastro.sql"]) await db.exec(fs.readFileSync(new URL("../migrations/" + m, import.meta.url), 'utf8'))
await db.exec(`
insert into membros values ('admin@casd.org','Admin','admin',true,now()),('doa@casd.org','Doa','doadores',true,now()),('edi@casd.org','Edi','editais',true,now()),('par@casd.org','Par','parceiros',true,now()),('eve@casd.org','Eve','eventos',true,now()),('ex@casd.org','Ex','doadores',false,now());
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
  ['edi@casd.org', "insert into editais (nome, situacao) values ('x','escrevendo') returning situacao, criado_por"],
  ['edi@casd.org', "update editais set situacao='inscrito', aderencia='a_revisar' where nome='Edital A' returning situacao"],
  ['par@casd.org', "insert into parcerias (organizacao) values ('Empresa X') returning status, criado_por"],
  ['par@casd.org', "update parcerias set status='reuniao_marcada' returning status"],
  ['par@casd.org', "delete from parcerias returning id"],
  ['doa@casd.org', 'select count(*)::int n from parcerias'],
  ['edi@casd.org', "insert into parcerias (organizacao) values ('Y') returning id"],
  ['admin@casd.org', 'select count(*)::int n from parcerias'],
  ['eve@casd.org', "insert into eventos (nome) values ('Evento X') returning situacao"],
  ['eve@casd.org', "insert into evento_gastos (evento_id, descricao, previsto) select id, 'Som', 500 from eventos limit 1 returning situacao"],
  ['eve@casd.org', "delete from evento_gastos returning descricao"],
  ['doa@casd.org', 'select count(*)::int n from evento_gastos'],
  ['par@casd.org', "insert into evento_metas (evento_id, descricao) select id, 'Público' from eventos limit 1 returning id"],
  ['par@casd.org', "insert into parcerias (organizacao, interesse) values ('Empresa Funil', 'morno') returning status, interesse"],
  ['par@casd.org', "update parcerias set interesse='fervendo' where organizacao='Empresa Funil' returning id"],
  ['admin@casd.org', "insert into escala_sede (data, periodo, membro_email) values ('2026-11-12','Tarde','doa@casd.org') returning membro_email"],
  ['doa@casd.org', "select data, periodo from escala_sede where membro_email = 'doa@casd.org'"],
  ['doa@casd.org', "update escala_sede set membro_email='edi@casd.org' returning id"],
  ['doa@casd.org', "insert into escala_sede (data) values ('2026-11-13') returning id"],
  ['estranho@x.com', 'select count(*)::int n from escala_sede'],
  ['admin@casd.org', "insert into configuracoes (chave, valor) values ('drive_script_url','https://x') returning atualizado_por"],
  ['doa@casd.org', 'select chave from configuracoes'],
  ['doa@casd.org', "update configuracoes set valor='hack' returning chave"],
  ['estranho@x.com', 'select count(*)::int n from configuracoes'],
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
