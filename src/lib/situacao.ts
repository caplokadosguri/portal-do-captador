// Regras de negócio calculadas a partir dos dados da Trackmob.

import { CHECKPOINTS, Checkpoint, INICIO_DO_PLANO, INTERVALO_DEPOIS } from './plano';
import { mesesEntre, normalizarTitulo, somarMeses } from './texto';

export interface Doacao {
  id: string;
  doador_id: string;
  valor: number | null;
  frequencia: string | null;
  meio_pagamento: string | null;
  status: string | null;
  status_ultima_cobranca: string | null;
  ultima_cobranca_paga: string | null;
  criada_em: string | null;
  finalizada_em: string | null;
  campanha: string | null;
}

export interface Cobranca {
  id: string;
  doacao_id: string | null;
  doador_id: string | null;
  vencimento: string | null;
  pago_em: string | null;
  status: string | null;
  mensagem_erro: string | null;
}

export type Situacao = 'em_dia' | 'atraso_1' | 'atraso_2' | 'atraso_3' | 'pontual' | 'cancelado' | 'sem_dados';

export const NOME_SITUACAO: Record<Situacao, string> = {
  em_dia: 'Em dia',
  atraso_1: 'Atraso de 1 mês',
  atraso_2: 'Atraso de 2 meses',
  atraso_3: 'Atraso de 3 meses ou mais',
  pontual: 'Doação única',
  cancelado: 'Cancelado',
  sem_dados: 'Sem dados de cobrança',
};

export function ehPontual(d: Pick<Doacao, 'frequencia'>): boolean {
  return /unica|pontual|avulsa/.test(normalizarTitulo(d.frequencia ?? ''));
}

export function ehCancelada(d: Pick<Doacao, 'status' | 'finalizada_em'>): boolean {
  return !!d.finalizada_em || /cancel|finaliz|inativ|encerr/.test(normalizarTitulo(d.status ?? ''));
}

export function cobrancaPaga(c: Pick<Cobranca, 'pago_em' | 'status'>): boolean {
  if (c.pago_em) return true;
  const s = normalizarTitulo(c.status ?? '');
  if (/nao|pendente|recus|falh|negad|erro|cancel|vencid|abert/.test(s)) return false;
  return /pag|aprov|confirm|liquid/.test(s);
}

/**
 * Doação principal do doador: a recorrente ativa mais recente; senão a mais recente de todas.
 */
export function doacaoPrincipal(doacoes: Doacao[]): Doacao | null {
  const ordenadas = [...doacoes].sort((a, b) => (b.criada_em ?? '').localeCompare(a.criada_em ?? ''));
  return ordenadas.find((d) => !ehPontual(d) && !ehCancelada(d)) ?? ordenadas[0] ?? null;
}

/**
 * Meses seguidos sem pagamento, contando da cobrança vencida mais recente para trás.
 * Usa o relatório de cobranças; sem ele, estima pela "Última cobrança paga".
 */
export function mesesEmAtraso(doacao: Doacao, cobrancas: Cobranca[], hoje: string): number | null {
  const vencidas = cobrancas
    .filter((c) => c.doacao_id === doacao.id && c.vencimento && c.vencimento <= hoje)
    .sort((a, b) => b.vencimento!.localeCompare(a.vencimento!));
  if (vencidas.length) {
    let n = 0;
    for (const c of vencidas) {
      if (cobrancaPaga(c)) break;
      n++;
    }
    return n;
  }
  if (doacao.ultima_cobranca_paga) return Math.max(0, mesesEntre(doacao.ultima_cobranca_paga, hoje) - 1);
  return null;
}

/**
 * Desde quando está sem pagar: vencimento da cobrança mais antiga da sequência
 * atual de cobranças não pagas. `null` se estiver em dia ou sem dados.
 */
export function inicioDoAtraso(doacao: Doacao, cobrancas: Cobranca[], hoje: string): string | null {
  const vencidas = cobrancas
    .filter((c) => c.doacao_id === doacao.id && c.vencimento && c.vencimento <= hoje)
    .sort((a, b) => b.vencimento!.localeCompare(a.vencimento!));
  let inicio: string | null = null;
  for (const c of vencidas) {
    if (cobrancaPaga(c)) break;
    inicio = c.vencimento;
  }
  if (inicio || vencidas.length) return inicio;
  if (doacao.ultima_cobranca_paga && mesesEntre(doacao.ultima_cobranca_paga, hoje) > 1) return somarMeses(doacao.ultima_cobranca_paga, 1);
  return null;
}

export function situacao(doacao: Doacao | null, cobrancas: Cobranca[], hoje: string): Situacao {
  if (!doacao) return 'sem_dados';
  if (ehCancelada(doacao)) return 'cancelado';
  if (ehPontual(doacao)) return 'pontual';
  const n = mesesEmAtraso(doacao, cobrancas, hoje);
  if (n === null) return 'sem_dados';
  if (n === 0) return 'em_dia';
  if (n === 1) return 'atraso_1';
  if (n === 2) return 'atraso_2';
  return 'atraso_3';
}

export type MotivoFalha = 'atualizar_cartao' | 'lembrete' | 'verificar';

/** Lê a "Mensagem de erro" da última cobrança não paga para sugerir a abordagem. */
export function motivoFalha(cobrancas: Cobranca[], doacaoId: string): { motivo: MotivoFalha; mensagem: string | null } | null {
  const falha = cobrancas
    .filter((c) => c.doacao_id === doacaoId && !cobrancaPaga(c))
    .sort((a, b) => (b.vencimento ?? '').localeCompare(a.vencimento ?? ''))[0];
  if (!falha) return null;
  const s = normalizarTitulo(falha.mensagem_erro ?? '');
  if (/venc|expir|invalid|bloque|cancelad/.test(s)) return { motivo: 'atualizar_cartao', mensagem: falha.mensagem_erro };
  if (/saldo|insufici|limite|nao autoriz/.test(s)) return { motivo: 'lembrete', mensagem: falha.mensagem_erro };
  return { motivo: 'verificar', mensagem: falha.mensagem_erro };
}

export interface PontoDoPlano {
  atual: Checkpoint | null;
  proximo: Checkpoint;
  dataProximo: string;
  mesesDeDoacao: number;
}

function checkpointDoIndice(i: number): Checkpoint {
  if (i < CHECKPOINTS.length) return CHECKPOINTS[i];
  const ultimo = CHECKPOINTS[CHECKPOINTS.length - 1];
  const meses = ultimo.meses + (i - CHECKPOINTS.length + 1) * INTERVALO_DEPOIS;
  const anos = meses / 12;
  const nome = Number.isInteger(anos) ? `${anos} anos` : `${Math.floor(anos)} anos e meio`;
  return { chave: `meses_${meses}`, nome, meses, brinde: true };
}

/** Em que ponto do plano o doador está, pela data de criação da doação. */
export function pontoDoPlano(criadaEm: string, hoje: string): PontoDoPlano {
  const mesesDeDoacao = Math.max(0, mesesEntre(criadaEm, hoje));
  let i = 0;
  while (checkpointDoIndice(i).meses <= mesesDeDoacao) i++;
  const proximo = checkpointDoIndice(i);
  return {
    atual: i > 0 ? checkpointDoIndice(i - 1) : null,
    proximo,
    dataProximo: somarMeses(criadaEm, proximo.meses),
    mesesDeDoacao,
  };
}

/** Checkpoint atual gera brinde? Não para os alcançados antes do lançamento do plano. */
export function brindeDevido(criadaEm: string, hoje: string, inicioDoPlano = INICIO_DO_PLANO): Checkpoint | null {
  const { atual } = pontoDoPlano(criadaEm, hoje);
  if (!atual || !atual.brinde) return null;
  const dataAtual = somarMeses(criadaEm, atual.meses);
  return dataAtual >= inicioDoPlano ? atual : null;
}
