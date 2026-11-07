// Subabas de cada evento: metas, gastos, patrocinadores e tarefas, e o resumo
// financeiro que a visão geral e a planilha mostram.
//
// Regra de contas (para não contar duas vezes):
// - "Arrecadado" no evento = doações, ingressos e vendas, SEM patrocínio.
// - Patrocínio entra pela subaba Patrocinadores: só conta como captado quando "Recebido".
// - Gasto realizado = valor "Realizado" (ou o previsto, se já está "Pago" sem valor realizado).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Evento } from './eventos';

export type SituacaoGasto = 'previsto' | 'aprovado' | 'pago' | 'cancelado';
export type SituacaoPatrocinio = 'prospectado' | 'em_negociacao' | 'confirmado' | 'recebido' | 'recusado';

export interface MetaEvento {
  id: string;
  evento_id: string;
  descricao: string;
  unidade: string | null;
  alvo: number | null;
  atual: number | null;
  observacao: string | null;
}

export interface GastoEvento {
  id: string;
  evento_id: string;
  descricao: string;
  categoria: string | null;
  fornecedor: string | null;
  previsto: number | null;
  realizado: number | null;
  situacao: SituacaoGasto;
  data: string | null;
  comprovante: string | null;
}

export interface PatrocinioEvento {
  id: string;
  evento_id: string;
  parceria_id: string | null;
  empresa: string;
  cota: string | null;
  valor: number | null;
  contrapartidas: string | null;
  situacao: SituacaoPatrocinio;
  contato: string | null;
  observacao: string | null;
}

export interface TarefaEvento {
  id: string;
  evento_id: string;
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
  feita: boolean;
}

export interface DetalhesEventos {
  metas: MetaEvento[];
  gastos: GastoEvento[];
  patrocinadores: PatrocinioEvento[];
  tarefas: TarefaEvento[];
}

export const DETALHES_VAZIOS: DetalhesEventos = { metas: [], gastos: [], patrocinadores: [], tarefas: [] };

export const CATEGORIAS_GASTO = ['Espaço', 'Alimentação', 'Material', 'Divulgação', 'Transporte', 'Brindes', 'Serviços', 'Outros'];

export const SITUACOES_GASTO: { valor: SituacaoGasto; rotulo: string; cor: string }[] = [
  { valor: 'previsto', rotulo: 'Previsto', cor: '#8E9CA3' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: '#3192B3' },
  { valor: 'pago', rotulo: 'Pago', cor: '#3FA66B' },
  { valor: 'cancelado', rotulo: 'Cancelado', cor: '#6B7F88' },
];

export const SITUACOES_PATROCINIO: { valor: SituacaoPatrocinio; rotulo: string; cor: string }[] = [
  { valor: 'prospectado', rotulo: 'Prospectado', cor: '#8E9CA3' },
  { valor: 'em_negociacao', rotulo: 'Em negociação', cor: '#F9B341' },
  { valor: 'confirmado', rotulo: 'Confirmado', cor: '#3192B3' },
  { valor: 'recebido', rotulo: 'Recebido', cor: '#3FA66B' },
  { valor: 'recusado', rotulo: 'Recusado', cor: '#6B7F88' },
];

const soma = (xs: (number | null | undefined)[]) => xs.reduce<number>((t, x) => t + (x ?? 0), 0);

export interface Financeiro {
  meta: number | null;
  arrecadado: number;
  patrocinioRecebido: number;
  /** Confirmado e ainda não recebido. */
  patrocinioAReceber: number;
  /** Prospectado ou em negociação. */
  patrocinioEmConversa: number;
  /** Arrecadado + patrocínio recebido. */
  captado: number;
  gastosPrevistos: number;
  gastosRealizados: number;
  /** Captado − gastos realizados. */
  saldo: number;
  /** Captado + a receber − gastos previstos: como fecha se tudo sair como planejado. */
  saldoPrevisto: number;
  /** Captado / meta (0–1+), ou null sem meta. */
  progresso: number | null;
}

export const gastoRealizado = (g: GastoEvento) =>
  g.situacao === 'cancelado' ? 0 : (g.realizado ?? (g.situacao === 'pago' ? g.previsto : null) ?? 0);

export function financeiro(evento: Evento, gastos: GastoEvento[], patrocinadores: PatrocinioEvento[]): Financeiro {
  const gs = gastos.filter((g) => g.evento_id === evento.id && g.situacao !== 'cancelado');
  const ps = patrocinadores.filter((p) => p.evento_id === evento.id);
  const valorDe = (...s: SituacaoPatrocinio[]) => soma(ps.filter((p) => s.includes(p.situacao)).map((p) => p.valor));
  const arrecadado = evento.arrecadado ?? 0;
  const patrocinioRecebido = valorDe('recebido');
  const patrocinioAReceber = valorDe('confirmado');
  const captado = arrecadado + patrocinioRecebido;
  const gastosRealizados = soma(gs.map(gastoRealizado));
  const gastosPrevistos = soma(gs.map((g) => Math.max(g.previsto ?? 0, gastoRealizado(g))));
  return {
    meta: evento.meta,
    arrecadado,
    patrocinioRecebido,
    patrocinioAReceber,
    patrocinioEmConversa: valorDe('prospectado', 'em_negociacao'),
    captado,
    gastosPrevistos,
    gastosRealizados,
    saldo: captado - gastosRealizados,
    saldoPrevisto: captado + patrocinioAReceber - gastosPrevistos,
    progresso: evento.meta ? captado / evento.meta : null,
  };
}

/** Percentual de uma meta (0–1+), ou null sem alvo. */
export const progressoDaMeta = (m: MetaEvento) => (m.alvo ? (m.atual ?? 0) / m.alvo : null);

/** Tarefas pendentes do evento, atrasadas primeiro e depois por prazo. */
export function tarefasPendentes(tarefas: TarefaEvento[], eventoId: string): TarefaEvento[] {
  return tarefas
    .filter((t) => t.evento_id === eventoId && !t.feita)
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

/** Conta por evento, para mostrar no card (ex.: "3 tarefas"). */
export function contagens(d: DetalhesEventos, eventoId: string) {
  const de = <T extends { evento_id: string }>(xs: T[]) => xs.filter((x) => x.evento_id === eventoId).length;
  return {
    metas: de(d.metas),
    gastos: de(d.gastos),
    patrocinadores: de(d.patrocinadores),
    tarefas: de(d.tarefas),
    pendentes: d.tarefas.filter((t) => t.evento_id === eventoId && !t.feita).length,
  };
}

export async function carregarDetalhes(sb: SupabaseClient): Promise<DetalhesEventos> {
  const [m, g, p, t] = await Promise.all(
    ['evento_metas', 'evento_gastos', 'evento_patrocinadores', 'evento_tarefas'].map((tab) => sb.from(tab).select('*')),
  );
  const erro = [m, g, p, t].find((r) => r.error)?.error;
  if (erro) throw new Error(erro.message);
  const num = <T extends object>(xs: unknown[] | null, campos: string[]) =>
    (xs ?? []).map((x) => {
      const o = { ...(x as Record<string, unknown>) };
      for (const c of campos) if (o[c] !== null && o[c] !== undefined) o[c] = Number(o[c]);
      return o as T;
    });
  return {
    metas: num<MetaEvento>(m.data, ['alvo', 'atual']),
    gastos: num<GastoEvento>(g.data, ['previsto', 'realizado']),
    patrocinadores: num<PatrocinioEvento>(p.data, ['valor']),
    tarefas: num<TarefaEvento>(t.data, []),
  };
}
