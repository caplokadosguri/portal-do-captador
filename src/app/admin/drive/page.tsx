'use client';

import { useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { CHAVES_DRIVE, chamarDrive, lerConfigDrive, PlanilhaDrive } from '@/lib/drive/cliente';
import { codigoAppsScript } from '@/lib/drive/codigoAppsScript';
import { useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

const PLANILHAS: { chave: PlanilhaDrive; nome: string; usa: string }[] = [
  { chave: 'editais', nome: 'Monitoramento de Editais', usa: 'Editais: abas Controle de Editais, Descartados e Log semanal' },
  { chave: 'abordagem', nome: 'Plano de abordagem', usa: 'Doadores (aba Inadimplentes) e Parceiros (aba Parcerias e Doações PJ)' },
];

export default function DriveAdmin() {
  const { carregando, membro, email } = useMembro();
  const [url, setUrl] = useState('');
  const [links, setLinks] = useState<Record<PlanilhaDrive, string>>({ editais: '', abordagem: '' });
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [testes, setTestes] = useState<Record<string, string>>({});
  const [verCodigo, setVerCodigo] = useState(false);
  const codigo = useMemo(
    () => codigoAppsScript(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    [],
  );

  useEffect(() => {
    if (membro?.papel !== 'admin') return;
    lerConfigDrive().then((c) => {
      setUrl(c.url ?? '');
      setLinks({ editais: c.planilhas.editais ?? '', abordagem: c.planilhas.abordagem ?? '' });
    });
  }, [membro]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  async function salvar() {
    setMsg(null);
    const linhas = [
      { chave: CHAVES_DRIVE.url, valor: url.trim() || null },
      { chave: CHAVES_DRIVE.editais, valor: links.editais.trim() || null },
      { chave: CHAVES_DRIVE.abordagem, valor: links.abordagem.trim() || null },
    ];
    const { error } = await supabase().from('configuracoes').upsert(linhas);
    if (error) return setMsg({ texto: `Não salvou: ${error.message}`, erro: true });
    setMsg({ texto: 'Salvo. Agora teste a ligação.' });
  }

  async function testar() {
    setTestes({});
    for (const p of PLANILHAS) {
      if (!links[p.chave].trim()) {
        setTestes((t) => ({ ...t, [p.chave]: 'sem link' }));
        continue;
      }
      setTestes((t) => ({ ...t, [p.chave]: 'testando…' }));
      try {
        const r = await chamarDrive(url.trim(), 'ler', p.chave, []);
        setTestes((t) => ({ ...t, [p.chave]: `✓ ligada: “${r.nome}”` }));
      } catch (e) {
        setTestes((t) => ({ ...t, [p.chave]: `✗ ${(e as Error).message}` }));
      }
    }
  }

  return (
    <Tela membro={membro}>
      <main className="pagina pilha pagina-escura" style={{ gap: 24, maxWidth: 860 }}>
        <div className="pilha" style={{ gap: 8 }}>
          <h1 style={{ fontSize: 28 }}>Planilhas no Drive</h1>
          <p className="suave" style={{ margin: 0 }}>
            Depois de ligadas, as planilhas do CASD no Drive se atualizam sozinhas sempre que alguém salva algo no portal.
            A ligação é feita uma vez, com a conta da Captação (a dona das planilhas).
          </p>
        </div>

        <section className="cartao pilha">
          <h2 style={{ fontSize: 18 }}>1. Crie a ponte (uma vez, uns 5 minutos)</h2>
          <ol className="passos">
            <li>Entre em <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer">script.google.com</a> com a conta da Captação e crie um projeto novo. Dê o nome “Portal do Captador”.</li>
            <li>Apague o que estiver no editor, cole o código abaixo e salve.</li>
            <li>Clique em <strong>Implantar › Nova implantação</strong>, escolha o tipo <strong>App da Web</strong>, em “Executar como” deixe <strong>Eu</strong> e em “Quem pode acessar” escolha <strong>Qualquer pessoa</strong>.</li>
            <li>Clique em Implantar e autorize o acesso às planilhas. Copie o <strong>URL do app da Web</strong> e cole no passo 2.</li>
          </ol>
          <p className="suave pequeno" style={{ margin: 0 }}>
            “Qualquer pessoa” só deixa o endereço acessível: a ponte confere o login do portal em cada pedido e só aceita membros
            com o perfil certo. Ela não guarda senha nem chave secreta.
          </p>
          <div className="linha">
            <button
              type="button"
              className="botao"
              onClick={async () => {
                await navigator.clipboard.writeText(codigo);
                setMsg({ texto: 'Código copiado.' });
              }}
            >
              Copiar código
            </button>
            <button type="button" className="botao secundario" onClick={() => setVerCodigo((v) => !v)}>{verCodigo ? 'Esconder código' : 'Ver código'}</button>
          </div>
          {verCodigo && <pre className="codigo">{codigo}</pre>}
        </section>

        <section className="cartao pilha">
          <h2 style={{ fontSize: 18 }}>2. Cole o link da ponte e das planilhas</h2>
          <label className="campo">URL do app da Web (termina em /exec)
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </label>
          {PLANILHAS.map((p) => (
            <label key={p.chave} className="campo">
              Link da planilha “{p.nome}”
              <input
                value={links[p.chave]}
                onChange={(e) => setLinks((l) => ({ ...l, [p.chave]: e.target.value }))}
                placeholder="https://docs.google.com/spreadsheets/d/…"
              />
              <span className="suave pequeno" style={{ fontWeight: 400 }}>Usada por {p.usa}.</span>
              {testes[p.chave] && <span className={`pequeno ${testes[p.chave].startsWith('✗') ? 'texto-erro' : ''}`} style={{ fontWeight: 400 }}>{testes[p.chave]}</span>}
            </label>
          ))}
          <div className="linha">
            <button type="button" className="botao" onClick={salvar}>Salvar</button>
            <button type="button" className="botao secundario" onClick={testar} disabled={!url.trim()}>Testar ligação</button>
          </div>
          {msg && <p className={`aviso ${msg.erro ? 'erro' : 'ok'}`} role="status" style={{ margin: 0 }}>{msg.texto}</p>}
        </section>

        <section className="cartao pilha">
          <h2 style={{ fontSize: 18 }}>Como funciona</h2>
          <ul className="passos">
            <li>O portal escreve só nas colunas dele. Fórmulas (como Dias restantes), cores, listas suspensas e a aba Resumo continuam iguais.</li>
            <li>Colunas que a equipe criar na planilha acompanham o item pelo nome (ex.: uma coluna de anotações nos editais).</li>
            <li>Se a planilha tiver editais ou empresas que ainda não estão no portal, o portal pede para trazê-los antes de atualizar.</li>
            <li>A aba Inadimplentes mostra quem está em atraso agora (com tempo de inadimplência) e quem regularizou nos últimos 60 dias.</li>
          </ul>
        </section>
      </main>
    </Tela>
  );
}
