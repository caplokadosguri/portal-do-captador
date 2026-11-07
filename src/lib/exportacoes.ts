// O que vai na planilha de cada setor. Os títulos das colunas são os nomes do
// cabeçalho nos modelos do CASD (public/modelos/) e também os da planilha padrão.

import type { VisaoDoador } from './carteira';
import {
  ABRANGENCIAS, ADERENCIAS, Edital, emAberto, ESFERAS, Inscricao, NIVEIS, ordemDaPlanilha, Projeto,
  rotuloDe, SITUACOES, STATUS_PROJETO,
} from './editais';
import { Parceria, rotuloStatus } from './parceiros';
import type { Coluna, Exportacao } from './planilha';
import { NOME_SITUACAO } from './situacao';
import { diasEntre } from './texto';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const nomeDoMes = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1];
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const dia = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : null);

// ---------------------------------------------------------------------------
// Editais — modelo "Monitoramento de Editais"
// ---------------------------------------------------------------------------

type EditalExportado = Edital & { projetos?: string };

export const COLUNAS_EDITAIS: Coluna<EditalExportado>[] = [
  { titulo: 'Nome do edital', outrosNomes: ['Edital', 'Nome'], largura: 38, valor: (e) => e.nome },
  { titulo: 'Organizador', outrosNomes: ['Financiador', 'Instituição', 'Órgão'], largura: 26, valor: (e) => e.organizador },
  { titulo: 'Situação', outrosNomes: ['Status'], largura: 18, valor: (e) => rotuloDe(SITUACOES, e.situacao) },
  { titulo: 'Aderência ao CASD', outrosNomes: ['Aderência'], valor: (e) => (e.aderencia ? rotuloDe(ADERENCIAS, e.aderencia) : null) },
  { titulo: 'Prioridade', valor: (e) => (e.prioridade ? rotuloDe(NIVEIS, e.prioridade) : null) },
  { titulo: 'Abertura', outrosNomes: ['Data de abertura', 'Início'], tipo: 'data', valor: (e) => e.abertura },
  { titulo: 'Prazo', outrosNomes: ['Data limite', 'Encerramento', 'Prazo final'], tipo: 'data', valor: (e) => e.prazo },
  {
    titulo: 'Dias restantes',
    tipo: 'numero',
    valor: () => null,
    // Igual à fórmula do modelo: inscritos, aprovados e fechados ficam em branco.
    formula: (ref) => {
      const p = ref('Prazo');
      const s = ref('Situação');
      if (!p) return null;
      const fechado = s ? `OR(${['Encerrado', 'Desclassificado', 'Concluído', 'Inscrito', 'Aprovado'].map((x) => `${s}="${x}"`).join(',')})` : 'FALSE';
      return `IF(ISNUMBER(${p}),IF(${fechado},"",${p}-TODAY()),"")`;
    },
  },
  { titulo: 'Valor / orçamento', outrosNomes: ['Valor', 'Orçamento', 'Valor máximo'], tipo: 'moeda', largura: 18, valor: (e) => e.valor },
  {
    titulo: 'Lei de incentivo / fonte do recurso',
    outrosNomes: ['Lei de incentivo', 'Fonte do recurso'],
    largura: 28,
    valor: (e) => e.fonte_recurso,
  },
  { titulo: 'Abrangência', valor: (e) => (e.abrangencia ? rotuloDe(ABRANGENCIAS, e.abrangencia) : null) },
  { titulo: 'Link', largura: 34, valor: (e) => e.link },
  { titulo: 'Observação', outrosNomes: ['Observações', 'Obs'], largura: 40, valor: (e) => e.observacao },
  { titulo: 'Responsável', valor: (e) => e.responsavel },
  { titulo: 'Fonte (Mais Impacto)', outrosNomes: ['Fonte', 'Onde encontrou'], largura: 22, valor: (e) => e.fonte_divulgacao },
  { titulo: 'Incluído em', tipo: 'data', valor: (e) => dia(e.criado_em) },
  { titulo: 'Projetos vinculados', outrosNomes: ['Projetos'], largura: 30, valor: (e) => e.projetos ?? null },
];

export const COLUNAS_DESCARTADOS: Coluna<Edital>[] = [
  { titulo: 'Edital', outrosNomes: ['Nome do edital'], largura: 38, valor: (e) => e.nome },
  { titulo: 'Organizador', largura: 26, valor: (e) => e.organizador },
  { titulo: 'Motivo da exclusão', outrosNomes: ['Motivo'], largura: 50, valor: (e) => e.motivo_descarte ?? e.observacao },
  { titulo: 'Prazo', tipo: 'data', valor: (e) => e.prazo },
  { titulo: 'Verificado em', tipo: 'data', valor: (e) => dia(e.atualizado_em) },
  { titulo: 'Fonte (Mais Impacto)', outrosNomes: ['Fonte'], largura: 22, valor: (e) => e.fonte_divulgacao },
];

interface LinhaLog { data: string; novos: number; atualizados: number; encerrados: number; revisar: number; proximo: string; obs: string }
const COLUNAS_LOG: Coluna<LinhaLog>[] = [
  { titulo: 'Data da execução', tipo: 'data', valor: (l) => l.data },
  { titulo: 'Editais novos', tipo: 'numero', valor: (l) => l.novos },
  { titulo: 'Editais atualizados', tipo: 'numero', valor: (l) => l.atualizados },
  { titulo: 'Marcados como encerrados', tipo: 'numero', valor: (l) => l.encerrados },
  { titulo: 'Itens "A revisar" (total)', outrosNomes: ['Itens A revisar'], tipo: 'numero', valor: (l) => l.revisar },
  { titulo: 'Próximo prazo (edital e data)', outrosNomes: ['Próximo prazo'], largura: 34, valor: (l) => l.proximo },
  { titulo: 'Observações', largura: 50, valor: (l) => l.obs },
];

export function exportarEditais(editais: Edital[], projetos: Projeto[], inscricoes: Inscricao[], hoje: string): Exportacao {
  const nomesProjetos = (id: string) =>
    inscricoes
      .filter((i) => i.edital_id === id)
      .map((i) => projetos.find((p) => p.id === i.projeto_id)?.titulo)
      .filter(Boolean)
      .join('; ');
  const monitorados = editais
    .filter((e) => e.situacao !== 'descartado')
    .sort((a, b) => ordemDaPlanilha(a) - ordemDaPlanilha(b) || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((e) => ({ ...e, projetos: nomesProjetos(e.id) }));
  const descartados = editais.filter((e) => e.situacao === 'descartado').sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? ''));

  const naSemana = (ts?: string) => !!ts && diasEntre(ts.slice(0, 10), hoje) <= 7;
  const proximo = monitorados
    .filter((e) => emAberto(e) && e.prazo && e.prazo >= hoje)
    .sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0];
  const log: LinhaLog = {
    data: hoje,
    novos: editais.filter((e) => naSemana(e.criado_em)).length,
    atualizados: editais.filter((e) => !naSemana(e.criado_em) && naSemana(e.atualizado_em)).length,
    encerrados: editais.filter((e) => e.situacao === 'encerrado' && naSemana(e.atualizado_em)).length,
    revisar: monitorados.filter((e) => e.aderencia === 'a_revisar').length,
    proximo: proximo ? `${proximo.nome} – ${dataBr(proximo.prazo!)}` : '',
    obs: `Gerado pelo Portal do Captador (${monitorados.length} monitorados, ${descartados.length} descartados).`,
  };

  return {
    setor: 'editais',
    nome: 'Monitoramento de Editais',
    modelo: 'editais',
    abas: [
      {
        aba: 'Controle de Editais',
        colunas: COLUNAS_EDITAIS,
        itens: monitorados,
        ajustes: [{ celula: 'A1', texto: (t) => (/última atualização/i.test(t) ? `${t.replace(/(última atualização:).*$/i, '$1')} ${dataBr(hoje)}` : t) }],
      },
      { aba: 'Descartados', colunas: COLUNAS_DESCARTADOS, itens: descartados },
      { aba: 'Log semanal', colunas: COLUNAS_LOG, itens: [log], modo: 'acrescentar' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Projetos — sem modelo do CASD (planilha padrão)
// ---------------------------------------------------------------------------

export const COLUNAS_PROJETOS: Coluna<Projeto & { editais?: string }>[] = [
  { titulo: 'Título', outrosNomes: ['Projeto', 'Nome do projeto'], largura: 34, valor: (p) => p.titulo },
  { titulo: 'Esfera', valor: (p) => (p.esfera ? rotuloDe(ESFERAS, p.esfera) : null) },
  { titulo: 'Status', outrosNomes: ['Situação'], valor: (p) => rotuloDe(STATUS_PROJETO, p.status) },
  { titulo: 'Escopo', outrosNomes: ['Descrição', 'Resumo'], largura: 50, valor: (p) => p.escopo },
  { titulo: 'Quem pediu', outrosNomes: ['Solicitante'], largura: 22, valor: (p) => p.quem_pediu },
  { titulo: 'Público atendido', outrosNomes: ['Beneficiários', 'Público'], tipo: 'numero', valor: (p) => p.publico_atendido },
  { titulo: 'Orçamento', outrosNomes: ['Valor'], tipo: 'moeda', valor: (p) => p.orcamento },
  { titulo: 'Link dos documentos', outrosNomes: ['Link', 'Documentos'], largura: 34, valor: (p) => p.link_documentos },
  { titulo: 'Editais vinculados', outrosNomes: ['Editais', 'Edital'], largura: 34, valor: (p) => p.editais ?? null },
];

export function exportarProjetos(projetos: Projeto[], editais: Edital[], inscricoes: Inscricao[]): Exportacao {
  const itens = projetos.map((p) => ({
    ...p,
    editais: inscricoes
      .filter((i) => i.projeto_id === p.id)
      .map((i) => editais.find((e) => e.id === i.edital_id)?.nome)
      .filter(Boolean)
      .join('; '),
  }));
  return { setor: 'projetos', nome: 'Projetos', abas: [{ aba: 'Projetos', colunas: COLUNAS_PROJETOS, itens }] };
}

// ---------------------------------------------------------------------------
// Doadores — modelo "Plano de abordagem", aba "Inadimplentes"
// ---------------------------------------------------------------------------

export interface ContatoDoador { doador_id: string; membro: string; canal: string; motivo: string; resultado: string | null; nota: string | null; criado_em: string }

interface LinhaInadimplente { v: VisaoDoador; mes: string; contatos: ContatoDoador[]; responsavel: string | null }

const STATUS_DA_CONVERSA: Record<string, string> = {
  lembrete_1: 'Contato iniciado',
  lembrete_2: 'Contato iniciado',
  aguardando_resposta: 'Aguardando retorno do primeiro contato',
  nova_mensagem: 'Contato iniciado',
  em_atendimento: 'Contato iniciado',
  contato_humano: 'Contato iniciado',
  resolvido: 'Apoio confirmado',
};

const CANAL_DO_DOADOR = (v: VisaoDoador) =>
  v.doador.aceita_whatsapp ? 'WhatsApp' : v.doador.aceita_ligacao ? 'Telefonema' : v.doador.aceita_email ? 'E-mail pessoal' : null;

const MENSAGEM_DA_FALHA: Record<string, string> = {
  atualizar_cartao: 'Atualizar o cartão da doação',
  lembrete: 'Lembrete de pagamento (saldo ou limite)',
  verificar: 'Verificar o pagamento da doação',
};

const COLUNAS_INADIMPLENTES: Coluna<LinhaInadimplente>[] = [
  { titulo: 'Mês', valor: (l) => l.mes },
  { titulo: 'Nome da pessoa', outrosNomes: ['Nome', 'Doador'], largura: 28, valor: (l) => l.v.doador.nome },
  { titulo: 'Telefone / WhatsApp', outrosNomes: ['Telefone', 'Celular'], largura: 18, valor: (l) => l.v.doador.celular },
  {
    titulo: 'Contexto prévio relevante',
    outrosNomes: ['Contexto'],
    largura: 40,
    valor: (l) => {
      const p = l.v.principal;
      const partes = [
        NOME_SITUACAO[l.v.situacao],
        p?.valor ? `R$ ${p.valor.toFixed(2).replace('.', ',')} ${(p.frequencia ?? '').toLowerCase()}`.trim() : null,
        p?.meio_pagamento ?? null,
        p?.criada_em ? `doador desde ${dataBr(p.criada_em)}` : null,
        l.v.falha?.mensagem ? `falha: ${l.v.falha.mensagem}` : null,
      ];
      return partes.filter(Boolean).join(' · ');
    },
  },
  { titulo: 'Canal preferencial de contato', outrosNomes: ['Canal'], valor: (l) => CANAL_DO_DOADOR(l.v) },
  { titulo: 'Mensagem-chave / proposta', outrosNomes: ['Mensagem-chave'], largura: 30, valor: (l) => (l.v.falha ? MENSAGEM_DA_FALHA[l.v.falha.motivo] : 'Verificar o pagamento da doação') },
  { titulo: 'Responsável pela abordagem', outrosNomes: ['Responsável'], valor: (l) => l.responsavel },
  ...[0, 1, 2, 3].map((i): Coluna<LinhaInadimplente> => ({
    titulo: `Data do ${i + 1}º contato`,
    tipo: 'data',
    valor: (l) => dia(l.contatos[i]?.criado_em),
  })),
  {
    titulo: 'Resumo do último retorno',
    outrosNomes: ['Último retorno'],
    largura: 34,
    valor: (l) => {
      const u = l.contatos[l.contatos.length - 1];
      return u ? [u.resultado, u.nota].filter(Boolean).join(' — ') || null : null;
    },
  },
  {
    titulo: 'Resumo da próxima ação prevista',
    outrosNomes: ['Próxima ação'],
    largura: 30,
    valor: (l) => (l.v.rel?.proximo_contato ? `Novo contato em ${dataBr(l.v.rel.proximo_contato)}` : null),
  },
  {
    titulo: 'Status da abordagem',
    outrosNomes: ['Status'],
    largura: 24,
    valor: (l) => (l.v.rel?.status_conversa ? STATUS_DA_CONVERSA[l.v.rel.status_conversa] : l.contatos.length ? 'Contato iniciado' : null),
  },
  { titulo: 'Observações', largura: 40, valor: (l) => l.v.rel?.anotacoes ?? null },
];

/**
 * Doadores em atraso no bloco do mês atual da aba "Inadimplentes". Os meses
 * anteriores que já estiverem no arquivo do Drive ficam como estão.
 */
export function exportarInadimplentes(
  visoes: VisaoDoador[],
  contatos: ContatoDoador[],
  nomeDoMembro: (email: string) => string,
  hoje: string,
): Exportacao {
  const mes = nomeDoMes(hoje);
  const itens: LinhaInadimplente[] = visoes
    .filter((v) => v.situacao === 'atraso_1' || v.situacao === 'atraso_2' || v.situacao === 'atraso_3')
    .sort((a, b) => (b.mesesAtraso ?? 0) - (a.mesesAtraso ?? 0) || (a.doador.nome ?? '').localeCompare(b.doador.nome ?? '', 'pt-BR'))
    .map((v) => {
      const meus = contatos
        .filter((c) => c.doador_id === v.doador.id && c.motivo === 'cobranca' && diasEntre(c.criado_em.slice(0, 10), hoje) <= 120)
        .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
        .slice(-4);
      const resp = v.rel?.responsavel ?? meus[0]?.membro ?? null;
      return { v, mes, contatos: meus, responsavel: resp ? nomeDoMembro(resp) : null };
    });
  return {
    setor: 'doadores',
    nome: 'Plano de abordagem',
    modelo: 'abordagem',
    abas: [
      {
        aba: 'Inadimplentes',
        colunas: COLUNAS_INADIMPLENTES,
        itens,
        agrupar: 'Mês',
        manter: (linha) => (linha['Mês'] ?? '').trim().toLowerCase() !== mes.toLowerCase(),
      },
    ],
  };
}

/**
 * Carteira completa (plano de doadores). Sem celular, e-mail ou dado de
 * pagamento: serve para acompanhar o plano, não para contato.
 */
export const COLUNAS_DOADORES: Coluna<VisaoDoador>[] = [
  { titulo: 'ID do doador', outrosNomes: ['ID'], valor: (v) => v.doador.id },
  { titulo: 'Nome', outrosNomes: ['Doador', 'Nome do doador'], largura: 30, valor: (v) => v.doador.nome },
  { titulo: 'Situação', outrosNomes: ['Status'], largura: 22, valor: (v) => NOME_SITUACAO[v.situacao] },
  { titulo: 'Meses em atraso', tipo: 'numero', valor: (v) => v.mesesAtraso },
  { titulo: 'Valor da doação', outrosNomes: ['Valor'], tipo: 'moeda', valor: (v) => v.principal?.valor ?? null },
  { titulo: 'Frequência', valor: (v) => v.principal?.frequencia ?? null },
  { titulo: 'Doador desde', outrosNomes: ['Data de início', 'Início'], tipo: 'data', valor: (v) => v.principal?.criada_em ?? null },
  { titulo: 'Momento no plano', outrosNomes: ['Checkpoint atual', 'Etapa do plano'], largura: 22, valor: (v) => v.plano?.atual?.nome ?? null },
  { titulo: 'Próximo checkpoint', largura: 22, valor: (v) => v.plano?.proximo.nome ?? null },
  { titulo: 'Data do próximo checkpoint', tipo: 'data', valor: (v) => v.plano?.dataProximo ?? null },
  { titulo: 'Brinde pendente', largura: 22, valor: (v) => (v.brindeDevido && v.brinde?.status !== 'entregue' ? v.brindeDevido.nome : null) },
  { titulo: 'Próximo contato', tipo: 'data', valor: (v) => v.rel?.proximo_contato ?? null },
  { titulo: 'Aceita WhatsApp', valor: (v) => (v.doador.aceita_whatsapp ? 'Sim' : 'Não') },
];

export function exportarCarteira(visoes: VisaoDoador[]): Exportacao {
  return { setor: 'doadores', nome: 'Carteira de doadores', abas: [{ aba: 'Carteira', colunas: COLUNAS_DOADORES, itens: visoes }] };
}

// ---------------------------------------------------------------------------
// Parceiros — modelo "Plano de abordagem", aba "Parcerias e Doações PJ"
// ---------------------------------------------------------------------------

export const COLUNAS_PARCERIAS: Coluna<Parceria>[] = [
  { titulo: 'Organização', outrosNomes: ['Empresa', 'Organização parceira'], largura: 28, valor: (p) => p.organizacao },
  { titulo: 'Nome da pessoa', outrosNomes: ['Contato'], largura: 24, valor: (p) => p.pessoa },
  { titulo: 'Cargo', valor: (p) => p.cargo },
  { titulo: 'E-mail', largura: 26, valor: (p) => p.email },
  { titulo: 'Telefone / WhatsApp', outrosNomes: ['Telefone'], largura: 18, valor: (p) => p.telefone },
  { titulo: 'Perfil em rede social (LinkedIn)', outrosNomes: ['Perfil em rede social', 'LinkedIn'], largura: 26, valor: (p) => p.rede_social },
  { titulo: 'Contexto prévio relevante', outrosNomes: ['Contexto'], largura: 36, valor: (p) => p.contexto },
  { titulo: 'Canal preferencial de contato', outrosNomes: ['Canal'], valor: (p) => p.canal },
  { titulo: 'Mensagem-chave / proposta', outrosNomes: ['Mensagem-chave'], largura: 32, valor: (p) => p.mensagem },
  { titulo: 'Tipo de parceria pretendida', outrosNomes: ['Tipo de parceria'], largura: 24, valor: (p) => p.tipo },
  { titulo: 'Responsável pela abordagem', outrosNomes: ['Responsável'], valor: (p) => p.responsavel },
  { titulo: 'Data do 1º contato', tipo: 'data', valor: (p) => p.contato_1 },
  { titulo: 'Data do 2º contato', tipo: 'data', valor: (p) => p.contato_2 },
  { titulo: 'Data do 3º contato', tipo: 'data', valor: (p) => p.contato_3 },
  { titulo: 'Data do 4º contato', tipo: 'data', valor: (p) => p.contato_4 },
  { titulo: 'Resumo do último retorno', outrosNomes: ['Último retorno'], largura: 34, valor: (p) => p.ultimo_retorno },
  { titulo: 'Resumo da próxima ação prevista', outrosNomes: ['Próxima ação'], largura: 30, valor: (p) => p.proxima_acao },
  { titulo: 'Status da abordagem', outrosNomes: ['Status'], largura: 26, valor: (p) => rotuloStatus(p.status) },
  { titulo: 'Observações', largura: 36, valor: (p) => p.observacoes },
];

export function exportarParcerias(lista: Parceria[]): Exportacao {
  const itens = [...lista].sort((a, b) => (a.contato_1 ?? '9999').localeCompare(b.contato_1 ?? '9999') || a.organizacao.localeCompare(b.organizacao, 'pt-BR'));
  return {
    setor: 'parceiros',
    nome: 'Plano de abordagem',
    modelo: 'abordagem',
    abas: [{ aba: 'Parcerias e Doações PJ', colunas: COLUNAS_PARCERIAS, itens }],
  };
}

// ---------------------------------------------------------------------------
// Eventos — sem modelo ainda
// ---------------------------------------------------------------------------

export interface Evento { id: string; nome: string; data: string | null; meta_patrocinio: number | null; cotas: string | null }

export const COLUNAS_EVENTOS: Coluna<Evento>[] = [
  { titulo: 'Evento', outrosNomes: ['Nome'], largura: 30, valor: (e) => e.nome },
  { titulo: 'Data', tipo: 'data', valor: (e) => e.data },
  { titulo: 'Meta de patrocínio', outrosNomes: ['Meta'], tipo: 'moeda', valor: (e) => e.meta_patrocinio },
  { titulo: 'Cotas', largura: 40, valor: (e) => e.cotas },
];

export function exportarEventos(eventos: Evento[]): Exportacao {
  return { setor: 'eventos', nome: 'Eventos', abas: [{ aba: 'Eventos', colunas: COLUNAS_EVENTOS, itens: eventos }] };
}

