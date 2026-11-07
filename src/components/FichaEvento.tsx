'use client';

import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { formatarReais } from '@/lib/contato';
import { corDoEvento, Evento, FREQUENCIAS, quando, rotuloSituacao, SITUACOES_EVENTO, TipoEvento, TIPOS } from '@/lib/eventos';
import { supabase } from '@/lib/supabase/cliente';

type Texto = Record<'nome' | 'previsao' | 'inicio' | 'fim' | 'local' | 'responsavel' | 'meta' | 'arrecadado' | 'cotas' | 'descricao' | 'link' | 'situacao' | 'frequencia', string>;

const VAZIO: Texto = {
  nome: '', previsao: '', inicio: '', fim: '', local: '', responsavel: '', meta: '', arrecadado: '', cotas: '', descricao: '', link: '',
  situacao: 'proposta', frequencia: 'unico',
};

export default function FichaEvento({
  evento,
  podeApagar,
  aoFechar,
  aoSalvar,
}: {
  evento: Evento | null;
  podeApagar: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [r, setR] = useState<Texto>(() => {
    if (!evento) return VAZIO;
    const x = { ...VAZIO };
    for (const k of Object.keys(VAZIO) as (keyof Texto)[]) {
      const v = evento[k];
      x[k] = v === null || v === undefined ? '' : String(v);
    }
    return x;
  });
  const [tipos, setTipos] = useState<TipoEvento[]>(evento?.tipos ?? []);
  const [confirmada, setConfirmada] = useState(evento?.data_confirmada ?? false);
  const [aviso, setAviso] = useState('');
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const muda = (k: keyof Texto) => (ev: { target: { value: string } }) => setR((x) => ({ ...x, [k]: ev.target.value }));
  const unico = r.frequencia === 'unico';
  const rascunho = { ...(evento ?? {}), ...r, meta: null, arrecadado: null, tipos, data_confirmada: confirmada, inicio: r.inicio || null, fim: r.fim || null, previsao: r.previsao || null } as unknown as Evento;
  const cor = corDoEvento(rascunho);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!r.nome.trim()) return setAviso('Dê um nome ao evento.');
    if (unico && r.inicio && r.fim && r.fim < r.inicio) return setAviso('O fim do período vem antes do início.');
    const t = (s: string) => (s.trim() === '' ? null : s.trim());
    const n = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));
    const dados = {
      nome: r.nome.trim(),
      tipos,
      situacao: r.situacao,
      frequencia: r.frequencia,
      previsao: t(r.previsao),
      inicio: unico ? t(r.inicio) : null,
      fim: unico ? t(r.fim) ?? t(r.inicio) : null,
      data_confirmada: unico && confirmada,
      local: t(r.local),
      responsavel: t(r.responsavel),
      meta: n(r.meta),
      arrecadado: n(r.arrecadado),
      cotas: t(r.cotas),
      descricao: t(r.descricao),
      link: t(r.link),
    };
    const sb = supabase();
    const { error } = evento ? await sb.from('eventos').update(dados).eq('id', evento.id) : await sb.from('eventos').insert(dados);
    if (error) return setAviso(`Não salvou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  async function apagar() {
    if (!evento) return;
    const { error } = await supabase().from('eventos').delete().eq('id', evento.id);
    if (error) return setAviso(`Não apagou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="evento-titulo" style={{ '--cor-ficha': cor } as CSSProperties}>
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 10, flex: 1 }}>
          <h2 id="evento-titulo">{r.nome.trim() || 'Novo evento'}</h2>
          <div className="linha pequeno" style={{ gap: 14 }}>
            {tipos.map((tp) => {
              const x = TIPOS.find((y) => y.valor === tp)!;
              return <span key={tp} className="linha" style={{ gap: 6 }}><span className="ponto" style={{ background: x.cor }} />{x.sigla} · {x.rotulo}</span>;
            })}
            <span>{quando(rascunho)}{unico && r.inicio && !confirmada ? ' (especulada)' : ''}</span>
            <span>{rotuloSituacao(r.situacao as Evento['situacao'])}</span>
            {r.meta && <span>Meta {formatarReais(Number(r.meta))}</span>}
          </div>
        </div>
        <button type="button" className="botao-fechar" onClick={() => ref.current?.close()} aria-label="Fechar">×</button>
      </div>
      <form className="ficha-corpo" onSubmit={salvar}>
        {aviso && <p className="aviso erro" role="status">{aviso}</p>}
        <label className="campo">Nome do evento *<input value={r.nome} onChange={muda('nome')} required /></label>

        <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>Tipo (pode ser mais de um)</legend>
          <div className="chips-escolha">
            {TIPOS.map((tp) => (
              <label key={tp.valor}>
                <input
                  type="checkbox"
                  checked={tipos.includes(tp.valor)}
                  onChange={(e) => setTipos((ts) => (e.target.checked ? [...ts, tp.valor] : ts.filter((x) => x !== tp.valor)))}
                />
                <span className="ponto" style={{ background: tp.cor }} />
                {tp.sigla} · {tp.rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grade-2">
          <label className="campo">Situação
            <select value={r.situacao} onChange={muda('situacao')}>
              {SITUACOES_EVENTO.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </label>
          <label className="campo">Frequência
            <select value={r.frequencia} onChange={muda('frequencia')}>
              {FREQUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
            </select>
          </label>
        </div>

        <section className="pilha" style={{ gap: 10 }}>
          <h3>Quando</h3>
          <label className="campo">Previsão, do jeito que foi combinada
            <input value={r.previsao} onChange={muda('previsao')} placeholder="Ex.: meio de maio, 2º semestre, fins de semana" />
          </label>
          {unico && (
            <>
              <div className="grade-3">
                <label className="campo">De (início do período)<input type="date" value={r.inicio} onChange={muda('inicio')} /></label>
                <label className="campo">Até (fim do período)<input type="date" value={r.fim} onChange={muda('fim')} /></label>
                <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 10 }}>
                  <input type="checkbox" checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} /> Data confirmada
                </label>
              </div>
              <p className="suave pequeno" style={{ margin: 0 }}>
                Com data ainda especulada, use o período possível (ex.: “meio de maio” = 10 a 23/05). Quando a data fechar, ponha o mesmo dia nos dois campos e marque “Data confirmada”.
              </p>
            </>
          )}
        </section>

        <div className="grade-2">
          <label className="campo">Local<input value={r.local} onChange={muda('local')} /></label>
          <label className="campo">Responsável<input value={r.responsavel} onChange={muda('responsavel')} /></label>
        </div>
        <div className="grade-3">
          <label className="campo">Meta de arrecadação (R$)<input type="number" min="0" step="0.01" value={r.meta} onChange={muda('meta')} /></label>
          <label className="campo">Arrecadado (R$)<input type="number" min="0" step="0.01" value={r.arrecadado} onChange={muda('arrecadado')} /></label>
          <label className="campo">Link<input type="url" value={r.link} onChange={muda('link')} placeholder="https://" /></label>
        </div>
        <label className="campo">Cotas de patrocínio<input value={r.cotas} onChange={muda('cotas')} placeholder="Ex.: Ouro R$ 5.000, Prata R$ 2.000" /></label>
        <label className="campo">Descrição e observações<textarea value={r.descricao} onChange={muda('descricao')} /></label>

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha">
            <button type="submit" className="botao">{evento ? 'Salvar alterações' : 'Criar evento'}</button>
            <button type="button" className="botao secundario" onClick={() => ref.current?.close()}>Cancelar</button>
          </div>
          {evento && podeApagar && (
            confirmarApagar
              ? <button type="button" className="botao secundario" style={{ background: '#7a2a20' }} onClick={apagar}>Confirmar exclusão</button>
              : <button type="button" className="botao secundario" onClick={() => setConfirmarApagar(true)}>Excluir</button>
          )}
        </div>
      </form>
    </dialog>
  );
}
