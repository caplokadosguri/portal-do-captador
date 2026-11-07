'use client';

// Junta o espelho da Trackmob com o relacionamento do portal e monta a visão de cada doador.

import { buscarTudo, supabase } from './supabase/cliente';
import { MAX_CONVITES_PONTUAL, VALOR_ALTO_PONTUAL } from './plano';
import {
  brindeDevido, Cobranca, Doacao, doacaoPrincipal, ehCancelada, ehPontual, inicioDoAtraso, motivoFalha, MotivoFalha,
  mesesEmAtraso, PontoDoPlano, pontoDoPlano, Situacao, situacao,
} from './situacao';
import { diasEntre, hojeIso, somarMeses } from './texto';

export interface Doador {
  id: string;
  nome: string | null;
  email: string | null;
  celular: string | null;
  aceita_email: boolean | null;
  aceita_ligacao: boolean | null;
  aceita_sms: boolean | null;
  aceita_whatsapp: boolean | null;
  aceita_cartas: boolean | null;
  aceita_mala_direta: boolean | null;
}

export interface Relacionamento {
  doador_id: string;
  responsavel: string | null;
  proximo_contato: string | null;
  status_conversa: string | null;
  anotacoes: string | null;
}

export interface Brinde { id: string; doador_id: string; checkpoint: string; item: string | null; status: string }
export interface Pontual { doador_id: string; status: string; convites: number }
export interface Modelo { chave: string; titulo: string; texto: string }

export interface VisaoDoador {
  doador: Doador;
  doacoes: Doacao[];
  principal: Doacao | null;
  cobrancas: Cobranca[];
  situacao: Situacao;
  mesesAtraso: number | null;
  /** Vencimento da primeira cobrança não paga da sequência atual. */
  atrasoDesde: string | null;
  falha: { motivo: MotivoFalha; mensagem: string | null } | null;
  plano: PontoDoPlano | null;
  brindeDevido: { chave: string; nome: string } | null;
  brinde: Brinde | null;
  rel: Relacionamento | null;
  pontual: Pontual | null;
  virouMensal: boolean;
  valorAlto: boolean;
}

export interface Carteira {
  hoje: string;
  /** Data da importação mais recente das cobranças (o quão atuais são os dados de pagamento). */
  dadosDe: string | null;
  visoes: VisaoDoador[];
  modelos: Modelo[];
}

export async function carregarCarteira(): Promise<Carteira> {
  const sb = supabase();
  const hoje = hojeIso();
  const desde = somarMeses(hoje, -14);
  const [doadores, doacoes, cobrancas, rels, brindes, pontuais, modelos] = await Promise.all([
    buscarTudo<Doador>((a, b) => sb.from('doadores').select('*').order('id').range(a, b)),
    buscarTudo<Doacao>((a, b) => sb.from('doacoes').select('*').order('id').range(a, b)),
    buscarTudo<Cobranca>((a, b) => sb.from('cobrancas').select('id,doacao_id,doador_id,competencia,vencimento,pago_em,status,mensagem_erro,importado_em').gte('vencimento', desde).order('id').range(a, b)),
    buscarTudo<Relacionamento>((a, b) => sb.from('relacionamento').select('*').order('doador_id').range(a, b)),
    buscarTudo<Brinde>((a, b) => sb.from('brindes').select('*').order('id').range(a, b)),
    buscarTudo<Pontual>((a, b) => sb.from('trilha_pontual').select('*').order('doador_id').range(a, b)),
    buscarTudo<Modelo>((a, b) => sb.from('modelos_mensagem').select('*').order('chave').range(a, b)),
  ]);

  const porDoador = <T extends { doador_id: string | null }>(lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of lista) if (x.doador_id) m.set(x.doador_id, [...(m.get(x.doador_id) ?? []), x]);
    return m;
  };
  const doacoesDe = porDoador(doacoes);
  const cobrancasDe = porDoador(cobrancas);
  const relDe = new Map(rels.map((r) => [r.doador_id, r]));
  const pontualDe = new Map(pontuais.map((p) => [p.doador_id, p]));

  const visoes = doadores.map((doador): VisaoDoador => {
    const dd = doacoesDe.get(doador.id) ?? [];
    const cc = cobrancasDe.get(doador.id) ?? [];
    const principal = doacaoPrincipal(dd);
    const sit = situacao(principal, cc, hoje);
    const recorrenteAtiva = !!principal && !ehPontual(principal) && !ehCancelada(principal);
    const plano = recorrenteAtiva && principal!.criada_em ? pontoDoPlano(principal!.criada_em, hoje) : null;
    const devido = recorrenteAtiva && principal!.criada_em ? brindeDevido(principal!.criada_em, hoje) : null;
    const pontuais = dd.filter(ehPontual);
    return {
      doador,
      doacoes: dd,
      principal,
      cobrancas: cc,
      situacao: sit,
      mesesAtraso: principal && recorrenteAtiva ? mesesEmAtraso(principal, cc, hoje) : null,
      atrasoDesde: principal && sit.startsWith('atraso') ? inicioDoAtraso(principal, cc, hoje) : null,
      falha: principal && sit.startsWith('atraso') ? motivoFalha(cc, principal.id) : null,
      plano,
      brindeDevido: devido ? { chave: devido.chave, nome: devido.nome } : null,
      brinde: devido ? brindes.find((b) => b.doador_id === doador.id && b.checkpoint === devido.chave) ?? null : null,
      rel: relDe.get(doador.id) ?? null,
      pontual: pontualDe.get(doador.id) ?? null,
      virouMensal: pontuais.length > 0 && recorrenteAtiva,
      valorAlto: pontuais.some((p) => (p.valor ?? 0) >= VALOR_ALTO_PONTUAL),
    };
  });

  const dadosDe = cobrancas.reduce<string | null>((m, c) => (c.importado_em && (!m || c.importado_em > m) ? c.importado_em : m), null);
  return { hoje, visoes, modelos, dadosDe: dadosDe ? dadosDe.slice(0, 10) : null };
}

export interface Fileira {
  chave: string;
  titulo: string;
  itens: VisaoDoador[];
}

/** As fileiras da tela do perfil Doadores. */
export function montarFileiras(c: Carteira): Fileira[] {
  const { visoes, hoje } = c;
  const nome = (v: VisaoDoador) => v.doador.nome ?? '';
  const ordenar = (l: VisaoDoador[]) => [...l].sort((a, b) => nome(a).localeCompare(nome(b), 'pt-BR'));

  const atencao = visoes.filter(
    (v) =>
      (v.rel?.proximo_contato && v.rel.proximo_contato <= hoje) ||
      v.rel?.status_conversa === 'nova_mensagem' ||
      v.rel?.status_conversa === 'contato_humano',
  );
  const checkpoints = visoes.filter(
    (v) =>
      v.situacao === 'em_dia' &&
      ((v.brindeDevido && (!v.brinde || v.brinde.status !== 'entregue')) ||
        (v.plano && diasEntre(hoje, v.plano.dataProximo) <= 7)),
  );
  const pontuais = visoes.filter(
    (v) =>
      v.situacao === 'pontual' &&
      !v.virouMensal &&
      !['virou_mensal', 'sem_resposta'].includes(v.pontual?.status ?? '') &&
      (v.pontual?.convites ?? 0) < MAX_CONVITES_PONTUAL,
  );

  return [
    { chave: 'atencao', titulo: 'Precisa de atenção hoje', itens: ordenar(atencao) },
    { chave: 'atraso_1', titulo: 'Atraso de 1 mês', itens: ordenar(visoes.filter((v) => v.situacao === 'atraso_1')) },
    { chave: 'atraso_2', titulo: 'Atraso de 2 meses', itens: ordenar(visoes.filter((v) => v.situacao === 'atraso_2')) },
    { chave: 'atraso_3', titulo: 'Atraso de 3 meses ou mais', itens: ordenar(visoes.filter((v) => v.situacao === 'atraso_3')) },
    { chave: 'checkpoints', titulo: 'Checkpoints desta semana', itens: ordenar(checkpoints) },
    {
      chave: 'pontuais',
      titulo: 'Pontuais para convidar',
      itens: [...pontuais].sort((a, b) => Number(b.valorAlto) - Number(a.valorAlto) || nome(a).localeCompare(nome(b), 'pt-BR')),
    },
    { chave: 'em_dia', titulo: 'Mensais em dia', itens: ordenar(visoes.filter((v) => v.situacao === 'em_dia')) },
    { chave: 'cancelado', titulo: 'Cancelados', itens: ordenar(visoes.filter((v) => v.situacao === 'cancelado')) },
  ];
}
