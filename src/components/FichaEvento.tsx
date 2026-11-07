'use client';

import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import SubLista, { CampoSub } from '@/components/SubLista';
import { formatarReais } from '@/lib/contato';
import { corDoEvento, Evento, FREQUENCIAS, quando, rotuloSituacao, SITUACOES_EVENTO, TipoEvento, TIPOS } from '@/lib/eventos';
import {
  CATEGORIAS_GASTO, contagens, DetalhesEventos, financeiro, gastoRealizado, progressoDaMeta, SITUACOES_GASTO, SITUACOES_PATROCINIO, tarefasPendentes,
} from '@/lib/eventosDetalhe';
import { supabase } from '@/lib/supabase/cliente';

type Aba = 'geral' | 'dados' | 'metas' | 'gastos' | 'patrocinadores' | 'tarefas';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

function Selo({ cor, children }: { cor: string; children: ReactNode }) {
  return <span className="selo-mini" style={{ '--cor-selo': cor } as CSSProperties}>{children}</span>;
}

function Barra({ valor }: { valor: number | null }) {
  return <div className="barra-progresso" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, (valor ?? 0) * 100))}%` }} /></div>;
}

type Texto = Record<'nome' | 'previsao' | 'inicio' | 'fim' | 'local' | 'responsavel' | 'meta' | 'arrecadado' | 'cotas' | 'descricao' | 'link' | 'situacao' | 'frequencia', string>;

const VAZIO: Texto = {
  nome: '', previsao: '', inicio: '', fim: '', local: '', responsavel: '', meta: '', arrecadado: '', cotas: '', descricao: '', link: '',
  situacao: 'proposta', frequencia: 'unico',
};

export default function FichaEvento({
  evento,
  detalhes,
  empresas,
  hoje,
  podeApagar,
  aoFechar,
  aoSalvar,
  aoMudarDetalhes,
}: {
  evento: Evento | null;
  detalhes: DetalhesEventos;
  /** Empresas do módulo Parceiros (vazio se o membro não vê Parceiros). */
  empresas: { id: string; nome: string }[];
  hoje: string;
  podeApagar: boolean;
  aoFechar: () => void;
  /** Com o id quando o evento acabou de ser criado. */
  aoSalvar: (criado?: string) => void;
  aoMudarDetalhes: () => void;
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
  const [aba, setAba] = useState<Aba>(evento ? 'geral' : 'dados');

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
    if (evento) {
      const { error } = await sb.from('eventos').update(dados).eq('id', evento.id);
      if (error) return setAviso(`Não salvou: ${error.message}`);
      setAviso('');
      aoSalvar();
      setAba('geral');
      return;
    }
    const { data, error } = await sb.from('eventos').insert(dados).select('id').single();
    if (error) return setAviso(`Não salvou: ${error.message}`);
    // Abre o evento recém-criado, já com as subabas (metas, gastos, patrocinadores, tarefas).
    aoSalvar(data.id as string);
  }

  async function apagar() {
    if (!evento) return;
    const { error } = await supabase().from('eventos').delete().eq('id', evento.id);
    if (error) return setAviso(`Não apagou: ${error.message}`);
    aoSalvar();
    ref.current?.close();
  }

  const id = evento?.id ?? '';
  const metas = detalhes.metas.filter((m) => m.evento_id === id);
  const gastos = detalhes.gastos.filter((g) => g.evento_id === id);
  const patrocinadores = detalhes.patrocinadores.filter((p) => p.evento_id === id);
  const tarefas = detalhes.tarefas
    .filter((t) => t.evento_id === id)
    .sort((a, b) => Number(a.feita) - Number(b.feita) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'));
  const n = contagens(detalhes, id);
  const ABAS: { valor: Aba; rotulo: string; conta?: number }[] = [
    { valor: 'geral', rotulo: 'Visão geral' },
    { valor: 'dados', rotulo: 'Dados do evento' },
    { valor: 'metas', rotulo: 'Metas', conta: n.metas },
    { valor: 'gastos', rotulo: 'Gastos', conta: n.gastos },
    { valor: 'patrocinadores', rotulo: 'Patrocinadores', conta: n.patrocinadores },
    { valor: 'tarefas', rotulo: 'Tarefas', conta: n.pendentes },
  ];
  const ligarEmpresa = (d: Record<string, unknown>) => {
    if (!('empresa' in d)) return d;
    const nome = String(d.empresa ?? '').trim().toLowerCase();
    return { ...d, parceria_id: empresas.find((e) => e.nome.trim().toLowerCase() === nome)?.id ?? null };
  };

  const CAMPOS_METAS: CampoSub[] = [
    { k: 'descricao', rotulo: 'Meta', obrigatorio: true, dica: 'Ex.: público presente, ingressos, voluntários' },
    { k: 'unidade', rotulo: 'Unidade', dica: 'pessoas, ingressos…' },
    { k: 'alvo', rotulo: 'Alvo', tipo: 'numero' },
    { k: 'atual', rotulo: 'Atual', tipo: 'numero' },
    { k: 'observacao', rotulo: 'Observação', largo: true },
  ];
  const CAMPOS_GASTOS: CampoSub[] = [
    { k: 'descricao', rotulo: 'Descrição', obrigatorio: true },
    { k: 'categoria', rotulo: 'Categoria', sugestoes: CATEGORIAS_GASTO },
    { k: 'fornecedor', rotulo: 'Fornecedor' },
    { k: 'situacao', rotulo: 'Situação', tipo: 'lista', opcoes: SITUACOES_GASTO },
    { k: 'previsto', rotulo: 'Previsto (R$)', tipo: 'moeda' },
    { k: 'realizado', rotulo: 'Realizado (R$)', tipo: 'moeda' },
    { k: 'data', rotulo: 'Data', tipo: 'data' },
    { k: 'comprovante', rotulo: 'Comprovante (link)', tipo: 'link' },
  ];
  const CAMPOS_PATROCINIO: CampoSub[] = [
    { k: 'empresa', rotulo: 'Empresa', obrigatorio: true, sugestoes: empresas.map((e) => e.nome) },
    { k: 'cota', rotulo: 'Cota', dica: 'Ouro, Prata…' },
    { k: 'valor', rotulo: 'Valor (R$)', tipo: 'moeda' },
    { k: 'situacao', rotulo: 'Situação', tipo: 'lista', opcoes: SITUACOES_PATROCINIO },
    { k: 'contrapartidas', rotulo: 'Contrapartidas', tipo: 'longo', largo: true, dica: 'Logo na camiseta, menção no Instagram…' },
    { k: 'contato', rotulo: 'Contato' },
    { k: 'observacao', rotulo: 'Observação' },
  ];
  const CAMPOS_TAREFAS: CampoSub[] = [
    { k: 'descricao', rotulo: 'Tarefa', obrigatorio: true, largo: true },
    { k: 'responsavel', rotulo: 'Responsável' },
    { k: 'prazo', rotulo: 'Prazo', tipo: 'data' },
    { k: 'feita', rotulo: 'Feita', tipo: 'marca' },
  ];
  const comum = { eventoId: id, podeEditar: true, aoMudar: aoMudarDetalhes };

  function corpoDaAba(e: Evento): ReactNode {
    const f = financeiro(e, detalhes.gastos, detalhes.patrocinadores);
    if (aba === 'geral') {
      const pend = tarefasPendentes(detalhes.tarefas, e.id);
      return (
        <>
          <section className="pilha" style={{ gap: 8 }}>
            <h3>Arrecadação</h3>
            {f.meta ? (
              <>
                <span className="pequeno">Captado <strong>{formatarReais(f.captado)}</strong> de {formatarReais(f.meta)} · {pct(f.progresso)}</span>
                <Barra valor={f.progresso} />
              </>
            ) : (
              <span className="suave pequeno">Sem meta de arrecadação. Defina em “Dados do evento”.</span>
            )}
          </section>
          <div className="numeros">
            <div className="numero"><strong>{formatarReais(f.arrecadado)}</strong><span>Arrecadado (doações, ingressos, vendas)</span></div>
            <div className="numero"><strong>{formatarReais(f.patrocinioRecebido)}</strong><span>Patrocínio recebido</span></div>
            <div className="numero"><strong>{formatarReais(f.patrocinioAReceber)}</strong><span>Patrocínio confirmado a receber</span></div>
            <div className="numero"><strong>{formatarReais(f.patrocinioEmConversa)}</strong><span>Patrocínio em conversa</span></div>
            <div className="numero"><strong>{formatarReais(f.gastosPrevistos)}</strong><span>Gastos previstos</span></div>
            <div className="numero"><strong>{formatarReais(f.gastosRealizados)}</strong><span>Gastos realizados</span></div>
            <div className={`numero ${f.saldo >= 0 ? 'positivo' : 'negativo'}`}><strong>{formatarReais(f.saldo)}</strong><span>Saldo hoje (captado − gasto)</span></div>
            <div className={`numero ${f.saldoPrevisto >= 0 ? 'positivo' : 'negativo'}`}><strong>{formatarReais(f.saldoPrevisto)}</strong><span>Saldo previsto, se tudo sair como planejado</span></div>
          </div>
          {metas.length > 0 && (
            <section className="pilha" style={{ gap: 10 }}>
              <h3>Outras metas</h3>
              {metas.map((m) => (
                <div key={m.id} className="pilha" style={{ gap: 4 }}>
                  <span className="pequeno">{m.descricao}: <strong>{m.atual ?? 0}</strong>{m.alvo ? ` de ${m.alvo}` : ''} {m.unidade ?? ''} · {pct(progressoDaMeta(m))}</span>
                  <Barra valor={progressoDaMeta(m)} />
                </div>
              ))}
            </section>
          )}
          <section className="pilha" style={{ gap: 8 }}>
            <h3>Próximas tarefas</h3>
            {pend.length === 0 ? (
              <span className="suave pequeno">Nenhuma tarefa pendente.</span>
            ) : (
              <ul className="lista-simples">
                {pend.slice(0, 5).map((t) => (
                  <li key={t.id} className={t.prazo && t.prazo < hoje ? 'tarefa-atrasada' : undefined}>
                    {t.descricao}{t.responsavel ? ` · ${t.responsavel}` : ''}{t.prazo ? ` · até ${dataBr(t.prazo)}${t.prazo < hoje ? ' (atrasada)' : ''}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {pend.length > 5 && <span><button type="button" className="botao-link" onClick={() => setAba('tarefas')}>ver as {pend.length} tarefas</button></span>}
          </section>
        </>
      );
    }
    if (aba === 'metas') {
      return (
        <>
          <section className="cartao pilha" style={{ gap: 8 }}>
            <strong>Meta de arrecadação</strong>
            {f.meta ? (
              <>
                <span className="pequeno">Captado {formatarReais(f.captado)} de {formatarReais(f.meta)} · {pct(f.progresso)}</span>
                <Barra valor={f.progresso} />
              </>
            ) : <span className="suave pequeno">Sem meta definida.</span>}
            <span className="suave pequeno">A meta em reais e o arrecadado ficam em “Dados do evento”. Aqui entram as outras metas.</span>
          </section>
          <SubLista
            key="metas" tabela="evento_metas" itens={metas} campos={CAMPOS_METAS} rotuloNovo="Nova meta"
            padrao={{ descricao: '', unidade: '', alvo: '', atual: '', observacao: '' }} {...comum}
            cabecalhoDoItem={(m) => {
              const p = progressoDaMeta(m);
              return p === null ? null : <><span style={{ flex: 1 }}><Barra valor={p} /></span><strong>{pct(p)}</strong></>;
            }}
          />
        </>
      );
    }
    if (aba === 'gastos') {
      return (
        <SubLista
          key="gastos" tabela="evento_gastos" itens={gastos} campos={CAMPOS_GASTOS} rotuloNovo="Novo gasto"
          padrao={{ descricao: '', categoria: '', fornecedor: '', situacao: 'previsto', previsto: '', realizado: '', data: '', comprovante: '' }} {...comum}
          cabecalhoDoItem={(g) => {
            const s = SITUACOES_GASTO.find((x) => x.valor === g.situacao)!;
            const feito = gastoRealizado(g);
            return (
              <>
                <Selo cor={s.cor}>{s.rotulo}</Selo>
                {g.situacao !== 'cancelado' && <span className="suave">{feito > 0 ? `gasto: ${formatarReais(feito)}` : 'ainda não gasto'}</span>}
              </>
            );
          }}
          rodape={gastos.length > 0 && (
            <p className="pequeno" style={{ margin: 0 }}>
              Total previsto <strong>{formatarReais(f.gastosPrevistos)}</strong> · realizado <strong>{formatarReais(f.gastosRealizados)}</strong> (cancelados não contam)
            </p>
          )}
        />
      );
    }
    if (aba === 'patrocinadores') {
      return (
        <SubLista
          key="patrocinadores" tabela="evento_patrocinadores" itens={patrocinadores} campos={CAMPOS_PATROCINIO} rotuloNovo="Novo patrocinador"
          padrao={{ empresa: '', cota: '', valor: '', situacao: 'prospectado', contato: '', contrapartidas: '', observacao: '' }} {...comum}
          ajustar={ligarEmpresa}
          cabecalhoDoItem={(p) => {
            const s = SITUACOES_PATROCINIO.find((x) => x.valor === p.situacao)!;
            return <><Selo cor={s.cor}>{s.rotulo}</Selo>{p.parceria_id && <span className="suave">ligado a Parceiros</span>}</>;
          }}
          rodape={patrocinadores.length > 0 && (
            <p className="pequeno" style={{ margin: 0 }}>
              Recebido <strong>{formatarReais(f.patrocinioRecebido)}</strong> · a receber <strong>{formatarReais(f.patrocinioAReceber)}</strong> · em conversa {formatarReais(f.patrocinioEmConversa)}
            </p>
          )}
        />
      );
    }
    return (
      <SubLista
        key="tarefas" tabela="evento_tarefas" itens={tarefas} campos={CAMPOS_TAREFAS} rotuloNovo="Nova tarefa"
        padrao={{ descricao: '', responsavel: '', prazo: '', feita: false }} {...comum}
        cabecalhoDoItem={(t) => (!t.feita && t.prazo && t.prazo < hoje ? <span className="tarefa-atrasada">Atrasada desde {dataBr(t.prazo)}</span> : null)}
      />
    );
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
      {evento && (
        <div className="abas-ficha" role="tablist" aria-label="Partes do evento">
          {ABAS.map((a) => (
            <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} onClick={() => setAba(a.valor)}>
              {a.rotulo}{a.conta !== undefined && a.conta > 0 && <span className="conta">{a.conta}</span>}
            </button>
          ))}
        </div>
      )}
      {evento && aba !== 'dados' && <div className="ficha-corpo">{corpoDaAba(evento)}</div>}
      {aba === 'dados' && (
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
          <label className="campo">Arrecadado sem patrocínio (R$)<input type="number" min="0" step="0.01" value={r.arrecadado} onChange={muda('arrecadado')} /></label>
          <label className="campo">Link<input type="url" value={r.link} onChange={muda('link')} placeholder="https://" /></label>
        </div>
        <p className="suave pequeno" style={{ margin: '-8px 0 0' }}>
          Arrecadado = doações, ingressos e vendas. O patrocínio entra pela aba Patrocinadores e só conta quando “Recebido”.
        </p>
        <label className="campo">Cotas de patrocínio<input value={r.cotas} onChange={muda('cotas')} placeholder="Ex.: Ouro R$ 5.000, Prata R$ 2.000" /></label>
        <label className="campo">Descrição e observações<textarea value={r.descricao} onChange={muda('descricao')} /></label>

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha">
            <button type="submit" className="botao">{evento ? 'Salvar alterações' : 'Criar evento'}</button>
            <button type="button" className="botao secundario" onClick={() => (evento ? setAba('geral') : ref.current?.close())}>{evento ? 'Voltar' : 'Cancelar'}</button>
          </div>
          {evento && podeApagar && (
            confirmarApagar
              ? <button type="button" className="botao secundario" style={{ background: '#7a2a20' }} onClick={apagar}>Confirmar exclusão</button>
              : <button type="button" className="botao secundario" onClick={() => setConfirmarApagar(true)}>Excluir</button>
          )}
        </div>
      </form>
      )}
    </dialog>
  );
}
