// Arquivo de contatos (.vcf) por fileira da carteira, para salvar de uma vez no celular da Captação.
// Cada contato sai como "Nome - Etiqueta - dd/mm", para diferenciar no WhatsApp quem é checkpoint,
// inadimplente, aniversariante etc. e em que dia entrou na agenda.

import type { VisaoDoador } from './carteira';
import { telefoneInternacional, vcard } from './contato';

export const ETIQUETA_DA_FILEIRA: Record<string, string> = {
  atencao: 'Contatos',
  aniversarios: 'Aniversário',
  atraso_1: 'Inadimplente',
  atraso_2: 'Inadimplente',
  atraso_3: 'Inadimplente',
  checkpoints: 'Checkpoint',
  voltaram: 'Doador',
  pontuais: 'Pontual',
  cadastros: 'Cadastro',
  em_dia: 'Doador',
  cancelado: 'Cancelado',
};

export interface ContatosDaFileira {
  rotuloBotao: string;
  arquivo: string;
  conteudo: string;
  quantidade: number;
}

/** Em "Precisa de atenção", a etiqueta segue a situação: inadimplente ou doador. */
function etiquetaDe(chave: string, v: VisaoDoador, padrao: string): string {
  if (chave !== 'atencao') return padrao;
  return v.situacao.startsWith('atraso') ? 'Inadimplente' : 'Doador';
}

/** "2026-11-17" -> "17/11". */
function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Contatos de uma fileira com celular válido. Nos checkpoints, só os de hoje e os atrasados
 * (os dos próximos dias ficam para o dia deles).
 */
export function contatosDaFileira(chave: string, itens: VisaoDoador[], hoje: string): ContatosDaFileira | null {
  const etiqueta = ETIQUETA_DA_FILEIRA[chave];
  if (!etiqueta) return null;
  const doDia = chave === 'checkpoints' ? itens.filter((v) => v.marco && v.marco.dias <= 0) : itens;
  const comCelular = doDia.filter((v) => telefoneInternacional(v.doador.celular));
  if (!comCelular.length) return null;
  const data = diaMes(hoje);
  const vistos = new Set<string>();
  const unicos = comCelular.filter((v) => !vistos.has(v.doador.id) && !!vistos.add(v.doador.id));
  return {
    rotuloBotao: chave === 'checkpoints' ? 'Baixar checkpoints de hoje' : 'Baixar contatos',
    arquivo: `${etiqueta} ${hoje.slice(8, 10)}-${hoje.slice(5, 7)}.vcf`,
    conteudo: unicos.map((v) => vcard(v.doador, etiquetaDe(chave, v, etiqueta), data)).join(''),
    quantidade: unicos.length,
  };
}
