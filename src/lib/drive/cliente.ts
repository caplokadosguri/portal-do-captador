'use client';

// Conversa com a ponte do Drive (Apps Script). O pedido vai com o login do
// portal; a ponte confere no Supabase quem é e o que pode fazer.

import type { Exportacao, Valor } from '../planilha';
import { VERSAO_PONTE } from './codigoAppsScript';
import { supabase } from '../supabase/cliente';

export type PlanilhaDrive = 'editais' | 'abordagem' | 'projetos' | 'eventos';

export interface ConfigDrive {
  url: string | null;
  planilhas: Record<PlanilhaDrive, string | null>;
}

export const CHAVES_DRIVE = {
  url: 'drive_script_url',
  editais: 'drive_planilha_editais',
  abordagem: 'drive_planilha_abordagem',
  projetos: 'drive_planilha_projetos',
  eventos: 'drive_planilha_eventos',
} as const;

export async function lerConfigDrive(): Promise<ConfigDrive> {
  const { data } = await supabase().from('configuracoes').select('chave, valor');
  const c = new Map((data ?? []).map((l: { chave: string; valor: string | null }) => [l.chave, l.valor]));
  return {
    url: c.get(CHAVES_DRIVE.url) ?? null,
    planilhas: {
      editais: c.get(CHAVES_DRIVE.editais) ?? null,
      abordagem: c.get(CHAVES_DRIVE.abordagem) ?? null,
      projetos: c.get(CHAVES_DRIVE.projetos) ?? null,
      eventos: c.get(CHAVES_DRIVE.eventos) ?? null,
    },
  };
}

export interface ColunaDrive {
  titulo: string;
  outros?: string[];
  tipo?: string;
  depoisDe?: string;
  formula?: string;
}

export interface AbaDrive {
  aba: string;
  colunas: ColunaDrive[];
  linhas?: (string | number | boolean | null)[][];
  modo?: 'substituir' | 'diario';
  ajustes?: { celula: string; depoisDe: string; texto: string }[];
}

export interface RespostaDrive {
  ok: boolean;
  versao?: number;
  erro?: string;
  url?: string;
  nome?: string;
  ultima?: string | null;
  abas?: { aba: string; existe?: boolean; cabecalho?: boolean; linhas: Record<string, unknown>[] | number; gid?: number }[];
}

const limpar = (v: Valor): string | number | boolean | null => (v === undefined || v === '' ? null : v);

/** Monta o pedido de escrita a partir do que o setor exporta. */
export function pedidoDeEscrita(exp: Exportacao): AbaDrive[] {
  return exp.abas.map((a) => ({
    aba: a.aba,
    colunas: a.colunas.map((c) => ({
      titulo: c.titulo,
      outros: c.outrosNomes,
      tipo: c.tipo,
      depoisDe: c.depoisDe,
      formula: c.formula?.((t) => `{{${t}}}`) ?? undefined,
    })),
    linhas: a.itens.map((item) => a.colunas.map((c) => (c.formula ? null : limpar(c.valor(item))))),
    modo: a.modo === 'acrescentar' ? 'diario' : 'substituir',
    ajustes: a.ajustesDrive,
  }));
}

export async function chamarDrive(
  url: string,
  acao: 'ler' | 'escrever',
  planilha: PlanilhaDrive,
  abas: AbaDrive[],
): Promise<RespostaDrive> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada: entre de novo no portal.');
  // text/plain evita a checagem prévia de CORS, que o Apps Script não atende.
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, acao, planilha, abas }),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`O Drive respondeu ${r.status}.`);
  const corpo = (await r.json().catch(() => null)) as RespostaDrive | null;
  if (!corpo) throw new Error('Resposta inesperada do Drive. Confira o link da ponte em Início › Planilhas no Drive.');
  if ((corpo.versao ?? 1) < VERSAO_PONTE) {
    throw new Error('A ponte do Drive está desatualizada: atualize o código em Início › Planilhas no Drive.');
  }
  if (!corpo.ok) throw new Error(corpo.erro ?? 'Erro no Drive.');
  return corpo;
}
