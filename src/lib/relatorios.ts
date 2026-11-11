// Leitura dos relatórios da Trackmob.
// Só as colunas listadas aqui chegam ao banco. Todo o resto (CPF, endereço, banco, cartão,
// UTMs...) é descartado na leitura, ainda no navegador de quem importa.

import Papa from 'papaparse';
import { booleano, data, inteiro, normalizarTitulo, numero, texto } from './texto';

export type TipoRelatorio = 'doacoes' | 'cobrancas' | 'doadores';

type Conversor = (v: unknown) => unknown;

// Do nascimento, só dia e mês (para o aniversário); o ano é descartado.
const diaDoNascimento: Conversor = (v) => (data(v) ? Number(data(v)!.slice(8, 10)) : null);
const mesDoNascimento: Conversor = (v) => (data(v) ? Number(data(v)!.slice(5, 7)) : null);

// Do endereço, só se existe ou não. Rua, número, CEP etc. continuam descartados.
const COLUNAS_ENDERECO = ['CEP', 'Rua', 'Número', 'Bairro', 'Cidade'];
interface Coluna {
  titulo: string; // como aparece no relatório da Trackmob
  campo: string; // nome no banco
  converter: Conversor;
  obrigatoria?: boolean;
}

export const COLUNAS: Record<TipoRelatorio, Coluna[]> = {
  doacoes: [
    { titulo: 'ID do doador', campo: 'doador_id', converter: texto, obrigatoria: true },
    { titulo: 'ID da doação', campo: 'id', converter: texto, obrigatoria: true },
    { titulo: 'Nome', campo: 'nome', converter: texto },
    { titulo: 'Email', campo: 'email', converter: texto },
    { titulo: 'Celular', campo: 'celular', converter: texto },
    { titulo: 'Valor da doação (R$)', campo: 'valor', converter: numero },
    { titulo: 'Frequência', campo: 'frequencia', converter: texto, obrigatoria: true },
    { titulo: 'Meio de pagamento', campo: 'meio_pagamento', converter: texto },
    { titulo: 'Dia de cobrança', campo: 'dia_cobranca', converter: inteiro },
    { titulo: 'Status', campo: 'status', converter: texto },
    { titulo: 'Status da última cobrança', campo: 'status_ultima_cobranca', converter: texto },
    { titulo: 'Última cobrança paga', campo: 'ultima_cobranca_paga', converter: data },
    { titulo: 'Data de criação da doação', campo: 'criada_em', converter: data, obrigatoria: true },
    { titulo: 'Data de finalização', campo: 'finalizada_em', converter: data },
    { titulo: 'Campanha da doação', campo: 'campanha', converter: texto },
  ],
  cobrancas: [
    { titulo: 'ID da cobrança', campo: 'id', converter: texto, obrigatoria: true },
    { titulo: 'ID da doação', campo: 'doacao_id', converter: texto, obrigatoria: true },
    { titulo: 'ID do doador', campo: 'doador_id', converter: texto, obrigatoria: true },
    { titulo: 'Competência', campo: 'competencia', converter: texto },
    { titulo: 'Data de vencimento', campo: 'vencimento', converter: data, obrigatoria: true },
    { titulo: 'Data de pagamento', campo: 'pago_em', converter: data },
    { titulo: 'Status da cobrança', campo: 'status', converter: texto, obrigatoria: true },
    { titulo: 'Mensagem de erro', campo: 'mensagem_erro', converter: texto },
    { titulo: 'Valor da cobrança', campo: 'valor', converter: numero },
    { titulo: 'Valor de pagamento', campo: 'valor_pago', converter: numero },
  ],
  doadores: [
    { titulo: 'ID do doador', campo: 'id', converter: texto, obrigatoria: true },
    // Nome e contato também aqui: há cadastros (leads) que não aparecem no relatório de doações.
    { titulo: 'Nome', campo: 'nome', converter: texto },
    { titulo: 'Email', campo: 'email', converter: texto },
    { titulo: 'Celular', campo: 'celular', converter: texto },
    { titulo: 'Receber e-mails', campo: 'aceita_email', converter: booleano },
    { titulo: 'Receber ligações', campo: 'aceita_ligacao', converter: booleano },
    { titulo: 'Receber SMS', campo: 'aceita_sms', converter: booleano },
    { titulo: 'Receber WhatsApp', campo: 'aceita_whatsapp', converter: booleano, obrigatoria: true },
    { titulo: 'Receber cartas', campo: 'aceita_cartas', converter: booleano },
    { titulo: 'Receber malas diretas', campo: 'aceita_mala_direta', converter: booleano },
    { titulo: 'Data de nascimento', campo: 'nascimento_dia', converter: diaDoNascimento },
    { titulo: 'Data de nascimento', campo: 'nascimento_mes', converter: mesDoNascimento },
  ],
};

// O relatório de cobranças também traz dados da doação e do doador. Eles servem para
// completar doações que não vieram no relatório de doações (exportado com filtro de data,
// por exemplo). Mesma regra: só estas colunas; documento, endereço e cartão ficam de fora.
const APOIO_COBRANCAS: Coluna[] = [
  { titulo: 'Nome do doador', campo: 'nome', converter: texto },
  { titulo: 'E-mail', campo: 'email', converter: texto },
  { titulo: 'Celular', campo: 'celular', converter: texto },
  { titulo: 'Frequência da doação', campo: 'frequencia', converter: texto },
  { titulo: 'Método de pagamento', campo: 'meio_pagamento', converter: texto },
  { titulo: 'Status da doação', campo: 'status', converter: texto },
  { titulo: 'Data de criação da doação', campo: 'criada_em', converter: data },
  { titulo: 'Campanha (doação)', campo: 'campanha', converter: texto },
];

// Só para conferir o período do arquivo (não vai para o banco).
const DATA_DO_PERIODO: Partial<Record<TipoRelatorio, string>> = {
  doacoes: 'Data de criação da doação',
  cobrancas: 'Data de vencimento',
  doadores: 'Data de criação do doador',
};

export interface ResultadoLeitura {
  tipo: TipoRelatorio;
  linhas: Record<string, unknown>[];
  linhasLidas: number;
  colunasFaltando: string[];
  colunasDescartadas: number;
  erros: { linha: number; motivo: string }[];
  /** Menor e maior data do arquivo (criação para doações e doadores, vencimento para cobranças). */
  periodo: { de: string; ate: string } | null;
  /** Só no relatório de cobranças: doadores e doações montados a partir das cobranças. */
  apoio?: { doadores: Record<string, unknown>[]; doacoes: Record<string, unknown>[] };
}

/** Lê o texto de um CSV (vírgula ou ponto e vírgula) e aplica a lista fechada de colunas. */
export function lerRelatorio(tipo: TipoRelatorio, csv: string): ResultadoLeitura {
  const parse = Papa.parse<string[]>(csv.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  const [cabecalho = [], ...dados] = parse.data;
  const indice = new Map(cabecalho.map((t, i) => [normalizarTitulo(t), i]));
  const colunas = COLUNAS[tipo];

  const colunasFaltando = colunas
    .filter((c) => c.obrigatoria && !indice.has(normalizarTitulo(c.titulo)))
    .map((c) => c.titulo);
  const usadas = colunas.filter((c) => indice.has(normalizarTitulo(c.titulo)));
  const resultado: ResultadoLeitura = {
    tipo,
    linhas: [],
    linhasLidas: dados.length,
    colunasFaltando,
    colunasDescartadas: 0,
    erros: [],
    periodo: null,
  };
  if (colunasFaltando.length) return resultado;
  const apoioUsadas = tipo === 'cobrancas' ? APOIO_COBRANCAS.filter((c) => indice.has(normalizarTitulo(c.titulo))) : [];
  const indicesEndereco = tipo === 'doadores' || tipo === 'cobrancas'
    ? COLUNAS_ENDERECO.map((t) => indice.get(normalizarTitulo(t))).filter((i): i is number => i !== undefined)
    : [];
  const titulosUsados = new Set([...usadas, ...apoioUsadas].map((c) => normalizarTitulo(c.titulo)));
  resultado.colunasDescartadas = Math.max(0, cabecalho.length - titulosUsados.size);
  const temEndereco = (celulas: string[]) => indicesEndereco.some((i) => String(celulas[i] ?? '').trim() !== '');
  const apoio = new Map<string, Record<string, unknown>>();
  const colunaPeriodo = DATA_DO_PERIODO[tipo] ? indice.get(normalizarTitulo(DATA_DO_PERIODO[tipo]!)) : undefined;

  const chave = colunas.find((c) => c.campo === 'id')!;
  const vistos = new Set<string>();
  dados.forEach((celulas, i) => {
    const linha: Record<string, unknown> = {};
    for (const c of usadas) {
      linha[c.campo] = c.converter(celulas[indice.get(normalizarTitulo(c.titulo))!]);
    }
    const id = linha[chave.campo] as string | null;
    // Só os IDs são indispensáveis em cada linha; um aceite em branco vale "não aceitou".
    const faltando = colunas.filter((c) => (c.campo === 'id' || c.campo.endsWith('_id')) && linha[c.campo] == null);
    if (!id || faltando.length) {
      resultado.erros.push({ linha: i + 2, motivo: `sem ${(faltando[0] ?? chave).titulo}` });
      return;
    }
    if (vistos.has(id)) return; // linha repetida no mesmo arquivo: fica a primeira
    vistos.add(id);
    if (tipo === 'doadores' && indicesEndereco.length) linha.tem_endereco = temEndereco(celulas);
    resultado.linhas.push(linha);
    if (colunaPeriodo !== undefined) {
      const d = data(celulas[colunaPeriodo]);
      if (d) resultado.periodo = { de: !resultado.periodo || d < resultado.periodo.de ? d : resultado.periodo.de, ate: !resultado.periodo || d > resultado.periodo.ate ? d : resultado.periodo.ate };
    }
    if (apoioUsadas.length && linha.doacao_id && !apoio.has(linha.doacao_id as string)) {
      const a: Record<string, unknown> = {};
      for (const c of apoioUsadas) a[c.campo] = c.converter(celulas[indice.get(normalizarTitulo(c.titulo))!]);
      if (indicesEndereco.length) a.tem_endereco = temEndereco(celulas);
      apoio.set(linha.doacao_id as string, a);
    }
  });
  if (tipo === 'cobrancas') resultado.apoio = doacoesDasCobrancas(resultado.linhas, apoio);
  return resultado;
}

/**
 * Monta doadores e doações a partir do relatório de cobranças. O valor é o da cobrança
 * mais recente; "última cobrança paga" é o último pagamento visto. O status da última
 * cobrança fica em branco: a regra de atraso usa as próprias cobranças.
 */
export function doacoesDasCobrancas(cobrancas: Record<string, unknown>[], apoio: Map<string, Record<string, unknown>>) {
  const porDoacao = new Map<string, Record<string, unknown>[]>();
  for (const c of cobrancas) {
    const id = c.doacao_id as string;
    if (!porDoacao.has(id)) porDoacao.set(id, []);
    porDoacao.get(id)!.push(c);
  }
  const doadores = new Map<string, Record<string, unknown>>();
  const doacoes: Record<string, unknown>[] = [];
  for (const [id, cs] of porDoacao) {
    const a = apoio.get(id) ?? {};
    const doadorId = cs[0].doador_id as string;
    const recente = [...cs].sort((x, y) => String(y.vencimento ?? '').localeCompare(String(x.vencimento ?? '')))[0];
    const pagos = cs.map((c) => c.pago_em as string | null).filter((d): d is string => !!d).sort();
    if (!doadores.has(doadorId)) {
      const d: Record<string, unknown> = { id: doadorId, nome: a.nome ?? null, email: a.email ?? null, celular: a.celular ?? null };
      if (a.tem_endereco !== undefined) d.tem_endereco = a.tem_endereco;
      doadores.set(doadorId, d);
    }
    doacoes.push({
      id,
      doador_id: doadorId,
      valor: recente.valor ?? null,
      frequencia: a.frequencia ?? null,
      meio_pagamento: a.meio_pagamento ?? null,
      status: a.status ?? null,
      ultima_cobranca_paga: pagos.at(-1) ?? null,
      criada_em: a.criada_em ?? null,
      campanha: a.campanha ?? null,
    });
  }
  return { doadores: [...doadores.values()], doacoes };
}

/** Separa a leitura do relatório de doações em contatos (doadores) e doações. */
export function separarDoacoes(linhas: Record<string, unknown>[]) {
  const doadores = new Map<string, Record<string, unknown>>();
  const doacoes = linhas.map((l) => {
    const { nome, email, celular, ...doacao } = l;
    const id = l.doador_id as string;
    if (!doadores.has(id)) doadores.set(id, { id, nome, email, celular });
    return doacao;
  });
  return { doadores: [...doadores.values()], doacoes };
}

/** Decodifica o arquivo: tenta UTF-8 e cai para Windows-1252 (comum em exportações do Excel). */
export function decodificar(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(bytes);
}

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Avisos sobre o período do arquivo: relatório filtrado por data deixa a carteira incompleta. */
export function avisosDoPeriodo(l: ResultadoLeitura, hoje: string): string[] {
  if (!l.periodo) return [];
  const { de, ate } = l.periodo;
  const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const avisos: string[] = [];
  if (l.tipo === 'cobrancas' && dias(de, ate) < 160) {
    avisos.push(
      `As cobranças vão de ${dataBr(de)} a ${dataBr(ate)}. Com menos de 6 meses, o portal não enxerga atrasos mais antigos; na Trackmob, exporte pelo menos os últimos 6 meses.`,
    );
  }
  if ((l.tipo === 'doacoes' || l.tipo === 'doadores') && dias(de, hoje) < 180) {
    const [todos, o, criados, antigos] = l.tipo === 'doacoes' ? ['Todas', 'as doações', 'criadas', 'as mais antigas ficam'] : ['Todos', 'os doadores', 'criados', 'os mais antigos ficam'];
    avisos.push(
      `${todos} ${o} deste arquivo foram ${criados} a partir de ${dataBr(de)}: o relatório parece ter saído com filtro de data. Exporte sem filtro de período (desde o início), senão ${antigos} de fora.`,
    );
  }
  return avisos;
}
