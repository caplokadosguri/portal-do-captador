// Eventos da Captação: tipos (EC, EI, EA), datas previstas e como organizar
// por calendário ou por tipo. Estrutura a validar na reunião com o marketing.

import { diasEntre } from './texto';

export type TipoEvento = 'captacao' | 'institucional' | 'aberto';
export type Frequencia = 'unico' | 'recorrente' | 'continuo';
export type SituacaoEvento = 'proposta' | 'aprovado' | 'em_preparacao' | 'realizado' | 'cancelado';

export interface Evento {
  id: string;
  nome: string;
  tipos: TipoEvento[];
  situacao: SituacaoEvento;
  frequencia: Frequencia;
  previsao: string | null;
  inicio: string | null;
  fim: string | null;
  data_confirmada: boolean;
  local: string | null;
  responsavel: string | null;
  meta: number | null;
  arrecadado: number | null;
  cotas: string | null;
  descricao: string | null;
  link: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export const TIPOS: { valor: TipoEvento; sigla: string; rotulo: string; plural: string; cor: string }[] = [
  { valor: 'captacao', sigla: 'EC', rotulo: 'Captação', plural: 'Eventos de captação', cor: '#F9B341' },
  { valor: 'institucional', sigla: 'EI', rotulo: 'Institucional', plural: 'Eventos institucionais', cor: '#3192B3' },
  { valor: 'aberto', sigla: 'EA', rotulo: 'Aberto', plural: 'Eventos abertos', cor: '#2A9D8F' },
];

export const SITUACOES_EVENTO: { valor: SituacaoEvento; rotulo: string; cor: string }[] = [
  { valor: 'proposta', rotulo: 'Proposta (a validar)', cor: '#8E6CD1' },
  { valor: 'aprovado', rotulo: 'Aprovado', cor: '#3192B3' },
  { valor: 'em_preparacao', rotulo: 'Em preparação', cor: '#F9B341' },
  { valor: 'realizado', rotulo: 'Realizado', cor: '#3FA66B' },
  { valor: 'cancelado', rotulo: 'Cancelado', cor: '#6B7F88' },
];

export const FREQUENCIAS: { valor: Frequencia; rotulo: string }[] = [
  { valor: 'unico', rotulo: 'Data única ou período' },
  { valor: 'recorrente', rotulo: 'Recorrente (várias edições)' },
  { valor: 'continuo', rotulo: 'Contínuo (acompanhamento)' },
];

export const tipoDe = (t: TipoEvento) => TIPOS.find((x) => x.valor === t)!;
export const siglas = (e: Evento) => e.tipos.map((t) => tipoDe(t).sigla).join('/');
export const corDoEvento = (e: Evento) => (e.tipos[0] ? tipoDe(e.tipos[0]).cor : '#6B7F88');
export const rotuloSituacao = (s: SituacaoEvento) => SITUACOES_EVENTO.find((x) => x.valor === s)?.rotulo ?? s;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/** Como mostrar "quando": a previsão combinada ou o período. */
export function quando(e: Evento): string {
  if (e.frequencia === 'recorrente') return e.previsao ?? 'Recorrente';
  if (e.frequencia === 'continuo') return e.previsao ?? 'Contínuo';
  if (e.data_confirmada && e.inicio) {
    const ano = e.inicio.slice(0, 4);
    return e.fim && e.fim !== e.inicio ? `${dm(e.inicio)} a ${dm(e.fim)} de ${ano}` : `${dm(e.inicio)} de ${ano}`;
  }
  if (e.previsao) return e.previsao;
  if (e.inicio) return `${MESES_LONGOS[Number(e.inicio.slice(5, 7)) - 1]} de ${e.inicio.slice(0, 4)}`;
  return 'Sem data';
}

/** Rótulo curto do período, para o card: "mai 2027", "mai–jun 2027", "2º sem. 2027". */
export function periodoCurto(e: Evento): string {
  if (e.frequencia === 'recorrente') return 'Recorrente';
  if (e.frequencia === 'continuo') return 'Contínuo';
  if (!e.inicio) return 'Sem data';
  const fim = e.fim ?? e.inicio;
  const ano = e.inicio.slice(0, 4);
  if (e.data_confirmada) return e.fim && e.fim !== e.inicio ? `${dm(e.inicio)} – ${dm(e.fim)}` : `${dm(e.inicio)} ${ano}`;
  const m0 = Number(e.inicio.slice(5, 7));
  const m1 = Number(fim.slice(5, 7)) + (Number(fim.slice(0, 4)) - Number(ano)) * 12;
  if (m1 - m0 >= 4) return `${m0 <= 6 && m1 <= 6 ? '1º' : m0 >= 7 ? '2º' : ''} sem. ${ano}`.replace(/^ sem\./, 'Ano');
  return m0 === m1 ? `${MESES[m0 - 1]} ${ano}` : `${MESES[m0 - 1]}–${MESES[(m1 - 1) % 12]} ${ano}`;
}

/** Dias até o começo (negativo se já começou). `null` sem data. */
export function diasAte(e: Evento, hoje: string): number | null {
  return e.inicio ? diasEntre(hoje, e.inicio) : null;
}

const temData = (e: Evento) => e.frequencia === 'unico' && !!e.inicio;
const fechado = (e: Evento) => e.situacao === 'realizado' || e.situacao === 'cancelado';
/** Já passou (pelo fim do período ou pela data). */
export const passou = (e: Evento, hoje: string) => temData(e) && (e.fim ?? e.inicio)! < hoje;
const porInicio = (a: Evento, b: Evento) => (a.inicio ?? '9999').localeCompare(b.inicio ?? '9999') || a.nome.localeCompare(b.nome, 'pt-BR');

/** O próximo evento de data única que ainda não aconteceu. */
export function proximoEvento(eventos: Evento[], hoje: string): Evento | null {
  return eventos.filter((e) => temData(e) && !fechado(e) && !passou(e, hoje)).sort(porInicio)[0] ?? null;
}

/** "2º semestre de 2027" a partir do início. */
export function semestreDe(iso: string): string {
  return `${Number(iso.slice(5, 7)) <= 6 ? '1º' : '2º'} semestre de ${iso.slice(0, 4)}`;
}

export interface FileiraEventos {
  chave: string;
  titulo: string;
  cor: string;
  itens: Evento[];
}

export function fileirasPorCalendario(eventos: Evento[], hoje: string): FileiraEventos[] {
  const ativos = eventos.filter((e) => !fechado(e));
  const futuros = ativos.filter((e) => temData(e) && !passou(e, hoje)).sort(porInicio);
  const fileiras: FileiraEventos[] = [
    {
      chave: 'proximos',
      titulo: 'Nos próximos 90 dias',
      cor: '#E5533D',
      itens: futuros.filter((e) => diasEntre(hoje, e.inicio!) <= 90),
    },
  ];
  // Cada evento aparece uma vez: o que está nos próximos 90 dias não se repete no semestre.
  const depois = futuros.filter((e) => !fileiras[0].itens.includes(e));
  const semestres = [...new Set(depois.map((e) => semestreDe(e.inicio!)))];
  for (const s of semestres) {
    fileiras.push({ chave: s, titulo: s.charAt(0).toUpperCase() + s.slice(1), cor: '#3192B3', itens: depois.filter((e) => semestreDe(e.inicio!) === s) });
  }
  fileiras.push(
    { chave: 'ano', titulo: 'Ao longo do ano (recorrentes e contínuos)', cor: '#2A9D8F', itens: ativos.filter((e) => e.frequencia !== 'unico').sort(porInicio) },
    { chave: 'sem_data', titulo: 'Ainda sem data', cor: '#8E6CD1', itens: ativos.filter((e) => e.frequencia === 'unico' && !e.inicio).sort(porInicio) },
    {
      chave: 'passados',
      titulo: 'Realizados e passados',
      cor: '#6B7F88',
      itens: eventos.filter((e) => e.situacao === 'realizado' || (passou(e, hoje) && e.situacao !== 'cancelado')).sort((a, b) => porInicio(b, a)),
    },
    { chave: 'cancelados', titulo: 'Cancelados', cor: '#6B7F88', itens: eventos.filter((e) => e.situacao === 'cancelado').sort(porInicio) },
  );
  return fileiras;
}

export function fileirasPorTipo(eventos: Evento[], hoje: string): FileiraEventos[] {
  const ativos = eventos.filter((e) => !fechado(e) && !passou(e, hoje));
  return [
    ...TIPOS.map((t) => ({ chave: t.valor, titulo: `${t.plural} (${t.sigla})`, cor: t.cor, itens: ativos.filter((e) => e.tipos.includes(t.valor)).sort(porInicio) })),
    { chave: 'sem_tipo', titulo: 'Sem tipo definido', cor: '#6B7F88', itens: ativos.filter((e) => e.tipos.length === 0).sort(porInicio) },
    {
      chave: 'passados',
      titulo: 'Realizados, passados e cancelados',
      cor: '#6B7F88',
      itens: eventos.filter((e) => fechado(e) || passou(e, hoje)).sort((a, b) => porInicio(b, a)),
    },
  ];
}

/** Meses da linha do tempo: do mês atual até cobrir o último evento (mín. 12, máx. 24). */
export function mesesDaLinha(eventos: Evento[], hoje: string): string[] {
  const ultimo = eventos.filter(temData).reduce((m, e) => ((e.fim ?? e.inicio)! > m ? (e.fim ?? e.inicio)! : m), hoje);
  const [a0, m0] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  const [a1, m1] = [Number(ultimo.slice(0, 4)), Number(ultimo.slice(5, 7))];
  const n = Math.min(24, Math.max(12, (a1 - a0) * 12 + (m1 - m0) + 1));
  return Array.from({ length: n }, (_, i) => {
    const t = a0 * 12 + (m0 - 1) + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  });
}

export const rotuloMes = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1];

/** Posição (0 a 1) de uma data dentro da linha do tempo. */
export function posicaoNaLinha(iso: string, meses: string[], fimDoDia = false): number {
  const a0 = Number(meses[0].slice(0, 4)) * 12 + Number(meses[0].slice(5, 7)) - 1;
  const a = Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
  const diasNoMes = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
  const fracao = (Number(iso.slice(8, 10)) - (fimDoDia ? 0 : 1)) / diasNoMes;
  return Math.min(1, Math.max(0, (a - a0 + fracao) / meses.length));
}
