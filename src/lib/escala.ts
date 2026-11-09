// Escala da sede: em cada dia, diretores-de-dia (responsáveis) e membros-de-dia.
// O diretor de Gestão manda toda semana os dias em que cada departamento precisa ir;
// o diretor de Captação registra esses dias aqui e escolhe o membro-de-dia de cada um.

export interface Plantao {
  id: string;
  data: string; // aaaa-mm-dd
  periodo: string | null;
  membro_email: string | null;
  diretor_do_dia: string | null;
  observacao: string | null;
}

export const PERIODOS = ['Manhã', 'Tarde', 'Noite', 'Dia todo'];

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const utc = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function somarDias(dataIso: string, dias: number): string {
  const d = utc(dataIso);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(dataIso: string): string {
  const dia = utc(dataIso).getUTCDay(); // 0 = domingo
  return somarDias(dataIso, dia === 0 ? -6 : 1 - dia);
}

/** Os 7 dias (segunda a domingo) da semana que começa em `segunda`. */
export const diasDaSemana = (segunda: string) => Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));

const dm = (dataIso: string) => `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;

/** "quinta, 12/11" ou "qui, 12/11". */
export function rotuloDia(dataIso: string, curto = false): string {
  const d = utc(dataIso).getUTCDay();
  return `${(curto ? DIAS_CURTOS : DIAS)[d]}, ${dm(dataIso)}`;
}

export const rotuloSemana = (segunda: string) => `${dm(segunda)} a ${dm(somarDias(segunda, 6))}`;

const ordem = (a: Plantao, b: Plantao) =>
  a.data.localeCompare(b.data) || PERIODOS.indexOf(a.periodo ?? '') - PERIODOS.indexOf(b.periodo ?? '');

/** Plantões do membro de hoje até o fim da semana que vem. */
export function meusPlantoes(lista: Plantao[], email: string, hoje: string) {
  const fim = somarDias(inicioDaSemana(hoje), 13);
  const minhaSemana = inicioDaSemana(hoje);
  return lista
    .filter((p) => p.membro_email === email.toLowerCase() && p.data >= hoje && p.data <= fim)
    .sort(ordem)
    .map((p) => ({ ...p, quando: inicioDaSemana(p.data) === minhaSemana ? ('esta_semana' as const) : ('semana_que_vem' as const) }));
}

/** "hoje", "amanhã" ou nada. */
export function quandoRelativo(dataIso: string, hoje: string): string | null {
  if (dataIso === hoje) return 'hoje';
  if (dataIso === somarDias(hoje, 1)) return 'amanhã';
  return null;
}

/** Semana que a escala abre: a atual; no sábado e no domingo, a próxima (a escala nova chega no fim de semana). */
export function semanaParaEscalar(hoje: string): string {
  const d = utc(hoje).getUTCDay();
  return d === 0 || d === 6 ? somarDias(inicioDaSemana(hoje), 7) : inicioDaSemana(hoje);
}

/** Dias da semana em que a Captação precisa ir e ainda não tem membro. */
export const semMembro = (lista: Plantao[], segunda: string) =>
  lista.filter((p) => !p.membro_email && p.data >= segunda && p.data <= somarDias(segunda, 6)).length;

/** Texto pronto para mandar no grupo do WhatsApp. */
export function textoDaEscala(lista: Plantao[], nomes: Map<string, string>, segunda: string): string {
  const da = lista.filter((p) => p.data >= segunda && p.data <= somarDias(segunda, 6)).sort(ordem);
  if (!da.length) return `*Captação na sede · semana de ${rotuloSemana(segunda)}*\nSem dias na escala desta semana.`;
  const linhas = da.map((p) => {
    const quem = p.membro_email ? nomes.get(p.membro_email) ?? p.membro_email : 'a definir';
    const extra = [p.diretor_do_dia ? `diretor-de-dia: ${p.diretor_do_dia}` : null, p.observacao].filter(Boolean).join(' · ');
    return `• ${rotuloDia(p.data)}${p.periodo ? ` (${p.periodo.toLowerCase()})` : ''}: *${quem}*${extra ? ` — ${extra}` : ''}`;
  });
  return [`*Captação na sede · semana de ${rotuloSemana(segunda)}*`, ...linhas].join('\n');
}
