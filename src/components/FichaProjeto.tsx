'use client';

import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { Edital, ESFERAS, Inscricao, Projeto, rotuloDe, SITUACOES, STATUS_PROJETO } from '@/lib/editais';
import { supabase } from '@/lib/supabase/cliente';

type Rascunho = Record<keyof Omit<Projeto, 'id'>, string>;
const VAZIO: Rascunho = {
  titulo: '', escopo: '', quem_pediu: '', esfera: '', publico_atendido: '', orcamento: '', status: 'ideia', link_documentos: '',
};

export default function FichaProjeto({
  projeto,
  editais,
  inscricoes,
  podeEditar,
  podeApagar,
  aoFechar,
  aoSalvar,
}: {
  projeto: Projeto | null;
  editais: Edital[];
  inscricoes: Inscricao[];
  podeEditar: boolean;
  podeApagar: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [r, setR] = useState<Rascunho>(() => {
    if (!projeto) return VAZIO;
    const x = { ...VAZIO };
    for (const k of Object.keys(VAZIO) as (keyof Rascunho)[]) x[k] = projeto[k] === null ? '' : String(projeto[k]);
    return x;
  });
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const muda = (k: keyof Rascunho) => (ev: { target: { value: string } }) => setR((x) => ({ ...x, [k]: ev.target.value }));
  const cor = ESFERAS.find((e) => e.valor === r.esfera)?.cor ?? '#6B7F88';
  const vinculos = projeto ? inscricoes.filter((i) => i.projeto_id === projeto.id) : [];

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!r.titulo.trim()) return setAviso('Dê um título ao projeto.');
    const t = (s: string) => (s.trim() === '' ? null : s.trim());
    const n = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));
    const dados = {
      titulo: r.titulo.trim(), escopo: t(r.escopo), quem_pediu: t(r.quem_pediu), esfera: t(r.esfera),
      publico_atendido: n(r.publico_atendido), orcamento: n(r.orcamento), status: r.status, link_documentos: t(r.link_documentos),
    };
    const sb = supabase();
    const { error } = projeto ? await sb.from('projetos').update(dados).eq('id', projeto.id) : await sb.from('projetos').insert(dados);
    if (error) return setAviso(`Não salvou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  async function apagar() {
    if (!projeto) return;
    const { error } = await supabase().from('projetos').delete().eq('id', projeto.id);
    if (error) return setAviso(`Não apagou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="projeto-titulo" style={{ '--cor-ficha': cor } as CSSProperties}>
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 10, flex: 1 }}>
          <h2 id="projeto-titulo">{r.titulo.trim() || 'Novo projeto'}</h2>
          <div className="linha pequeno" style={{ gap: 14 }}>
            <span className="linha" style={{ gap: 6 }}><span className="ponto" style={{ background: cor }} />{r.esfera ? rotuloDe(ESFERAS, r.esfera as Projeto['esfera']) : 'Sem esfera'}</span>
            <span>{rotuloDe(STATUS_PROJETO, r.status as Projeto['status'])}</span>
            {r.link_documentos && <a href={r.link_documentos} target="_blank" rel="noopener noreferrer">Documentos ↗</a>}
          </div>
        </div>
        <button type="button" className="botao-fechar" onClick={() => ref.current?.close()} aria-label="Fechar">×</button>
      </div>
      <form className="ficha-corpo" onSubmit={salvar}>
        {aviso && <p className="aviso erro" role="status">{aviso}</p>}
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
          <label className="campo">Escopo<textarea value={r.escopo} onChange={muda('escopo')} /></label>
          <div className="grade-3">
            <label className="campo">Público atendido<input type="number" min="0" value={r.publico_atendido} onChange={muda('publico_atendido')} /></label>
            <label className="campo">Orçamento (R$)<input type="number" min="0" step="0.01" value={r.orcamento} onChange={muda('orcamento')} /></label>
            <label className="campo">Link dos documentos<input type="url" value={r.link_documentos} onChange={muda('link_documentos')} placeholder="https://" /></label>
          </div>
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
