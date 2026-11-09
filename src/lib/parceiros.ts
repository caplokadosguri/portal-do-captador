// Parceiros: o plano de abordagem de pessoas jurídicas (aba "Parcerias e
// Doações PJ" do modelo do CASD). As listas são as mesmas da planilha.

import { diasEntre } from './texto';

export type StatusAbordagem =
  | 'a_abordar' | 'contato_iniciado' | 'aguardando_retorno' | 'reuniao_marcada' | 'proposta_elaboracao' | 'proposta_enviada'
  | 'proposta_analise' | 'parceria_fechada' | 'apoio_confirmado' | 'apoio_recusado' | 'encerrado_sem_resposta'
  | 'alimentar_futuro';

export interface Parceria {
  id: string;
  organizacao: string;
  pessoa: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  rede_social: string | null;
  contexto: string | null;
  canal: string | null;
  mensagem: string | null;
  tipo: string | null;
  responsavel: string | null;
  contato_1: string | null;
  contato_2: string | null;
  contato_3: string | null;
  contato_4: string | null;
  ultimo_retorno: string | null;
  proxima_acao: string | null;
  status: StatusAbordagem;
  /** Classificação do membro depois da abordagem. */
  interesse: Interesse | null;
  observacoes: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export type Interesse = 'sem_retorno' | 'frio' | 'morno' | 'quente';

export const INTERESSES: { valor: Interesse; rotulo: string; cor: string }[] = [
  { valor: 'sem_retorno', rotulo: 'Sem retorno ainda', cor: '#8E9CA3' },
  { valor: 'frio', rotulo: 'Frio (pouco interesse)', cor: '#5DA9D6' },
  { valor: 'morno', rotulo: 'Morno (algum interesse)', cor: '#F9B341' },
  { valor: 'quente', rotulo: 'Quente (muito interesse)', cor: '#E5533D' },
];

export const STATUS_ABORDAGEM: { valor: StatusAbordagem; rotulo: string; cor: string }[] = [
  { valor: 'a_abordar', rotulo: 'A abordar (mapeada)', cor: '#8E9CA3' },
  { valor: 'contato_iniciado', rotulo: 'Contato iniciado', cor: '#5DA9D6' },
  { valor: 'aguardando_retorno', rotulo: 'Aguardando retorno do primeiro contato', cor: '#C9A227' },
  { valor: 'reuniao_marcada', rotulo: 'Reunião marcada', cor: '#F9B341' },
  { valor: 'proposta_elaboracao', rotulo: 'Proposta em elaboração', cor: '#E07B39' },
  { valor: 'proposta_enviada', rotulo: 'Proposta enviada', cor: '#8E6CD1' },
  { valor: 'proposta_analise', rotulo: 'Proposta em análise', cor: '#7A5CC0' },
  { valor: 'parceria_fechada', rotulo: 'Parceria fechada', cor: '#3FA66B' },
  { valor: 'apoio_confirmado', rotulo: 'Apoio confirmado', cor: '#2E7D4F' },
  { valor: 'apoio_recusado', rotulo: 'Apoio recusado', cor: '#C0564A' },
  { valor: 'encerrado_sem_resposta', rotulo: 'Encerrado (sem resposta)', cor: '#6B7F88' },
  { valor: 'alimentar_futuro', rotulo: 'Alimentar para o futuro', cor: '#2A9D8F' },
];

export const CANAIS = [
  'E-mail institucional', 'E-mail pessoal', 'LinkedIn', 'WhatsApp', 'Evento / Encontro presencial', 'Telefonema',
  'Instagram', 'Formulário de contato no site', 'Interlocução por terceiro', 'Carta ou ofício institucional', 'Outro',
];

export const TIPOS_PARCERIA = [
  'Doação direta', 'Patrocínio incentivado', 'Parceria institucional', 'Doação recorrente', 'Investimento institucional',
  'Cessão de espaço / infraestrutura', 'Mentoria', 'Divulgação', 'Doação de produtos', 'Voluntariado corporativo',
  'Recomendação', 'Outro',
];

export const rotuloStatus = (s: StatusAbordagem) => STATUS_ABORDAGEM.find((x) => x.valor === s)?.rotulo ?? s;
export const corStatus = (s: StatusAbordagem) => STATUS_ABORDAGEM.find((x) => x.valor === s)?.cor ?? '#6B7F88';

/** A data do último contato registrado (1º a 4º). */
export function ultimoContato(p: Parceria): string | null {
  return p.contato_4 ?? p.contato_3 ?? p.contato_2 ?? p.contato_1;
}

/** Quantos contatos já foram feitos (0 a 4). */
export function numeroDeContatos(p: Parceria): number {
  return [p.contato_1, p.contato_2, p.contato_3, p.contato_4].filter(Boolean).length;
}

const ATIVOS: StatusAbordagem[] = [
  'a_abordar', 'contato_iniciado', 'aguardando_retorno', 'reuniao_marcada', 'proposta_elaboracao', 'proposta_enviada', 'proposta_analise',
];
export const emAndamento = (p: Parceria) => ATIVOS.includes(p.status);

/** Sem resposta há mais de 7 dias desde o último contato (a planilha pinta de vermelho). */
export function precisaRetomar(p: Parceria, hoje: string): boolean {
  const u = ultimoContato(p);
  return emAndamento(p) && p.status !== 'reuniao_marcada' && !!u && diasEntre(u, hoje) > 7 && numeroDeContatos(p) < 4;
}

// ---------------------------------------------------------------------------
// Funil
// Topo: mapeadas, primeiros contatos sem interesse claro e "alimentar para o futuro".
// Meio: reunião marcada, ou abordada e classificada pelo membro como morna/quente.
// Fundo: proposta em elaboração, enviada ou em análise.
// Pós-funil: parceria fechada ou apoio confirmado (relacionamento e renovação).
// Fora do funil: recusadas e encerradas sem resposta.
// ---------------------------------------------------------------------------

export type EtapaFunil = 'topo' | 'meio' | 'fundo' | 'pos' | 'fora';

export const ETAPAS_FUNIL: { valor: EtapaFunil; rotulo: string; descricao: string; cor: string }[] = [
  { valor: 'topo', rotulo: 'Topo do funil', descricao: 'Mapeadas e primeiros contatos', cor: '#5DA9D6' },
  { valor: 'meio', rotulo: 'Meio do funil', descricao: 'Interesse demonstrado ou reunião marcada', cor: '#F9B341' },
  { valor: 'fundo', rotulo: 'Fundo do funil', descricao: 'Proposta em elaboração, enviada ou em análise', cor: '#8E6CD1' },
  { valor: 'pos', rotulo: 'Pós-funil', descricao: 'Parceria fechada ou apoio confirmado: relacionamento e renovação', cor: '#3FA66B' },
  { valor: 'fora', rotulo: 'Fora do funil', descricao: 'Recusadas ou encerradas sem resposta', cor: '#6B7F88' },
];

export function etapaDoFunil(p: Pick<Parceria, 'status' | 'interesse'>): EtapaFunil {
  switch (p.status) {
    case 'parceria_fechada':
    case 'apoio_confirmado':
      return 'pos';
    case 'proposta_elaboracao':
    case 'proposta_enviada':
    case 'proposta_analise':
      return 'fundo';
    case 'reuniao_marcada':
      return 'meio';
    case 'apoio_recusado':
    case 'encerrado_sem_resposta':
      return 'fora';
    case 'contato_iniciado':
    case 'aguardando_retorno':
      return p.interesse === 'morno' || p.interesse === 'quente' ? 'meio' : 'topo';
    default: // a abordar, alimentar para o futuro
      return 'topo';
  }
}

export const rotuloEtapa = (e: EtapaFunil) => ETAPAS_FUNIL.find((x) => x.valor === e)!.rotulo;
export const rotuloInteresse = (i: Interesse | null) => (i ? INTERESSES.find((x) => x.valor === i)?.rotulo ?? i : null);

/** Quantas empresas em cada etapa. */
export function contarFunil(lista: Parceria[]): Record<EtapaFunil, number> {
  const n: Record<EtapaFunil, number> = { topo: 0, meio: 0, fundo: 0, pos: 0, fora: 0 };
  for (const p of lista) n[etapaDoFunil(p)]++;
  return n;
}

export function montarFileirasParcerias(lista: Parceria[], hoje: string) {
  const nome = (a: Parceria, b: Parceria) => a.organizacao.localeCompare(b.organizacao, 'pt-BR');
  // Dentro de cada etapa: quem tem mais interesse primeiro; depois por nome.
  const peso = (p: Parceria) => ({ quente: 0, morno: 1, frio: 3, sem_retorno: 2 } as const)[p.interesse ?? 'sem_retorno'] ?? 2;
  const ordem = (a: Parceria, b: Parceria) => peso(a) - peso(b) || nome(a, b);
  return [
    { chave: 'retomar', titulo: 'Retomar contato (mais de 7 dias sem retorno)', cor: '#E5533D', itens: lista.filter((p) => precisaRetomar(p, hoje)).sort(nome) },
    ...ETAPAS_FUNIL.map((e) => ({
      chave: e.valor,
      titulo: `${e.rotulo} · ${e.descricao}`,
      cor: e.cor,
      itens: lista.filter((p) => etapaDoFunil(p) === e.valor).sort(ordem),
    })),
  ];
}
