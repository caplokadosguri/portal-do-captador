// O que vai na planilha de cada setor. Os títulos são os nomes das colunas na
// planilha padrão e também o que se procura no cabeçalho do modelo do CASD.

import type { VisaoDoador } from './carteira';
import {
  ABRANGENCIAS, diasRestantes, Edital, ESFERAS, NIVEIS, Projeto, rotuloDe, SITUACOES, STATUS_PROJETO,
} from './editais';
import type { Coluna } from './planilha';
import { NOME_SITUACAO } from './situacao';
import { hojeIso } from './texto';

export const COLUNAS_EDITAIS: Coluna<Edital & { projetos?: string }>[] = [
  { titulo: 'Nome do edital', outrosNomes: ['Edital', 'Nome'], largura: 38, valor: (e) => e.nome },
  { titulo: 'Organizador', outrosNomes: ['Financiador', 'Instituição', 'Órgão'], largura: 26, valor: (e) => e.organizador },
  { titulo: 'Situação', outrosNomes: ['Status'], largura: 18, valor: (e) => rotuloDe(SITUACOES, e.situacao) },
  { titulo: 'Aderência ao CASD', outrosNomes: ['Aderência'], valor: (e) => (e.aderencia ? rotuloDe(NIVEIS, e.aderencia) : null) },
  { titulo: 'Prioridade', valor: (e) => (e.prioridade ? rotuloDe(NIVEIS, e.prioridade) : null) },
  { titulo: 'Abertura', outrosNomes: ['Data de abertura', 'Início'], tipo: 'data', valor: (e) => e.abertura },
  { titulo: 'Prazo', outrosNomes: ['Data limite', 'Encerramento', 'Prazo final'], tipo: 'data', valor: (e) => e.prazo },
  {
    titulo: 'Dias restantes',
    tipo: 'numero',
    valor: (e) => diasRestantes(e.prazo, hojeIso()),
    formula: (ref) => {
      const p = ref('Prazo');
      return p ? `IF(${p}="","",${p}-TODAY())` : null;
    },
  },
  { titulo: 'Valor / orçamento', outrosNomes: ['Valor', 'Orçamento', 'Valor máximo'], tipo: 'moeda', largura: 18, valor: (e) => e.valor },
  {
    titulo: 'Lei de incentivo / fonte do recurso',
    outrosNomes: ['Lei de incentivo', 'Fonte do recurso', 'Fonte'],
    largura: 28,
    valor: (e) => e.fonte_recurso,
  },
  { titulo: 'Abrangência', valor: (e) => (e.abrangencia ? rotuloDe(ABRANGENCIAS, e.abrangencia) : null) },
  { titulo: 'Link', largura: 34, valor: (e) => e.link },
  { titulo: 'Observação', outrosNomes: ['Observações', 'Obs'], largura: 40, valor: (e) => e.observacao },
  { titulo: 'Projetos vinculados', outrosNomes: ['Projeto', 'Projetos'], largura: 30, valor: (e) => e.projetos ?? null },
];

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

/**
 * Doadores: só o necessário para a gestão. Sem celular, e-mail ou qualquer dado
 * de pagamento (LGPD: a planilha sai do portal e vai para o Drive).
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
  { titulo: 'Responsável', valor: (v) => v.rel?.responsavel ?? null },
  { titulo: 'Próximo contato', tipo: 'data', valor: (v) => v.rel?.proximo_contato ?? null },
  { titulo: 'Aceita WhatsApp', valor: (v) => (v.doador.aceita_whatsapp ? 'Sim' : 'Não') },
];

export interface Empresa { id: string; nome: string; setor: string | null; contato: string | null; historico: string | null; criado_em: string }
export interface Evento { id: string; nome: string; data: string | null; meta_patrocinio: number | null; cotas: string | null }

export const COLUNAS_PARCEIROS: Coluna<Empresa>[] = [
  { titulo: 'Empresa', outrosNomes: ['Nome', 'Parceiro'], largura: 30, valor: (e) => e.nome },
  { titulo: 'Setor', valor: (e) => e.setor },
  { titulo: 'Contato', largura: 28, valor: (e) => e.contato },
  { titulo: 'Histórico', outrosNomes: ['Observação', 'Observações'], largura: 50, valor: (e) => e.historico },
  { titulo: 'Cadastrada em', tipo: 'data', valor: (e) => e.criado_em },
];

export const COLUNAS_EVENTOS: Coluna<Evento>[] = [
  { titulo: 'Evento', outrosNomes: ['Nome'], largura: 30, valor: (e) => e.nome },
  { titulo: 'Data', tipo: 'data', valor: (e) => e.data },
  { titulo: 'Meta de patrocínio', outrosNomes: ['Meta'], tipo: 'moeda', valor: (e) => e.meta_patrocinio },
  { titulo: 'Cotas', largura: 40, valor: (e) => e.cotas },
];
