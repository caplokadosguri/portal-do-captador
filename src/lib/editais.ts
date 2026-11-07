import { diasEntre } from './texto';

export type Nivel = 'alta' | 'media' | 'baixa';
export type Aderencia = 'alta' | 'media' | 'a_revisar';
export type Situacao =
  | 'em_breve' | 'aberto' | 'fluxo_continuo' | 'em_preparacao' | 'aguardando' | 'escrevendo'
  | 'inscrito' | 'aprovado' | 'concluido' | 'desclassificado' | 'encerrado' | 'descartado';
export type Abrangencia = 'municipal' | 'estadual' | 'nacional' | 'internacional';
export type Esfera = 'CASDvest' | 'Casdinho' | 'Ambos';
export type StatusProjeto = 'ideia' | 'em_elaboracao' | 'pronto' | 'aprovado' | 'encerrado';

export interface Edital {
  id: string;
  nome: string;
  organizador: string | null;
  situacao: Situacao;
  aderencia: Aderencia | null;
  prioridade: Nivel | null;
  abertura: string | null;
  prazo: string | null;
  valor: number | null;
  fonte_recurso: string | null;
  abrangencia: Abrangencia | null;
  link: string | null;
  observacao: string | null;
  responsavel: string | null;
  fonte_divulgacao: string | null;
  motivo_descarte: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Projeto {
  id: string;
  titulo: string;
  escopo: string | null;
  quem_pediu: string | null;
  esfera: Esfera | null;
  publico_atendido: number | null;
  orcamento: number | null;
  status: StatusProjeto;
  link_documentos: string | null;
}

export interface Inscricao {
  id: string;
  projeto_id: string;
  edital_id: string;
}

/** As opções selecionáveis. A ordem aqui é a ordem nas telas. */
/**
 * As opções selecionáveis. Os rótulos são exatamente os da planilha
 * "Monitoramento de Editais" do CASD (listas suspensas, cores e contagens
 * da aba Resumo dependem deles). A ordem aqui é a ordem nas telas.
 */
export const SITUACOES: { valor: Situacao; rotulo: string; cor: string }[] = [
  { valor: 'em_breve', rotulo: 'Em breve', cor: '#5DA9D6' },
  { valor: 'aberto', rotulo: 'Aberto', cor: '#3192B3' },
  { valor: 'fluxo_continuo', rotulo: 'Fluxo contínuo', cor: '#2A9D8F' },
  { valor: 'em_preparacao', rotulo: 'Em preparação', cor: '#F9B341' },
  { valor: 'aguardando', rotulo: 'Aguardando', cor: '#C9A227' },
  { valor: 'escrevendo', rotulo: 'Escrevendo', cor: '#E07B39' },
  { valor: 'inscrito', rotulo: 'Inscrito', cor: '#8E6CD1' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: '#3FA66B' },
  { valor: 'concluido', rotulo: 'Concluído', cor: '#2E7D4F' },
  { valor: 'desclassificado', rotulo: 'Desclassificado', cor: '#C0564A' },
  { valor: 'encerrado', rotulo: 'Encerrado', cor: '#6B7F88' },
  { valor: 'descartado', rotulo: 'Descartado (fora do monitoramento)', cor: '#4B5A61' },
];

export const NIVEIS: { valor: Nivel; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
];

export const ADERENCIAS: { valor: Aderencia; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'a_revisar', rotulo: 'A revisar' },
];

export const ABRANGENCIAS: { valor: Abrangencia; rotulo: string; plural: string }[] = [
  { valor: 'municipal', rotulo: 'Municipal', plural: 'Editais municipais' },
  { valor: 'estadual', rotulo: 'Estadual', plural: 'Editais estaduais' },
  { valor: 'nacional', rotulo: 'Nacional', plural: 'Editais nacionais' },
  { valor: 'internacional', rotulo: 'Internacional', plural: 'Editais internacionais' },
];

/** Sugestões para o campo livre "Lei de incentivo / fonte do recurso". */
export const FONTES_SUGERIDAS = [
  'Lei Rouanet (cultura)',
  'Lei de Incentivo ao Esporte',
  'FIA / CMDCA (Fundo da Infância e Adolescência)',
  'CONDECA',
  'Fundo do Idoso',
  'ProAC (SP)',
  'Emenda parlamentar',
  'Recursos próprios do financiador',
  'Instituto ou fundação empresarial',
];

export const ESFERAS: { valor: Esfera; rotulo: string; cor: string }[] = [
  { valor: 'CASDvest', rotulo: 'CASDvest', cor: '#3192B3' },
  { valor: 'Casdinho', rotulo: 'Casdinho', cor: '#F9B341' },
  { valor: 'Ambos', rotulo: 'CASDvest e Casdinho', cor: '#2A9D8F' },
];

export const STATUS_PROJETO: { valor: StatusProjeto; rotulo: string }[] = [
  { valor: 'ideia', rotulo: 'Ideia' },
  { valor: 'em_elaboracao', rotulo: 'Em elaboração' },
  { valor: 'pronto', rotulo: 'Pronto para inscrever' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
];

export const rotuloDe = <T extends string>(lista: { valor: T; rotulo: string }[], v: T | null | undefined) =>
  lista.find((o) => o.valor === v)?.rotulo ?? '—';

export const corSituacao = (s: Situacao) => SITUACOES.find((o) => o.valor === s)?.cor ?? '#6B7F88';

const EM_ANDAMENTO: Situacao[] = ['em_breve', 'aberto', 'fluxo_continuo', 'em_preparacao', 'aguardando', 'escrevendo'];
const SEM_CONTAGEM: Situacao[] = ['inscrito', 'aprovado', 'concluido', 'desclassificado', 'encerrado', 'descartado'];

/** Ainda dá para trabalhar nele (não foi inscrito nem fechado). */
export const emAberto = (e: Edital) => EM_ANDAMENTO.includes(e.situacao);

/** Dias até o prazo (negativo = já passou). `null` sem prazo. */
export function diasRestantes(prazo: string | null, hoje: string): number | null {
  return prazo ? diasEntre(hoje, prazo) : null;
}

/** Como na planilha: inscritos, aprovados e fechados não contam dias. */
export function diasRestantesDoEdital(e: Edital, hoje: string): number | null {
  return SEM_CONTAGEM.includes(e.situacao) ? null : diasRestantes(e.prazo, hoje);
}

/** A mesma ordem da coluna "Ordem (automático)" da planilha. */
export function ordemDaPlanilha(e: Edital): number {
  const fechado = ['encerrado', 'desclassificado', 'concluido'].includes(e.situacao);
  const grupo = fechado ? 4 : e.situacao === 'inscrito' || e.situacao === 'aprovado' ? 3 : e.prazo ? 1 : 2;
  return grupo * 100000 + (e.prazo ? Math.round(Date.parse(e.prazo) / 86400000) + 25569 : 0);
}

export function textoDiasRestantes(dias: number | null): string {
  if (dias === null) return 'Sem prazo';
  if (dias < 0) return 'Prazo encerrado';
  if (dias === 0) return 'Termina hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

const PESO: Record<Nivel, number> = { alta: 0, media: 1, baixa: 2 };

/** Mais urgente primeiro: prioridade, depois o prazo mais próximo. */
export function porUrgencia(a: Edital, b: Edital): number {
  const pa = a.prioridade ? PESO[a.prioridade] : 3;
  const pb = b.prioridade ? PESO[b.prioridade] : 3;
  if (pa !== pb) return pa - pb;
  return (a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31');
}

const porPrazo = (a: Edital, b: Edital) => (a.prazo ?? '9999-12-31').localeCompare(b.prazo ?? '9999-12-31');

export interface FileiraEditais {
  chave: string;
  titulo: string;
  cor: string;
  itens: Edital[];
}

/** O edital do banner: o mais urgente que ainda está aberto e no prazo. */
export function editalDestaque(editais: Edital[], hoje: string): Edital | null {
  const vivos = editais.filter((e) => emAberto(e) && (e.prazo === null || e.prazo >= hoje));
  return [...vivos].sort(porUrgencia)[0] ?? null;
}

export function montarFileirasEditais(editais: Edital[], hoje: string): FileiraEditais[] {
  const noPrazo = (e: Edital) => e.prazo === null || e.prazo >= hoje;
  const monitorados = editais.filter((e) => e.situacao !== 'descartado');
  const vivos = monitorados.filter((e) => emAberto(e) && noPrazo(e));
  const com = (...s: Situacao[]) => vivos.filter((e) => s.includes(e.situacao));
  const fileiras: FileiraEditais[] = [
    {
      chave: 'prazo',
      titulo: 'Prazo nos próximos 30 dias',
      cor: '#E5533D',
      itens: vivos.filter((e) => e.prazo && diasEntre(hoje, e.prazo) <= 30).sort(porPrazo),
    },
    { chave: 'prioridade', titulo: 'Prioridade alta', cor: '#F9B341', itens: vivos.filter((e) => e.prioridade === 'alta').sort(porPrazo) },
    { chave: 'escrevendo', titulo: 'Em preparação e escrevendo', cor: corSituacao('escrevendo'), itens: com('em_preparacao', 'escrevendo').sort(porPrazo) },
    { chave: 'aberto', titulo: 'Abertos', cor: corSituacao('aberto'), itens: com('aberto').sort(porUrgencia) },
    { chave: 'em_breve', titulo: 'Em breve', cor: corSituacao('em_breve'), itens: com('em_breve').sort(porPrazo) },
    { chave: 'fluxo_continuo', titulo: 'Fluxo contínuo', cor: corSituacao('fluxo_continuo'), itens: com('fluxo_continuo').sort(porUrgencia) },
    { chave: 'aguardando', titulo: 'Aguardando', cor: corSituacao('aguardando'), itens: com('aguardando').sort(porPrazo) },
    { chave: 'a_revisar', titulo: 'Aderência a revisar', cor: '#C9A227', itens: vivos.filter((e) => e.aderencia === 'a_revisar').sort(porPrazo) },
    { chave: 'inscrito', titulo: 'Inscritos (aguardando resultado)', cor: corSituacao('inscrito'), itens: monitorados.filter((e) => e.situacao === 'inscrito').sort(porPrazo) },
  ];
  for (const a of ABRANGENCIAS) {
    fileiras.push({ chave: a.valor, titulo: a.plural, cor: '#3192B3', itens: vivos.filter((e) => e.abrangencia === a.valor).sort(porUrgencia) });
  }
  fileiras.push(
    {
      chave: 'aprovado',
      titulo: 'Aprovados e concluídos',
      cor: corSituacao('aprovado'),
      itens: monitorados.filter((e) => e.situacao === 'aprovado' || e.situacao === 'concluido'),
    },
    {
      chave: 'arquivo',
      titulo: 'Arquivo (encerrados, desclassificados e prazo vencido)',
      cor: '#6B7F88',
      itens: monitorados
        .filter((e) => e.situacao === 'encerrado' || e.situacao === 'desclassificado' || (emAberto(e) && !noPrazo(e)))
        .sort((a, b) => porPrazo(b, a)),
    },
    {
      chave: 'descartado',
      titulo: 'Descartados (analisados e fora do monitoramento)',
      cor: corSituacao('descartado'),
      itens: editais.filter((e) => e.situacao === 'descartado').sort((a, b) => porPrazo(b, a)),
    },
  );
  return fileiras;
}

export function montarFileirasProjetos(projetos: Projeto[]) {
  const nome = (a: Projeto, b: Projeto) => a.titulo.localeCompare(b.titulo, 'pt-BR');
  const ativos = projetos.filter((p) => p.status !== 'encerrado');
  return [
    ...ESFERAS.map((e) => ({ chave: e.valor, titulo: e.rotulo, cor: e.cor, itens: ativos.filter((p) => p.esfera === e.valor).sort(nome) })),
    { chave: 'sem_esfera', titulo: 'Sem esfera definida', cor: '#6B7F88', itens: ativos.filter((p) => !p.esfera).sort(nome) },
    { chave: 'encerrado', titulo: 'Encerrados', cor: '#6B7F88', itens: projetos.filter((p) => p.status === 'encerrado').sort(nome) },
  ];
}

/** Carrega editais, projetos e vínculos. Editais e vínculos só voltam para quem pode (RLS). */
export async function carregarEditais() {
  const { supabase } = await import('./supabase/cliente');
  const sb = supabase();
  const [e, p, i] = await Promise.all([
    sb.from('editais').select('*').order('prazo', { ascending: true, nullsFirst: false }),
    sb.from('projetos').select('*').order('titulo'),
    sb.from('inscricoes').select('id, projeto_id, edital_id'),
  ]);
  const erro = e.error ?? p.error ?? i.error;
  if (erro) throw new Error(erro.message);
  return {
    editais: (e.data ?? []).map((x) => ({ ...x, valor: x.valor === null ? null : Number(x.valor) })) as Edital[],
    projetos: (p.data ?? []).map((x) => ({ ...x, orcamento: x.orcamento === null ? null : Number(x.orcamento) })) as Projeto[],
    inscricoes: (i.data ?? []) as Inscricao[],
  };
}
