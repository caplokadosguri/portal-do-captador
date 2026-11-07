import { diasEntre } from './texto';

export type Nivel = 'alta' | 'media' | 'baixa';
export type Situacao = 'novo' | 'em_escrita' | 'em_analise' | 'aprovado' | 'nao_aprovado' | 'descartado';
export type Abrangencia = 'municipal' | 'estadual' | 'nacional' | 'internacional';
export type Esfera = 'CASDvest' | 'Casdinho' | 'Ambos';
export type StatusProjeto = 'ideia' | 'em_elaboracao' | 'pronto' | 'aprovado' | 'encerrado';

export interface Edital {
  id: string;
  nome: string;
  organizador: string | null;
  situacao: Situacao;
  aderencia: Nivel | null;
  prioridade: Nivel | null;
  abertura: string | null;
  prazo: string | null;
  valor: number | null;
  fonte_recurso: string | null;
  abrangencia: Abrangencia | null;
  link: string | null;
  observacao: string | null;
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
export const SITUACOES: { valor: Situacao; rotulo: string; cor: string }[] = [
  { valor: 'novo', rotulo: 'Novo (a avaliar)', cor: '#3192B3' },
  { valor: 'em_escrita', rotulo: 'Em escrita', cor: '#F9B341' },
  { valor: 'em_analise', rotulo: 'Em análise (enviado)', cor: '#8E6CD1' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: '#3FA66B' },
  { valor: 'nao_aprovado', rotulo: 'Não aprovado', cor: '#C0564A' },
  { valor: 'descartado', rotulo: 'Descartado', cor: '#6B7F88' },
];

export const NIVEIS: { valor: Nivel; rotulo: string }[] = [
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
  { valor: 'baixa', rotulo: 'Baixa' },
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

/** Ainda dá para trabalhar nele (não foi enviado nem fechado). */
export const emAberto = (e: Edital) => e.situacao === 'novo' || e.situacao === 'em_escrita';

/** Dias até o prazo (negativo = já passou). `null` sem prazo. */
export function diasRestantes(prazo: string | null, hoje: string): number | null {
  return prazo ? diasEntre(hoje, prazo) : null;
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
  const vivos = editais.filter((e) => emAberto(e) && noPrazo(e));
  const fileiras: FileiraEditais[] = [
    {
      chave: 'prazo',
      titulo: 'Prazo nos próximos 30 dias',
      cor: '#E5533D',
      itens: vivos.filter((e) => e.prazo && diasEntre(hoje, e.prazo) <= 30).sort(porPrazo),
    },
    { chave: 'prioridade', titulo: 'Prioridade alta', cor: '#F9B341', itens: vivos.filter((e) => e.prioridade === 'alta').sort(porPrazo) },
    { chave: 'em_escrita', titulo: 'Em escrita', cor: corSituacao('em_escrita'), itens: vivos.filter((e) => e.situacao === 'em_escrita').sort(porPrazo) },
    { chave: 'novo', titulo: 'Novos para avaliar', cor: corSituacao('novo'), itens: vivos.filter((e) => e.situacao === 'novo').sort(porUrgencia) },
    { chave: 'em_analise', titulo: 'Em análise pelo financiador', cor: corSituacao('em_analise'), itens: editais.filter((e) => e.situacao === 'em_analise').sort(porPrazo) },
  ];
  for (const a of ABRANGENCIAS) {
    fileiras.push({ chave: a.valor, titulo: a.plural, cor: '#3192B3', itens: vivos.filter((e) => e.abrangencia === a.valor).sort(porUrgencia) });
  }
  fileiras.push(
    { chave: 'aprovado', titulo: 'Aprovados', cor: corSituacao('aprovado'), itens: editais.filter((e) => e.situacao === 'aprovado') },
    {
      chave: 'arquivo',
      titulo: 'Arquivo (prazo encerrado, não aprovados e descartados)',
      cor: '#6B7F88',
      itens: editais
        .filter((e) => e.situacao === 'nao_aprovado' || e.situacao === 'descartado' || (emAberto(e) && !noPrazo(e)))
        .sort((a, b) => porPrazo(b, a)),
    },
  );
  return fileiras;
}

export function montarFileirasProjetos(projetos: Projeto[]) {
  const nome = (a: Projeto, b: Projeto) => a.titulo.localeCompare(b.titulo, 'pt-BR');
  const ativos = projetos.filter((p) => p.status !== 'encerrado');
  return [
    { chave: 'pronto', titulo: 'Prontos para inscrever', cor: '#3FA66B', itens: ativos.filter((p) => p.status === 'pronto').sort(nome) },
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
