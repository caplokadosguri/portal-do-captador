'use client';

import { useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { CHAVES_DRIVE, chamarDrive, lerConfigDrive, PlanilhaDrive } from '@/lib/drive/cliente';
import { codigoAppsScript } from '@/lib/drive/codigoAppsScript';
import { useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

const PLANILHAS: { chave: PlanilhaDrive; nome: string; usa: string; modelo?: string }[] = [
  { chave: 'editais', nome: 'Monitoramento de Editais', usa: 'Editais: abas Controle de Editais, Descartados e Log semanal' },
  { chave: 'abordagem', nome: 'Plano de abordagem', usa: 'Doadores (aba Inadimplentes) e Parceiros (aba Parcerias e Doações PJ)' },
  { chave: 'projetos', nome: 'Banco de Projetos', usa: 'Projetos: abas Projetos e Resumo', modelo: '/modelos/projetos.xlsx' },
  { chave: 'eventos', nome: 'Calendário de Eventos', usa: 'Eventos: abas Eventos, Metas, Gastos, Patrocinadores, Tarefas e Resumo', modelo: '/modelos/eventos.xlsx' },
];

export default function DriveAdmin() {
  const { carregando, membro, email } = useMembro();
  const [url, setUrl] = useState('');
  const [links, setLinks] = useState<Record<PlanilhaDrive, string>>({ editais: '', abordagem: '', projetos: '', eventos: '' });
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [testes, setTestes] = useState<Record<string, string>>({});
  const [verCodigo, setVerCodigo] = useState(false);
  const [docResumo, setDocResumo] = useState('');
  const [pastaResumo, setPastaResumo] = useState('');
  const codigo = useMemo(
    () => codigoAppsScript(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    [],
  );

  useEffect(() => {
    if (membro?.papel !== 'admin') return;
    lerConfigDrive().then((c) => {
      setUrl(c.url ?? '');
      setDocResumo(c.docResumo ?? '');
      setPastaResumo(c.pastaResumo ?? '');
      setLinks({ editais: c.planilhas.editais ?? '', abordagem: c.planilhas.abordagem ?? '', projetos: c.planilhas.projetos ?? '', eventos: c.planilhas.eventos ?? '' });
    });
  }, [membro]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  /** Salva e já testa: a ponte lê os links salvos no portal, não os da tela. */
  async function salvar(): Promise<boolean> {
    setMsg(null);
    const linhas = [
      { chave: CHAVES_DRIVE.url, valor: url.trim() || null },
      { chave: CHAVES_DRIVE.editais, valor: links.editais.trim() || null },
      { chave: CHAVES_DRIVE.abordagem, valor: links.abordagem.trim() || null },
      { chave: CHAVES_DRIVE.projetos, valor: links.projetos.trim() || null },
      { chave: CHAVES_DRIVE.eventos, valor: links.eventos.trim() || null },
      { chave: CHAVES_DRIVE.docResumo, valor: docResumo.trim() || null },
      { chave: CHAVES_DRIVE.pastaResumo, valor: pastaResumo.trim() || null },
    ];
    const { error } = await supabase().from('configuracoes').upsert(linhas);
    if (error) {
      setMsg({ texto: `Não salvou: ${error.message}`, erro: true });
      return false;
    }
    setMsg({ texto: 'Links salvos.' });
    return true;
  }

  async function salvarETestar() {
    setTestes({});
    if (!(await salvar())) return;
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
    if (!docResumo.trim()) return setTestes((t) => ({ ...t, docResumo: 'sem link' }));
    setTestes((t) => ({ ...t, docResumo: 'testando…' }));
    try {
      const r = await chamarDrive(url.trim(), 'documento', 'projetos', [], { modelo: 'resumo_projeto', testar: true });
      setTestes((t) => ({ ...t, docResumo: `✓ ligado: “${r.nome}”` }));
    } catch (e) {
      setTestes((t) => ({ ...t, docResumo: `✗ ${(e as Error).message}` }));
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
            <li>Clique em Implantar e autorize o acesso. Depois, no editor, escolha a função <strong>autorizarPonte</strong> e clique em <strong>Executar</strong> para autorizar também Drive e Documentos. Copie o <strong>URL do app da Web</strong> e cole no passo 2.</li>
          </ol>
          <p className="suave pequeno" style={{ margin: 0 }}>
            Já criou a ponte antes? Quando o portal avisar que ela está desatualizada, cole o código novo, salve e vá em
            Implantar › Gerenciar implantações › editar (lápis) › Versão: <strong>Nova versão</strong> › Implantar. O link continua o mesmo.
            Se a versão nova usar algo novo do Google (como Drive e Documentos, na v4), o Google não pede a autorização sozinho:
            no editor, escolha a função <strong>autorizarPonte</strong> na lista ao lado de “Depurar”, clique em <strong>Executar</strong> e aceite. Não precisa implantar de novo depois.
          </p>
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
              <span className="suave pequeno" style={{ fontWeight: 400 }}>
                Usada por {p.usa}.
                {p.modelo && (
                  <>
                    {' '}Planilha nova: <a href={p.modelo} download>baixe o modelo</a>, suba no Drive, abra e use{' '}
                    <strong>Arquivo › Salvar como Planilhas Google</strong>; cole aqui o link da versão Google.
                  </>
                )}
              </span>
              {testes[p.chave] && <span className={`pequeno ${testes[p.chave].startsWith('✗') ? 'texto-erro' : ''}`} style={{ fontWeight: 400 }}>{testes[p.chave]}</span>}
            </label>
          ))}
          <h3 style={{ fontSize: 15, marginTop: 8 }}>Documentos</h3>
          <label className="campo">
            Link do modelo “Resumo de escopo de projeto” (Google Docs)
            <input value={docResumo} onChange={(e) => setDocResumo(e.target.value)} placeholder="https://docs.google.com/document/d/…" />
            <span className="suave pequeno" style={{ fontWeight: 400 }}>
              Usado pelo botão “Salvar e gerar resumo” na ficha do projeto. <a href="/modelos/resumo-projeto.docx" download>Baixe o modelo</a>,
              suba no Drive, abra e use <strong>Arquivo › Salvar como Documentos Google</strong>; cole aqui o link da versão Google.
              Pode mudar textos e cores à vontade, mantendo os <code>{'{{campos}}'}</code> escritos igual.
            </span>
            {testes.docResumo && <span className={`pequeno ${testes.docResumo.startsWith('✗') ? 'texto-erro' : ''}`} style={{ fontWeight: 400 }}>{testes.docResumo}</span>}
          </label>
          <label className="campo">
            Pasta onde salvar os resumos (opcional)
            <input value={pastaResumo} onChange={(e) => setPastaResumo(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
            <span className="suave pequeno" style={{ fontWeight: 400 }}>Se ficar vazio, os resumos vão para a mesma pasta do modelo.</span>
          </label>
          <div className="linha">
            <button type="button" className="botao" onClick={salvarETestar} disabled={!url.trim()}>Salvar e testar</button>
          </div>
          {msg && <p className={`aviso ${msg.erro ? 'erro' : 'ok'}`} role="status" style={{ margin: 0 }}>{msg.texto}</p>}
        </section>

        <section className="cartao pilha">
          <h2 style={{ fontSize: 18 }}>Como funciona</h2>
          <ul className="passos">
            <li>As planilhas precisam estar no formato do Google Planilhas (não .xlsx guardado no Drive).</li>
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
