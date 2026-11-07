// Traz para o portal o que já está na planilha do Drive (editais e parcerias),
// para que o portal vire a fonte e o botão "Gerar planilha" não apague nada.

import { ABRANGENCIAS, ADERENCIAS, Edital, ESFERAS, NIVEIS, Projeto, SITUACOES, STATUS_PROJETO } from './editais';
import { COLUNAS_DESCARTADOS, COLUNAS_EDITAIS, COLUNAS_PARCERIAS, COLUNAS_PROJETOS } from './exportacoes';
import { Parceria, STATUS_ABORDAGEM } from './parceiros';
import { chaveDeCabecalho } from './planilha';
import { lerAba } from './xlsxModelo';

/** Chave para comparar nomes: sem acento, caixa, espaços ou pontuação. */
export const chaveNome = (s: string) => chaveDeCabecalho(s);

function deRotulo<T extends string>(lista: { valor: T; rotulo: string }[], texto: unknown): T | null {
  if (typeof texto !== 'string' || !texto.trim()) return null;
  const k = chaveDeCabecalho(texto);
  return lista.find((o) => chaveDeCabecalho(o.rotulo) === k || chaveDeCabecalho(o.valor) === k)?.valor ?? null;
}

const txt = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());
const iso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
function valor(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const limpo = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

export type EditalNovo = Omit<Edital, 'id' | 'criado_em' | 'atualizado_em'>;

type Linha = Record<string, unknown>;

/** Abas e colunas que a leitura de editais usa (arquivo ou Drive). */
export const ABAS_LEITURA_EDITAIS = [
  { aba: 'Controle de Editais', colunas: COLUNAS_EDITAIS },
  { aba: 'Descartados', colunas: COLUNAS_DESCARTADOS },
];
export const ABAS_LEITURA_PARCERIAS = [{ aba: 'Parcerias e Doações PJ', colunas: COLUNAS_PARCERIAS }];
export const ABAS_LEITURA_PROJETOS = [{ aba: 'Projetos', colunas: COLUNAS_PROJETOS }];

export type ProjetoNovo = Omit<Projeto, 'id'>;

/** Projetos da aba "Projetos" do Banco de Projetos. */
export function projetosDeLinhas(linhas: Linha[]): ProjetoNovo[] {
  const saida: ProjetoNovo[] = [];
  for (const l of linhas) {
    const titulo = txt(l['Título']);
    if (!titulo) continue;
    const publico = valor(l['Público atendido']);
    saida.push({
      titulo,
      escopo: txt(l['Escopo']),
      quem_pediu: txt(l['Quem pediu']),
      esfera: deRotulo(ESFERAS, l['Esfera']),
      publico_atendido: publico === null ? null : Math.round(publico),
      orcamento: valor(l['Orçamento']),
      status: deRotulo(STATUS_PROJETO, l['Status']) ?? 'ideia',
      link_documentos: txt(l['Link dos documentos']),
    });
  }
  return saida;
}

/** Editais das abas "Controle de Editais" e "Descartados". `null` se o arquivo não for o modelo. */
export async function lerEditaisDoArquivo(arquivo: ArrayBuffer): Promise<EditalNovo[] | null> {
  const controle = await lerAba(arquivo, 'Controle de Editais', COLUNAS_EDITAIS);
  if (!controle) return null;
  const descartados = (await lerAba(arquivo, 'Descartados', COLUNAS_DESCARTADOS)) ?? [];
  return editaisDeLinhas(controle, descartados);
}

/** Converte as linhas lidas (pelo título das colunas) em editais. */
export function editaisDeLinhas(controle: Linha[], descartados: Linha[]): EditalNovo[] {
  const saida: EditalNovo[] = [];
  for (const l of controle) {
    const nome = txt(l['Nome do edital']);
    if (!nome) continue;
    saida.push({
      nome,
      organizador: txt(l['Organizador']),
      situacao: deRotulo(SITUACOES, l['Situação']) ?? 'aberto',
      aderencia: deRotulo(ADERENCIAS, l['Aderência ao CASD']),
      prioridade: deRotulo(NIVEIS, l['Prioridade']),
      abertura: iso(l['Abertura']),
      prazo: iso(l['Prazo']),
      valor: valor(l['Valor / orçamento']),
      fonte_recurso: txt(l['Lei de incentivo / fonte do recurso']),
      abrangencia: deRotulo(ABRANGENCIAS, l['Abrangência']),
      link: txt(l['Link']),
      observacao: txt(l['Observação']),
      responsavel: txt(l['Responsável']),
      fonte_divulgacao: txt(l['Fonte (Mais Impacto)']),
      motivo_descarte: null,
    });
  }
  for (const l of descartados) {
    const nome = txt(l['Edital']);
    if (!nome) continue;
    const prazoTexto = l['Prazo'];
    saida.push({
      nome,
      organizador: txt(l['Organizador']),
      situacao: 'descartado',
      aderencia: null,
      prioridade: null,
      abertura: null,
      prazo: iso(prazoTexto),
      valor: null,
      fonte_recurso: null,
      abrangencia: null,
      link: null,
      observacao: iso(prazoTexto) ? null : txt(prazoTexto) ? `Prazo na planilha: ${prazoTexto}` : null,
      responsavel: null,
      fonte_divulgacao: txt(l['Fonte (Mais Impacto)']),
      motivo_descarte: txt(l['Motivo da exclusão']),
    });
  }
  return saida;
}

export type ParceriaNova = Omit<Parceria, 'id' | 'criado_em' | 'atualizado_em'>;

/** Parcerias da aba "Parcerias e Doações PJ". `null` se o arquivo não for o modelo. */
export async function lerParceriasDoArquivo(arquivo: ArrayBuffer): Promise<ParceriaNova[] | null> {
  const linhas = await lerAba(arquivo, 'Parcerias e Doações PJ', COLUNAS_PARCERIAS);
  return linhas ? parceriasDeLinhas(linhas) : null;
}

export function parceriasDeLinhas(linhas: Linha[]): ParceriaNova[] {
  const saida: ParceriaNova[] = [];
  for (const l of linhas) {
    const organizacao = txt(l['Organização']);
    if (!organizacao) continue;
    saida.push({
      organizacao,
      pessoa: txt(l['Nome da pessoa']),
      cargo: txt(l['Cargo']),
      email: txt(l['E-mail']),
      telefone: txt(l['Telefone / WhatsApp']),
      rede_social: txt(l['Perfil em rede social (LinkedIn)']),
      contexto: txt(l['Contexto prévio relevante']),
      canal: txt(l['Canal preferencial de contato']),
      mensagem: txt(l['Mensagem-chave / proposta']),
      tipo: txt(l['Tipo de parceria pretendida'])?.replace('insticional', 'institucional') ?? null,
      responsavel: txt(l['Responsável pela abordagem']),
      contato_1: iso(l['Data do 1º contato']),
      contato_2: iso(l['Data do 2º contato']),
      contato_3: iso(l['Data do 3º contato']),
      contato_4: iso(l['Data do 4º contato']),
      ultimo_retorno: txt(l['Resumo do último retorno']),
      proxima_acao: txt(l['Resumo da próxima ação prevista']),
      status: deRotulo(STATUS_ABORDAGEM, l['Status da abordagem']) ?? 'contato_iniciado',
      observacoes: txt(l['Observações']),
    });
  }
  return saida;
}

/** Nomes do arquivo que não estão no portal (o "Gerar planilha" apagaria). */
export function faltandoNoPortal(doArquivo: string[], doPortal: string[]): string[] {
  const portal = new Set(doPortal.map(chaveNome));
  return [...new Set(doArquivo.filter((n) => !portal.has(chaveNome(n))))];
}

/** Itens cujo nome ainda não existe no portal (sem repetir). */
export function novosPorNome<T>(itens: T[], nomeDe: (i: T) => string, existentes: string[]): T[] {
  const ja = new Set(existentes.map(chaveNome));
  const vistos = new Set<string>();
  return itens.filter((i) => {
    const k = chaveNome(nomeDe(i));
    if (!k || ja.has(k) || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}
