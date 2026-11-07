// Parceiros: o plano de abordagem de pessoas jurídicas (aba "Parcerias e
// Doações PJ" do modelo do CASD). As listas são as mesmas da planilha.

import { diasEntre } from './texto';

export type StatusAbordagem =
  | 'contato_iniciado' | 'aguardando_retorno' | 'reuniao_marcada' | 'proposta_elaboracao' | 'proposta_enviada'
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
  observacoes: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export const STATUS_ABORDAGEM: { valor: StatusAbordagem; rotulo: string; cor: string }[] = [
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
  'contato_iniciado', 'aguardando_retorno', 'reuniao_marcada', 'proposta_elaboracao', 'proposta_enviada', 'proposta_analise',
];
export const emAndamento = (p: Parceria) => ATIVOS.includes(p.status);

/** Sem resposta há mais de 7 dias desde o último contato (a planilha pinta de vermelho). */
export function precisaRetomar(p: Parceria, hoje: string): boolean {
  const u = ultimoContato(p);
  return emAndamento(p) && p.status !== 'reuniao_marcada' && !!u && diasEntre(u, hoje) > 7 && numeroDeContatos(p) < 4;
}

export function montarFileirasParcerias(lista: Parceria[], hoje: string) {
  const nome = (a: Parceria, b: Parceria) => a.organizacao.localeCompare(b.organizacao, 'pt-BR');
  const com = (...s: StatusAbordagem[]) => lista.filter((p) => s.includes(p.status)).sort(nome);
  return [
    { chave: 'retomar', titulo: 'Retomar contato (mais de 7 dias sem retorno)', cor: '#E5533D', itens: lista.filter((p) => precisaRetomar(p, hoje)).sort(nome) },
    { chave: 'reuniao', titulo: 'Reuniões marcadas', cor: corStatus('reuniao_marcada'), itens: com('reuniao_marcada') },
    { chave: 'proposta', titulo: 'Propostas (em elaboração, enviadas e em análise)', cor: corStatus('proposta_enviada'), itens: com('proposta_elaboracao', 'proposta_enviada', 'proposta_analise') },
    { chave: 'contato', titulo: 'Primeiros contatos', cor: corStatus('contato_iniciado'), itens: com('contato_iniciado', 'aguardando_retorno') },
    { chave: 'fechados', titulo: 'Parcerias fechadas e apoios confirmados', cor: corStatus('apoio_confirmado'), itens: com('parceria_fechada', 'apoio_confirmado') },
    { chave: 'futuro', titulo: 'Alimentar para o futuro', cor: corStatus('alimentar_futuro'), itens: com('alimentar_futuro') },
    { chave: 'encerrados', titulo: 'Recusados e encerrados', cor: '#6B7F88', itens: com('apoio_recusado', 'encerrado_sem_resposta') },
  ];
}
