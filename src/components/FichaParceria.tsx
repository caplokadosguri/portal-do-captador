'use client';

import { CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { formatarData } from '@/lib/contato';
import { CANAIS, corStatus, Parceria, rotuloStatus, STATUS_ABORDAGEM, TIPOS_PARCERIA } from '@/lib/parceiros';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

type Campos = Omit<Parceria, 'id' | 'criado_em' | 'atualizado_em'>;
type Rascunho = Record<keyof Campos, string>;

const VAZIO: Rascunho = {
  organizacao: '', pessoa: '', cargo: '', email: '', telefone: '', rede_social: '', contexto: '', canal: '', mensagem: '',
  tipo: '', responsavel: '', contato_1: '', contato_2: '', contato_3: '', contato_4: '', ultimo_retorno: '', proxima_acao: '',
  status: 'contato_iniciado', observacoes: '',
};

export default function FichaParceria({
  parceria,
  responsaveis,
  podeApagar,
  aoFechar,
  aoSalvar,
}: {
  parceria: Parceria | null;
  responsaveis: string[];
  podeApagar: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [r, setR] = useState<Rascunho>(() => {
    if (!parceria) return VAZIO;
    const x = { ...VAZIO };
    for (const k of Object.keys(VAZIO) as (keyof Rascunho)[]) x[k] = parceria[k] === null ? '' : String(parceria[k]);
    return x;
  });
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const muda = (k: keyof Rascunho) => (ev: { target: { value: string } }) => setR((x) => ({ ...x, [k]: ev.target.value }));
  const cor = corStatus(r.status as Parceria['status']);
  const contatos = (['contato_1', 'contato_2', 'contato_3', 'contato_4'] as const).filter((k) => r[k]);

  function registrarHoje() {
    const livre = (['contato_1', 'contato_2', 'contato_3', 'contato_4'] as const).find((k) => !r[k]);
    if (!livre) return setAviso('Os quatro contatos já estão preenchidos.');
    setR((x) => ({ ...x, [livre]: hojeIso(), status: x.status === 'contato_iniciado' && livre !== 'contato_1' ? 'aguardando_retorno' : x.status }));
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!r.organizacao.trim()) return setAviso('Informe a organização.');
    const dados: Record<string, string | null> = {};
    for (const k of Object.keys(VAZIO) as (keyof Rascunho)[]) dados[k] = r[k].trim() === '' ? null : r[k].trim();
    dados.status = r.status;
    const sb = supabase();
    const { error } = parceria ? await sb.from('parcerias').update(dados).eq('id', parceria.id) : await sb.from('parcerias').insert(dados);
    if (error) return setAviso(`Não salvou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  async function apagar() {
    if (!parceria) return;
    const { error } = await supabase().from('parcerias').delete().eq('id', parceria.id);
    if (error) return setAviso(`Não apagou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="parceria-titulo" style={{ '--cor-ficha': cor } as CSSProperties}>
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 10, flex: 1 }}>
          <h2 id="parceria-titulo">{r.organizacao.trim() || 'Nova abordagem'}</h2>
          <div className="linha pequeno" style={{ gap: 14 }}>
            <span className="linha" style={{ gap: 6 }}><span className="ponto" style={{ background: cor }} />{rotuloStatus(r.status as Parceria['status'])}</span>
            {r.pessoa && <span>{r.pessoa}{r.cargo ? ` · ${r.cargo}` : ''}</span>}
            {contatos.length > 0 && <span>{contatos.length} contato(s), último em {formatarData(r[contatos[contatos.length - 1]])}</span>}
          </div>
        </div>
        <button type="button" className="botao-fechar" onClick={() => ref.current?.close()} aria-label="Fechar">×</button>
      </div>
      <form className="ficha-corpo" onSubmit={salvar}>
        {aviso && <p className="aviso erro" role="status">{aviso}</p>}
        <div className="grade-3">
          <label className="campo">Organização *<input value={r.organizacao} onChange={muda('organizacao')} required /></label>
          <label className="campo">Nome da pessoa<input value={r.pessoa} onChange={muda('pessoa')} /></label>
          <label className="campo">Cargo<input value={r.cargo} onChange={muda('cargo')} /></label>
        </div>
        <div className="grade-3">
          <label className="campo">E-mail<input type="email" value={r.email} onChange={muda('email')} /></label>
          <label className="campo">Telefone / WhatsApp<input type="tel" value={r.telefone} onChange={muda('telefone')} /></label>
          <label className="campo">Perfil em rede social (LinkedIn)<input value={r.rede_social} onChange={muda('rede_social')} placeholder="https://" /></label>
        </div>
        <label className="campo">Contexto prévio relevante<textarea value={r.contexto} onChange={muda('contexto')} placeholder="Como chegamos até eles, histórico, afinidade com o CASD" /></label>
        <div className="grade-3">
          <label className="campo">Canal preferencial de contato
            <select value={r.canal} onChange={muda('canal')}>
              <option value="">—</option>
              {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="campo">Tipo de parceria pretendida
            <select value={r.tipo} onChange={muda('tipo')}>
              <option value="">—</option>
              {TIPOS_PARCERIA.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="campo">Responsável pela abordagem
            <input list="responsaveis-parceria" value={r.responsavel} onChange={muda('responsavel')} />
            <datalist id="responsaveis-parceria">{responsaveis.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
        </div>
        <label className="campo">Mensagem-chave / proposta<textarea value={r.mensagem} onChange={muda('mensagem')} /></label>

        <section className="pilha" style={{ gap: 10 }}>
          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <h3>Contatos</h3>
            <button type="button" className="botao secundario pequeno" onClick={registrarHoje}>+ Registrar contato hoje</button>
          </div>
          <div className="grade-4">
            {(['contato_1', 'contato_2', 'contato_3', 'contato_4'] as const).map((k, i) => (
              <label key={k} className="campo">Data do {i + 1}º contato<input type="date" value={r[k]} onChange={muda(k)} /></label>
            ))}
          </div>
          <div className="grade-2">
            <label className="campo">Resumo do último retorno<input value={r.ultimo_retorno} onChange={muda('ultimo_retorno')} /></label>
            <label className="campo">Resumo da próxima ação prevista<input value={r.proxima_acao} onChange={muda('proxima_acao')} /></label>
          </div>
          <label className="campo">Status da abordagem
            <select value={r.status} onChange={muda('status')}>
              {STATUS_ABORDAGEM.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </label>
        </section>
        <label className="campo">Observações<textarea value={r.observacoes} onChange={muda('observacoes')} /></label>

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha">
            <button type="submit" className="botao">{parceria ? 'Salvar alterações' : 'Criar abordagem'}</button>
            <button type="button" className="botao secundario" onClick={() => ref.current?.close()}>Cancelar</button>
          </div>
          {parceria && podeApagar && (
            confirmar
              ? <button type="button" className="botao secundario" style={{ background: '#7a2a20' }} onClick={apagar}>Confirmar exclusão</button>
              : <button type="button" className="botao secundario" onClick={() => setConfirmar(true)}>Excluir</button>
          )}
        </div>
      </form>
    </dialog>
  );
}
