'use client';

import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { chamarDrive, lerConfigDrive } from '@/lib/drive/cliente';
import { Edital, ESFERAS, Inscricao, Projeto, rotuloDe, SITUACOES, STATUS_PROJETO } from '@/lib/editais';
import { camposDoResumo, faltandoNoResumo, nomeDoResumo } from '@/lib/resumoProjeto';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

const CAMPOS = [
  'titulo', 'escopo', 'quem_pediu', 'esfera', 'publico_atendido', 'orcamento', 'status', 'link_documentos', 'objetivo',
  'justificativa', 'publico_alvo', 'atividades', 'cronograma', 'resultados_esperados', 'responsavel',
] as const;
type Campo = (typeof CAMPOS)[number];
type Rascunho = Record<Campo, string>;

const VAZIO = Object.fromEntries(CAMPOS.map((c) => [c, c === 'status' ? 'ideia' : ''])) as Rascunho;

function paraBanco(r: Rascunho) {
  const t = (s: string) => (s.trim() === '' ? null : s.trim());
  const n = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));
  return {
    titulo: r.titulo.trim(),
    escopo: t(r.escopo),
    quem_pediu: t(r.quem_pediu),
    esfera: t(r.esfera),
    publico_atendido: n(r.publico_atendido),
    orcamento: n(r.orcamento),
    status: r.status,
    link_documentos: t(r.link_documentos),
    objetivo: t(r.objetivo),
    justificativa: t(r.justificativa),
    publico_alvo: t(r.publico_alvo),
    atividades: t(r.atividades),
    cronograma: t(r.cronograma),
    resultados_esperados: t(r.resultados_esperados),
    responsavel: t(r.responsavel),
  };
}

export default function FichaProjeto({
  projeto,
  editais,
  inscricoes,
  podeEditar,
  podeApagar,
  nomeMembro,
  aoFechar,
  aoSalvar,
}: {
  projeto: Projeto | null;
  editais: Edital[];
  inscricoes: Inscricao[];
  podeEditar: boolean;
  podeApagar: boolean;
  nomeMembro: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [r, setR] = useState<Rascunho>(() => {
    if (!projeto) return VAZIO;
    const x = { ...VAZIO };
    for (const k of CAMPOS) {
      const v = projeto[k];
      x[k] = v === null || v === undefined ? '' : String(v);
    }
    return x;
  });
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro' | ''; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<{ url: string | null; em: string | null }>({
    url: projeto?.link_resumo ?? null,
    em: projeto?.resumo_gerado_em ?? null,
  });
  const [confirmarFaltando, setConfirmarFaltando] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const muda = (k: Campo) => (ev: { target: { value: string } }) => setR((x) => ({ ...x, [k]: ev.target.value }));
  const cor = ESFERAS.find((e) => e.valor === r.esfera)?.cor ?? '#6B7F88';
  const vinculos = projeto ? inscricoes.filter((i) => i.projeto_id === projeto.id) : [];
  const nomesEditais = vinculos.map((i) => editais.find((e) => e.id === i.edital_id)?.nome).filter((n): n is string => !!n);
  const atual = { ...(projeto ?? {}), ...paraBanco(r) } as Projeto;
  const faltando = faltandoNoResumo(atual);

  async function gravar(): Promise<string | null> {
    if (!r.titulo.trim()) {
      setAviso({ tipo: 'erro', texto: 'Dê um título ao projeto.' });
      return null;
    }
    const sb = supabase();
    const dados = paraBanco(r);
    if (projeto) {
      const { error } = await sb.from('projetos').update(dados).eq('id', projeto.id);
      if (error) {
        setAviso({ tipo: 'erro', texto: `Não salvou: ${error.message}` });
        return null;
      }
      return projeto.id;
    }
    const { data, error } = await sb.from('projetos').insert(dados).select('id').single();
    if (error) {
      setAviso({ tipo: 'erro', texto: `Não salvou: ${error.message}` });
      return null;
    }
    return data.id as string;
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!(await gravar())) return;
    aoSalvar();
    ref.current?.close();
  }

  /** Salva o que está na tela e gera o resumo no Google Docs, a partir do modelo do CASD. */
  async function gerarResumo() {
    if (faltando.length && !confirmarFaltando) {
      setConfirmarFaltando(true);
      return;
    }
    setConfirmarFaltando(false);
    setGerando(true);
    setAviso({ tipo: '', texto: 'Salvando e gerando o resumo no Drive…' });
    try {
      const id = await gravar();
      if (!id) return;
      const cfg = await lerConfigDrive();
      if (!cfg.url || !cfg.docResumo) {
        setAviso({ tipo: 'erro', texto: 'O modelo do resumo ainda não foi ligado: Início › Planilhas no Drive › Documentos.' });
        return;
      }
      const hoje = hojeIso();
      const res = await chamarDrive(cfg.url, 'documento', 'projetos', [], {
        modelo: 'resumo_projeto',
        nome: nomeDoResumo(atual, hoje),
        campos: camposDoResumo(atual, nomesEditais, hoje, nomeMembro),
      });
      const em = new Date().toISOString();
      await supabase().from('projetos').update({ link_resumo: res.url, resumo_gerado_em: em }).eq('id', id);
      await supabase().from('acessos').insert({ acao: 'gerou_resumo_projeto' });
      setResumo({ url: res.url ?? null, em });
      setAviso({ tipo: 'ok', texto: 'Resumo criado no Drive. Abra, revise e compartilhe com a assessoria.' });
      aoSalvar();
    } catch (e) {
      setAviso({ tipo: 'erro', texto: `Não deu para gerar: ${(e as Error).message}` });
    } finally {
      setGerando(false);
    }
  }

  async function apagar() {
    if (!projeto) return;
    const { error } = await supabase().from('projetos').delete().eq('id', projeto.id);
    if (error) return setAviso({ tipo: 'erro', texto: `Não apagou: ${error.message}` });
    aoSalvar();
    ref.current?.close();
  }

  const texto = (k: Campo, rotulo: string, dica?: string) => (
    <label className="campo">{rotulo}<textarea value={r[k]} onChange={muda(k)} placeholder={dica} /></label>
  );

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="projeto-titulo" style={{ '--cor-ficha': cor } as CSSProperties}>
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 10, flex: 1 }}>
          <h2 id="projeto-titulo">{r.titulo.trim() || 'Novo projeto'}</h2>
          <div className="linha pequeno" style={{ gap: 14 }}>
            <span className="linha" style={{ gap: 6 }}><span className="ponto" style={{ background: cor }} />{r.esfera ? rotuloDe(ESFERAS, r.esfera as Projeto['esfera']) : 'Sem esfera'}</span>
            <span>{rotuloDe(STATUS_PROJETO, r.status as Projeto['status'])}</span>
            {r.link_documentos && <a href={r.link_documentos} target="_blank" rel="noopener noreferrer">Documentos ↗</a>}
            {resumo.url && (
              <a href={resumo.url} target="_blank" rel="noopener noreferrer">
                Resumo para a assessoria{resumo.em ? ` (${new Date(resumo.em).toLocaleDateString('pt-BR')})` : ''} ↗
              </a>
            )}
          </div>
        </div>
        <button type="button" className="botao-fechar" onClick={() => ref.current?.close()} aria-label="Fechar">×</button>
      </div>
      <form className="ficha-corpo" onSubmit={salvar}>
        {aviso && aviso.texto && <p className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</p>}
        <fieldset disabled={!podeEditar} style={{ border: 0, padding: 0, margin: 0 }} className="pilha">
          <label className="campo">Título *<input value={r.titulo} onChange={muda('titulo')} required /></label>
          <div className="grade-3">
            <label className="campo">Esfera
              <select value={r.esfera} onChange={muda('esfera')}>
                <option value="">—</option>
                {ESFERAS.map((e) => <option key={e.valor} value={e.valor}>{e.rotulo}</option>)}
              </select>
            </label>
            <label className="campo">Status
              <select value={r.status} onChange={muda('status')}>
                {STATUS_PROJETO.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
            </label>
            <label className="campo">Quem pediu<input value={r.quem_pediu} onChange={muda('quem_pediu')} /></label>
          </div>
          <div className="grade-3">
            <label className="campo">Responsável<input value={r.responsavel} onChange={muda('responsavel')} /></label>
            <label className="campo">Público atendido (pessoas)<input type="number" min="0" value={r.publico_atendido} onChange={muda('publico_atendido')} /></label>
            <label className="campo">Orçamento estimado (R$)<input type="number" min="0" step="0.01" value={r.orcamento} onChange={muda('orcamento')} /></label>
          </div>
          <label className="campo">Link dos documentos<input type="url" value={r.link_documentos} onChange={muda('link_documentos')} placeholder="https://" /></label>

          <h3 style={{ marginTop: 6 }}>Escopo para a assessoria</h3>
          {texto('objetivo', 'Objetivo', 'O que o projeto quer alcançar, em uma ou duas frases')}
          {texto('justificativa', 'Justificativa', 'Por que o projeto é necessário: o problema e quem é afetado')}
          {texto('escopo', 'Escopo', 'O que está dentro e o que está fora do projeto')}
          {texto('publico_alvo', 'Público-alvo', 'Quem é atendido, quantos, de onde')}
          {texto('atividades', 'Atividades', 'Principais ações, uma por linha')}
          {texto('cronograma', 'Cronograma', 'Etapas e prazos (ex.: mar/2027 – seleção; abr–nov – aulas)')}
          {texto('resultados_esperados', 'Resultados esperados e indicadores', 'Como saber que deu certo (ex.: 80% de frequência, 30 aprovações)')}
        </fieldset>

        {projeto && (
          <section className="pilha" style={{ gap: 10 }}>
            <h3>Editais vinculados</h3>
            {vinculos.length === 0 ? (
              <p className="suave pequeno" style={{ margin: 0 }}>Nenhum edital ainda. Vincule pela ficha do edital.</p>
            ) : (
              <div className="chips">
                {vinculos.map((i) => {
                  const e = editais.find((x) => x.id === i.edital_id);
                  return <span key={i.id} className="chip">{e?.nome ?? 'Edital'}{e ? ` · ${rotuloDe(SITUACOES, e.situacao)}` : ''}</span>;
                })}
              </div>
            )}
          </section>
        )}

        {podeEditar && (
          <section className="cartao pilha" style={{ gap: 8 }}>
            <strong>Resumo para a assessoria de captação</strong>
            <span className="suave pequeno">
              Cria um documento no Drive, no modelo do CASD, com a ficha e o escopo acima. Cada geração cria uma versão nova com a data.
            </span>
            {confirmarFaltando && (
              <span className="aviso pequeno" style={{ margin: 0 }}>Ainda estão vazios: {faltando.join(', ')}. Clique de novo para gerar assim mesmo.</span>
            )}
            <span>
              <button type="button" className="botao secundario" onClick={gerarResumo} disabled={gerando}>
                {gerando ? 'Gerando…' : confirmarFaltando ? 'Gerar assim mesmo' : '📄 Salvar e gerar resumo'}
              </button>
            </span>
          </section>
        )}

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha">
            {podeEditar && <button type="submit" className="botao">{projeto ? 'Salvar alterações' : 'Criar projeto'}</button>}
            <button type="button" className="botao secundario" onClick={() => ref.current?.close()}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          </div>
          {projeto && podeApagar && (
            confirmar
              ? <button type="button" className="botao secundario" style={{ background: '#7a2a20' }} onClick={apagar}>Confirmar exclusão</button>
              : <button type="button" className="botao secundario" onClick={() => setConfirmar(true)}>Excluir projeto</button>
          )}
        </div>
      </form>
    </dialog>
  );
}
