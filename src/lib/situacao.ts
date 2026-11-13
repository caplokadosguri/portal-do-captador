// Regras de negócio calculadas a partir dos dados da Trackmob.

import { CHECKPOINTS, Checkpoint, DIAS_DE_TOLERANCIA, DIAS_MARCO_ATRASADO, DIAS_MARCO_PROXIMO, INICIO_DO_PLANO, INTERVALO_DEPOIS } from './plano';
import { diasEntre, mesesEntre, normalizarTitulo, somarMeses } from './texto';

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
  competencia?: string | null;
  importado_em?: string | null;
}

export type Situacao = 'em_dia' | 'atraso_1' | 'atraso_2' | 'atraso_3' | 'pontual' | 'cancelado' | 'sem_dados' | 'sem_doacao';

export const NOME_SITUACAO: Record<Situacao, string> = {
  em_dia: 'Em dia',
  atraso_1: 'Atraso de 1 mês',
  atraso_2: 'Atraso de 2 meses',
  atraso_3: 'Atraso de 3 meses ou mais',
  pontual: 'Doação única',
  cancelado: 'Cancelado',
  sem_dados: 'Sem dados de cobrança',
  sem_doacao: 'Sem doação concluída',
};

export function ehPontual(d: Pick<Doacao, 'frequencia'>): boolean {
  return /unica|pontual|avulsa/.test(normalizarTitulo(d.frequencia ?? ''));
}

/**
 * Doação única que chegou a ser paga. Na Trackmob, "Inativa"/"Pendente" sem pagamento
 * é Pix ou boleto que não foi pago: não é doação (a pessoa fica como cadastro sem doação).
 */
export function pontualConcluida(d: Pick<Doacao, 'frequencia' | 'status' | 'ultima_cobranca_paga' | 'status_ultima_cobranca'>): boolean {
  if (!ehPontual(d)) return false;
  const paga = !!d.ultima_cobranca_paga || /pag/.test(normalizarTitulo(d.status_ultima_cobranca ?? ''));
  // Na dúvida (status desconhecido), conta como doação.
  return paga || !/inativ|pendent|cancel|expir|recus/.test(normalizarTitulo(d.status ?? ''));
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
  return (
    ordenadas.find((d) => !ehPontual(d) && !ehCancelada(d)) ??
    // Depois, a mais recente que existiu de fato (recorrente encerrada ou única paga)...
    ordenadas.find((d) => !ehPontual(d) || pontualConcluida(d)) ??
    // ...e só então uma única não paga.
    ordenadas[0] ??
    null
  );
}

/**
 * Meses seguidos sem pagamento, contando da cobrança vencida mais recente para trás.
 * Usa o relatório de cobranças; sem ele, estima pela "Última cobrança paga".
 */
/** "03/2026", "2026-03", "2026-03-10" → "2026-03". */
export function mesDaCompetencia(competencia: string | null | undefined, vencimento: string | null): string | null {
  const t = (competencia ?? '').trim();
  let m = /^(\d{1,2})[/-](\d{4})/.exec(t);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})[/-](\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  return vencimento ? vencimento.slice(0, 7) : null;
}

interface MesCobrado {
  mes: string;
  vencimento: string;
  paga: boolean;
}

/**
 * Os meses cobrados da doação, do mais recente para o mais antigo. Várias
 * tentativas no mesmo mês (a Trackmob tenta de novo quando falha) contam como
 * um mês só: se qualquer tentativa foi paga, o mês está pago. Cobranças que
 * venceram há menos de DIAS_DE_TOLERANCIA ainda não contam (podem ser
 * retentadas).
 */
function mesesCobrados(doacao: Doacao, cobrancas: Cobranca[], hoje: string): MesCobrado[] {
  const meses = new Map<string, MesCobrado>();
  for (const c of cobrancas) {
    if (c.doacao_id !== doacao.id || !c.vencimento || diasEntre(c.vencimento, hoje) < DIAS_DE_TOLERANCIA) continue;
    const mes = mesDaCompetencia(c.competencia, c.vencimento)!;
    const m = meses.get(mes) ?? { mes, vencimento: c.vencimento, paga: false };
    if (c.vencimento < m.vencimento) m.vencimento = c.vencimento;
    if (cobrancaPaga(c)) m.paga = true;
    meses.set(mes, m);
  }
  return [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

/**
 * Meses seguidos sem pagamento, contando do mês mais recente para trás.
 * Quem falhou em março mas pagou abril e maio está EM DIA: a contagem para no
 * primeiro mês pago. Na dúvida, não cobra:
 * - se o relatório de doações diz que a última cobrança foi paga, está em dia;
 * - se houve pagamento (última cobrança paga) depois do vencimento de um mês
 *   em aberto, esse mês não conta.
 */
function sequenciaEmAberto(doacao: Doacao, cobrancas: Cobranca[], hoje: string): MesCobrado[] | null {
  const meses = mesesCobrados(doacao, cobrancas, hoje);
  if (!meses.length) return null;
  if (doacao.status_ultima_cobranca && cobrancaPaga({ pago_em: null, status: doacao.status_ultima_cobranca })) return [];
  const emAberto: MesCobrado[] = [];
  for (const m of meses) {
    if (m.paga) break;
    if (doacao.ultima_cobranca_paga && doacao.ultima_cobranca_paga >= m.vencimento) break;
    emAberto.push(m);
  }
  return emAberto;
}

export function mesesEmAtraso(doacao: Doacao, cobrancas: Cobranca[], hoje: string): number | null {
  const seq = sequenciaEmAberto(doacao, cobrancas, hoje);
  if (seq) return seq.length;
  if (doacao.status_ultima_cobranca && cobrancaPaga({ pago_em: null, status: doacao.status_ultima_cobranca })) return 0;
  if (doacao.ultima_cobranca_paga) return Math.max(0, mesesEntre(doacao.ultima_cobranca_paga, hoje) - 1);
  return null;
}

/**
 * Desde quando está sem pagar: vencimento do mês mais antigo da sequência
 * atual em aberto. `null` se estiver em dia ou sem dados.
 */
export function inicioDoAtraso(doacao: Doacao, cobrancas: Cobranca[], hoje: string): string | null {
  const seq = sequenciaEmAberto(doacao, cobrancas, hoje);
  if (seq) return seq.length ? seq[seq.length - 1].vencimento : null;
  if (doacao.ultima_cobranca_paga && mesesEntre(doacao.ultima_cobranca_paga, hoje) > 1) return somarMeses(doacao.ultima_cobranca_paga, 1);
  return null;
}

export function situacao(doacao: Doacao | null, cobrancas: Cobranca[], hoje: string): Situacao {
  // Cadastrado na Trackmob (relatório de doadores) mas sem nenhuma doação: lead.
  if (!doacao) return 'sem_doacao';
  // Doação única "Finalizada" é doação concluída (paga), não cancelamento.
  if (ehPontual(doacao)) {
    if (!pontualConcluida(doacao)) return 'sem_doacao';
    return /cancel/.test(normalizarTitulo(doacao.status ?? '')) ? 'cancelado' : 'pontual';
  }
  if (ehCancelada(doacao)) return 'cancelado';
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
  // Só as tentativas depois do último pagamento: uma falha antiga já resolvida não conta.
  const daDoacao = cobrancas.filter((c) => c.doacao_id === doacaoId && c.vencimento);
  const ultimaPaga = daDoacao.filter(cobrancaPaga).reduce<string>((m, c) => (c.vencimento! > m ? c.vencimento! : m), '');
  const falha = daDoacao
    .filter((c) => !cobrancaPaga(c) && c.vencimento! > ultimaPaga)
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

export interface MarcoDoPlano {
  checkpoint: Checkpoint;
  /** Data do marco. */
  data: string;
  /** Dias até o marco: negativo = atrasado, 0 = hoje. */
  dias: number;
}

/**
 * O marco que pede ação agora: o já alcançado (hoje ou atrasado até DIAS_MARCO_ATRASADO
 * dias) sem mensagem do plano desde a data dele; senão, o próximo se chega em até
 * DIAS_MARCO_PROXIMO dias. No dia do marco, ele é o "atual" do plano (por isso sumia).
 */
export function marcoDoPlano(criadaEm: string, hoje: string, ultimaMensagemDoPlano: string | null): MarcoDoPlano | null {
  const { atual, proximo, dataProximo } = pontoDoPlano(criadaEm, hoje);
  if (atual) {
    const data = somarMeses(criadaEm, atual.meses);
    const enviada = !!ultimaMensagemDoPlano && ultimaMensagemDoPlano.slice(0, 10) >= data;
    const dias = diasEntre(hoje, data);
    if (!enviada && -dias <= DIAS_MARCO_ATRASADO) return { checkpoint: atual, data, dias };
  }
  const dias = diasEntre(hoje, dataProximo);
  return dias <= DIAS_MARCO_PROXIMO ? { checkpoint: proximo, data: dataProximo, dias } : null;
}

/** Checkpoint atual gera brinde? Não para os alcançados antes do lançamento do plano. */
export function brindeDevido(criadaEm: string, hoje: string, inicioDoPlano = INICIO_DO_PLANO): Checkpoint | null {
  const { atual } = pontoDoPlano(criadaEm, hoje);
  if (!atual || !atual.brinde) return null;
  const dataAtual = somarMeses(criadaEm, atual.meses);
  return dataAtual >= inicioDoPlano ? atual : null;
}
