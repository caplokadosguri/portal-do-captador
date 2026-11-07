'use client';

import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { formatarReais } from '@/lib/contato';
import {
  ABRANGENCIAS, corSituacao, diasRestantes, Edital, FONTES_SUGERIDAS, Inscricao, NIVEIS, Projeto, SITUACOES,
  textoDiasRestantes,
} from '@/lib/editais';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

type Rascunho = Record<keyof Omit<Edital, 'id' | 'criado_em' | 'atualizado_em'>, string>;

const VAZIO: Rascunho = {
  nome: '', organizador: '', situacao: 'novo', aderencia: '', prioridade: '', abertura: '', prazo: '', valor: '',
  fonte_recurso: '', abrangencia: '', link: '', observacao: '',
};

function paraRascunho(e: Edital | null): Rascunho {
  if (!e) return VAZIO;
  const r = { ...VAZIO };
  for (const k of Object.keys(VAZIO) as (keyof Rascunho)[]) {
    const v = e[k];
    r[k] = v === null || v === undefined ? '' : String(v);
  }
  return r;
}

function paraBanco(r: Rascunho) {
  const t = (s: string) => (s.trim() === '' ? null : s.trim());
  const valor = r.valor.trim() === '' ? null : Number(r.valor.replace(',', '.'));
  return {
    nome: r.nome.trim(),
    organizador: t(r.organizador),
    situacao: r.situacao,
    aderencia: t(r.aderencia),
    prioridade: t(r.prioridade),
    abertura: t(r.abertura),
    prazo: t(r.prazo),
    valor: Number.isFinite(valor) ? valor : null,
    fonte_recurso: t(r.fonte_recurso),
    abrangencia: t(r.abrangencia),
    link: t(r.link),
    observacao: t(r.observacao),
  };
}

export default function FichaEdital({
  edital,
  projetos,
  inscricoes,
  podeEditar,
  podeApagar,
  aoFechar,
  aoSalvar,
}: {
  edital: Edital | null;
  projetos: Projeto[];
  inscricoes: Inscricao[];
  podeEditar: boolean;
  podeApagar: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [r, setR] = useState<Rascunho>(() => paraRascunho(edital));
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [projetoNovo, setProjetoNovo] = useState('');

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const muda = (k: keyof Rascunho) => (ev: { target: { value: string } }) => setR((x) => ({ ...x, [k]: ev.target.value }));
  const dias = diasRestantes(r.prazo || null, hojeIso());
  const vinculados = edital ? inscricoes.filter((i) => i.edital_id === edital.id) : [];
  const livres = projetos.filter((p) => !vinculados.some((i) => i.projeto_id === p.id));
  const titulo = r.nome.trim() || (edital ? edital.nome : 'Novo edital');

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!r.nome.trim()) return setAviso({ tipo: 'erro', texto: 'Dê um nome ao edital.' });
    setSalvando(true);
    const sb = supabase();
    const dados = paraBanco(r);
    const { error } = edital ? await sb.from('editais').update(dados).eq('id', edital.id) : await sb.from('editais').insert(dados);
    setSalvando(false);
    if (error) return setAviso({ tipo: 'erro', texto: `Não salvou: ${error.message}` });
    aoSalvar();
    ref.current?.close();
  }

  async function apagar() {
    if (!edital) return;
    const { error } = await supabase().from('editais').delete().eq('id', edital.id);
    if (error) return setAviso({ tipo: 'erro', texto: `Não apagou: ${error.message}` });
    aoSalvar();
    ref.current?.close();
  }

  async function vincular() {
    if (!edital || !projetoNovo) return;
    const { error } = await supabase().from('inscricoes').insert({ edital_id: edital.id, projeto_id: projetoNovo });
    if (error) return setAviso({ tipo: 'erro', texto: `Não vinculou: ${error.message}` });
    setProjetoNovo('');
    aoSalvar();
  }

  async function desvincular(id: string) {
    const { error } = await supabase().from('inscricoes').delete().eq('id', id);
    if (error) return setAviso({ tipo: 'erro', texto: `Não desvinculou: ${error.message}` });
    aoSalvar();
  }

  const so = !podeEditar;

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="edital-titulo"
      style={{ '--cor-ficha': corSituacao(r.situacao as Edital['situacao']) } as CSSProperties}>
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 10, flex: 1 }}>
          <h2 id="edital-titulo">{titulo}</h2>
          <div className="linha pequeno" style={{ gap: 14 }}>
            <span className="linha" style={{ gap: 6 }}>
              <span className="ponto" style={{ background: corSituacao(r.situacao as Edital['situacao']) }} />
              {SITUACOES.find((s) => s.valor === r.situacao)?.rotulo}
            </span>
            <span>{textoDiasRestantes(dias)}{dias !== null && dias > 0 ? ' restantes' : ''}</span>
            {r.valor && <span>{formatarReais(Number(r.valor))}</span>}
            {r.link && (
              <a href={r.link} target="_blank" rel="noopener noreferrer">Abrir edital ↗</a>
            )}
          </div>
        </div>
        <button type="button" className="botao-fechar" onClick={() => ref.current?.close()} aria-label="Fechar">×</button>
      </div>

      <form className="ficha-corpo" onSubmit={salvar}>
        {aviso && <p className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</p>}
        <fieldset disabled={so} style={{ border: 0, padding: 0, margin: 0 }} className="pilha">
          <div className="grade-2">
            <label className="campo">Nome do edital *<input value={r.nome} onChange={muda('nome')} required /></label>
            <label className="campo">Organizador<input value={r.organizador} onChange={muda('organizador')} placeholder="Quem lança o edital" /></label>
          </div>
          <div className="grade-3">
            <label className="campo">Situação
              <select value={r.situacao} onChange={muda('situacao')}>
                {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
            </label>
            <label className="campo">Aderência ao CASD
              <select value={r.aderencia} onChange={muda('aderencia')}>
                <option value="">—</option>
                {NIVEIS.map((n) => <option key={n.valor} value={n.valor}>{n.rotulo}</option>)}
              </select>
            </label>
            <label className="campo">Prioridade
              <select value={r.prioridade} onChange={muda('prioridade')}>
                <option value="">—</option>
                {NIVEIS.map((n) => <option key={n.valor} value={n.valor}>{n.rotulo}</option>)}
              </select>
            </label>
          </div>
          <div className="grade-3">
            <label className="campo">Abertura<input type="date" value={r.abertura} onChange={muda('abertura')} /></label>
            <label className="campo">Prazo<input type="date" value={r.prazo} onChange={muda('prazo')} /></label>
            <label className="campo">Dias restantes<input value={textoDiasRestantes(dias)} readOnly tabIndex={-1} aria-readonly="true" /></label>
          </div>
          <div className="grade-3">
            <label className="campo">Valor / orçamento (R$)
              <input type="number" inputMode="decimal" min="0" step="0.01" value={r.valor} onChange={muda('valor')} placeholder="0,00" />
            </label>
            <label className="campo">Lei de incentivo / fonte do recurso
              <input list="fontes-recurso" value={r.fonte_recurso} onChange={muda('fonte_recurso')} placeholder="Escolha ou escreva" />
              <datalist id="fontes-recurso">{FONTES_SUGERIDAS.map((f) => <option key={f} value={f} />)}</datalist>
            </label>
            <label className="campo">Abrangência
              <select value={r.abrangencia} onChange={muda('abrangencia')}>
                <option value="">—</option>
                {ABRANGENCIAS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
              </select>
            </label>
          </div>
          <label className="campo">Link<input type="url" value={r.link} onChange={muda('link')} placeholder="https://" /></label>
          <label className="campo">Observação<textarea value={r.observacao} onChange={muda('observacao')} /></label>
        </fieldset>

        {edital && (
          <section className="pilha" style={{ gap: 10 }}>
            <h3>Projetos vinculados</h3>
            {vinculados.length === 0 && <p className="suave pequeno" style={{ margin: 0 }}>Nenhum projeto vinculado ainda.</p>}
            <div className="chips">
              {vinculados.map((i) => (
                <span key={i.id} className="chip">
                  {projetos.find((p) => p.id === i.projeto_id)?.titulo ?? 'Projeto'}
                  {podeApagar && <button type="button" onClick={() => desvincular(i.id)} aria-label="Desvincular">×</button>}
                </span>
              ))}
            </div>
            {podeEditar && livres.length > 0 && (
              <div className="linha">
                <label className="campo" style={{ flex: 1, minWidth: 220 }}>Vincular projeto
                  <select value={projetoNovo} onChange={(e) => setProjetoNovo(e.target.value)}>
                    <option value="">Escolha um projeto</option>
                    {livres.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                  </select>
                </label>
                <button type="button" className="botao secundario" style={{ alignSelf: 'flex-end' }} onClick={vincular} disabled={!projetoNovo}>Vincular</button>
              </div>
            )}
          </section>
        )}

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha">
            {podeEditar && <button type="submit" className="botao" disabled={salvando}>{salvando ? 'Salvando…' : edital ? 'Salvar alterações' : 'Lançar edital'}</button>}
            <button type="button" className="botao secundario" onClick={() => ref.current?.close()}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          </div>
          {edital && podeApagar && (
            confirmarApagar
              ? <button type="button" className="botao secundario" style={{ background: '#7a2a20' }} onClick={apagar}>Confirmar exclusão</button>
              : <button type="button" className="botao secundario" onClick={() => setConfirmarApagar(true)}>Excluir edital</button>
          )}
        </div>
      </form>
    </dialog>
  );
}
