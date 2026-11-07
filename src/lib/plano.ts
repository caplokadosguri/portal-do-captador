// Configuração do plano de doadores. Ajuste aqui depois da reunião com o marketing.

/** Data de lançamento do plano. Checkpoints anteriores a ela não geram brinde (sem retroativo). */
export const INICIO_DO_PLANO = '2027-01-01';

export interface Checkpoint {
  chave: string;
  nome: string;
  meses: number; // meses depois da data de criação da doação
  brinde: boolean;
}

// PENDENTE: definir o que conta como "1ª renovação" para doador mensal. Por ora: 1 mês.
export const CHECKPOINTS: Checkpoint[] = [
  { chave: 'inicio', nome: 'Boas-vindas', meses: 0, brinde: false },
  { chave: 'renovacao_1', nome: '1ª renovação', meses: 1, brinde: true },
  { chave: 'meses_6', nome: '6 meses', meses: 6, brinde: true },
  { chave: 'ano_1', nome: '1 ano', meses: 12, brinde: true },
  { chave: 'meses_18', nome: '1 ano e meio', meses: 18, brinde: true },
];

/** Depois do último checkpoint fixo, um novo a cada 6 meses. */
export const INTERVALO_DEPOIS = 6;

/** Doação única a partir deste valor recebe contato pessoal (PENDENTE: definir com o marketing). */
export const VALOR_ALTO_PONTUAL = 500;

/** Convites para doação mensal antes de o pontual ficar só com a newsletter (PENDENTE). */
export const MAX_CONVITES_PONTUAL = 3;

/**
 * Dias depois do vencimento antes de uma cobrança falha contar como atraso.
 * A Trackmob tenta cobrar de novo nesse intervalo; antes disso não se cobra
 * ninguém. PENDENTE: confirmar com a Trackmob o prazo das novas tentativas.
 */
export const DIAS_DE_TOLERANCIA = 7;

/** Dados de pagamento mais velhos que isto pedem conferência na Trackmob antes de cobrar. */
export const DIAS_PARA_CONFERIR = 3;
