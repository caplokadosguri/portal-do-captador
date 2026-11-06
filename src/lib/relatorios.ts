// Leitura dos relatórios da Trackmob.
// Só as colunas listadas aqui chegam ao banco. Todo o resto (CPF, endereço, banco, cartão,
// UTMs...) é descartado na leitura, ainda no navegador de quem importa.

import Papa from 'papaparse';
import { booleano, data, inteiro, normalizarTitulo, numero, texto } from './texto';

export type TipoRelatorio = 'doacoes' | 'cobrancas' | 'doadores';

type Conversor = (v: unknown) => unknown;
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
    { titulo: 'Receber e-mails', campo: 'aceita_email', converter: booleano },
    { titulo: 'Receber ligações', campo: 'aceita_ligacao', converter: booleano },
    { titulo: 'Receber SMS', campo: 'aceita_sms', converter: booleano },
    { titulo: 'Receber WhatsApp', campo: 'aceita_whatsapp', converter: booleano, obrigatoria: true },
    { titulo: 'Receber cartas', campo: 'aceita_cartas', converter: booleano },
    { titulo: 'Receber malas diretas', campo: 'aceita_mala_direta', converter: booleano },
  ],
};

export interface ResultadoLeitura {
  tipo: TipoRelatorio;
  linhas: Record<string, unknown>[];
  linhasLidas: number;
  colunasFaltando: string[];
  colunasDescartadas: number;
  erros: { linha: number; motivo: string }[];
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
    colunasDescartadas: Math.max(0, cabecalho.length - usadas.length),
    erros: [],
  };
  if (colunasFaltando.length) return resultado;

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
    resultado.linhas.push(linha);
  });
  return resultado;
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
