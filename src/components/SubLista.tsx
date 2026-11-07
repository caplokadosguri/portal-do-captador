'use client';

// Lista editável de uma subaba do evento (metas, gastos, patrocinadores, tarefas).
// Cada item se edita no lugar e salva ao sair do campo; o formulário do fim adiciona um novo.

import { ReactNode, useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';

export interface CampoSub {
  k: string;
  rotulo: string;
  tipo?: 'texto' | 'numero' | 'moeda' | 'data' | 'lista' | 'link' | 'marca' | 'longo';
  opcoes?: { valor: string; rotulo: string }[];
  /** Sugestões para digitar (ex.: empresas já cadastradas em Parceiros). */
  sugestoes?: string[];
  obrigatorio?: boolean;
  /** Ocupa a linha inteira. */
  largo?: boolean;
  dica?: string;
}

type Item = { id: string };
const campoDe = (item: Item, k: string) => (item as unknown as Record<string, unknown>)[k];

const paraTexto = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function paraBanco(campo: CampoSub, v: string | boolean): unknown {
  if (campo.tipo === 'marca') return !!v;
  const s = String(v).trim();
  if (campo.tipo === 'numero' || campo.tipo === 'moeda') return s === '' || !Number.isFinite(Number(s)) ? null : Number(s);
  if (campo.tipo === 'lista') return s;
  return s === '' ? null : s;
}

export default function SubLista<T extends Item>({
  tabela,
  eventoId,
  itens,
  campos,
  padrao,
  rotuloNovo,
  podeEditar,
  aoMudar,
  ajustar,
  rodape,
  cabecalhoDoItem,
}: {
  tabela: string;
  eventoId: string;
  itens: T[];
  campos: CampoSub[];
  /** Valores iniciais do formulário "novo". */
  padrao: Record<string, string | boolean>;
  rotuloNovo: string;
  podeEditar: boolean;
  aoMudar: () => void;
  /** Ajusta o que vai para o banco (ex.: ligar o patrocinador a uma empresa de Parceiros). */
  ajustar?: (dados: Record<string, unknown>) => Record<string, unknown>;
  rodape?: ReactNode;
  cabecalhoDoItem?: (item: T) => ReactNode;
}) {
  const [novo, setNovo] = useState<Record<string, string | boolean>>(padrao);
  const [edicao, setEdicao] = useState<Record<string, Record<string, string | boolean>>>({});
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [apagar, setApagar] = useState<string | null>(null);
  const listaSug = (c: CampoSub) => `sug-${tabela}-${c.k}`;

  const valorDe = (item: T, c: CampoSub) => edicao[item.id]?.[c.k] ?? (c.tipo === 'marca' ? !!campoDe(item, c.k) : paraTexto(campoDe(item, c.k)));

  async function gravarCampo(item: T, c: CampoSub, v: string | boolean) {
    const original = c.tipo === 'marca' ? !!campoDe(item, c.k) : paraTexto(campoDe(item, c.k));
    if (v === original) return;
    if (c.obrigatorio && String(v).trim() === '') {
      setErro(`“${c.rotulo}” não pode ficar vazio.`);
      setEdicao((e) => ({ ...e, [item.id]: { ...e[item.id], [c.k]: original } }));
      return;
    }
    let dados: Record<string, unknown> = { [c.k]: paraBanco(c, v) };
    if (ajustar) dados = ajustar(dados);
    const { error } = await supabase().from(tabela).update(dados).eq('id', item.id);
    if (error) return setErro(`Não salvou: ${error.message}`);
    setErro('');
    aoMudar();
  }

  async function adicionar() {
    const faltou = campos.find((c) => c.obrigatorio && String(novo[c.k] ?? '').trim() === '');
    if (faltou) return setErro(`Preencha “${faltou.rotulo}”.`);
    setSalvando(true);
    let dados: Record<string, unknown> = { evento_id: eventoId };
    for (const c of campos) dados[c.k] = paraBanco(c, novo[c.k] ?? '');
    if (ajustar) dados = ajustar(dados);
    const { error } = await supabase().from(tabela).insert(dados);
    setSalvando(false);
    if (error) return setErro(`Não salvou: ${error.message}`);
    setErro('');
    setNovo(padrao);
    aoMudar();
  }

  async function remover(id: string) {
    const { error } = await supabase().from(tabela).delete().eq('id', id);
    setApagar(null);
    if (error) return setErro(`Não apagou: ${error.message}`);
    aoMudar();
  }

  function entrada(c: CampoSub, valor: string | boolean, mudar: (v: string | boolean) => void, sair?: (v: string | boolean) => void) {
    const comum = { 'aria-label': c.rotulo, disabled: !podeEditar };
    if (c.tipo === 'marca') {
      return <input type="checkbox" {...comum} checked={!!valor} onChange={(e) => { mudar(e.target.checked); sair?.(e.target.checked); }} />;
    }
    if (c.tipo === 'lista') {
      return (
        <select {...comum} value={String(valor)} onChange={(e) => { mudar(e.target.value); sair?.(e.target.value); }}>
          {c.opcoes!.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      );
    }
    if (c.tipo === 'longo') {
      return <textarea {...comum} rows={2} value={String(valor)} placeholder={c.dica} onChange={(e) => mudar(e.target.value)} onBlur={(e) => sair?.(e.target.value)} />;
    }
    const tipo = c.tipo === 'numero' || c.tipo === 'moeda' ? 'number' : c.tipo === 'data' ? 'date' : c.tipo === 'link' ? 'url' : 'text';
    return (
      <input
        {...comum}
        type={tipo}
        min={tipo === 'number' ? 0 : undefined}
        step={c.tipo === 'moeda' ? '0.01' : tipo === 'number' ? 'any' : undefined}
        list={c.sugestoes?.length ? listaSug(c) : undefined}
        placeholder={c.dica ?? (c.tipo === 'link' ? 'https://' : undefined)}
        value={String(valor)}
        onChange={(e) => mudar(e.target.value)}
        onBlur={(e) => sair?.(e.target.value)}
      />
    );
  }

  return (
    <div className="pilha" style={{ gap: 12 }}>
      {campos.filter((c) => c.sugestoes?.length).map((c) => (
        <datalist key={c.k} id={listaSug(c)}>{c.sugestoes!.map((s) => <option key={s} value={s} />)}</datalist>
      ))}
      {erro && <p className="aviso erro" role="status" style={{ margin: 0 }}>{erro}</p>}

      {itens.length === 0 && <p className="suave pequeno" style={{ margin: 0 }}>Nada cadastrado ainda.</p>}
      {itens.map((item) => (
        <div key={item.id} className="sub-item">
          {cabecalhoDoItem && <div className="sub-item-topo">{cabecalhoDoItem(item)}</div>}
          <div className="sub-grade">
            {campos.map((c) => (
              <label key={c.k} className={`campo${c.tipo === 'marca' ? ' campo-marca' : ''}`} style={c.largo ? { gridColumn: '1 / -1' } : undefined}>
                {c.rotulo}
                {entrada(
                  c,
                  valorDe(item, c),
                  (v) => setEdicao((e) => ({ ...e, [item.id]: { ...e[item.id], [c.k]: v } })),
                  (v) => gravarCampo(item, c, v),
                )}
              </label>
            ))}
          </div>
          {podeEditar && (
            <div className="linha" style={{ justifyContent: 'flex-end' }}>
              {apagar === item.id ? (
                <>
                  <button type="button" className="botao-link" onClick={() => setApagar(null)}>cancelar</button>
                  <button type="button" className="botao-link texto-erro" onClick={() => remover(item.id)}>confirmar exclusão</button>
                </>
              ) : (
                <button type="button" className="botao-link" onClick={() => setApagar(item.id)}>excluir</button>
              )}
            </div>
          )}
        </div>
      ))}

      {rodape}

      {podeEditar && (
        <div className="sub-item sub-novo">
          <strong className="pequeno">{rotuloNovo}</strong>
          <div className="sub-grade">
            {campos.map((c) => (
              <label key={c.k} className={`campo${c.tipo === 'marca' ? ' campo-marca' : ''}`} style={c.largo ? { gridColumn: '1 / -1' } : undefined}>
                {c.rotulo}{c.obrigatorio ? ' *' : ''}
                {entrada(c, novo[c.k] ?? '', (v) => setNovo((n) => ({ ...n, [c.k]: v })))}
              </label>
            ))}
          </div>
          <span>
            <button type="button" className="botao secundario" onClick={adicionar} disabled={salvando}>{salvando ? 'Salvando…' : '+ Adicionar'}</button>
          </span>
        </div>
      )}
    </div>
  );
}
