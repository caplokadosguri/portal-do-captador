// Resumo de escopo de projeto, enviado à assessoria de captação para avaliação.
// Os campos abaixo preenchem os {{marcadores}} do modelo no Google Docs
// (public/modelos/resumo-projeto.docx, gerado por scripts/gerar_modelo_resumo.py).

import { formatarReais } from './contato';
import { ESFERAS, Projeto, rotuloDe, STATUS_PROJETO } from './editais';

/** Campos que a assessoria precisa para avaliar; os vazios aparecem como aviso antes de gerar. */
export const CAMPOS_ESSENCIAIS: { chave: keyof Projeto; rotulo: string }[] = [
  { chave: 'objetivo', rotulo: 'Objetivo' },
  { chave: 'escopo', rotulo: 'Escopo' },
  { chave: 'justificativa', rotulo: 'Justificativa' },
  { chave: 'publico_alvo', rotulo: 'Público-alvo' },
  { chave: 'orcamento', rotulo: 'Orçamento' },
];

export function faltandoNoResumo(p: Projeto): string[] {
  return CAMPOS_ESSENCIAIS.filter((c) => p[c.chave] === null || p[c.chave] === undefined || String(p[c.chave]).trim() === '').map((c) => c.rotulo);
}

const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

export function camposDoResumo(p: Projeto, editais: string[], hoje: string, quemGerou: string): Record<string, string> {
  return {
    titulo: p.titulo,
    esfera: p.esfera ? rotuloDe(ESFERAS, p.esfera) : '',
    status: rotuloDe(STATUS_PROJETO, p.status),
    quem_pediu: p.quem_pediu ?? '',
    responsavel: p.responsavel ?? '',
    publico_atendido: p.publico_atendido ? `${p.publico_atendido.toLocaleString('pt-BR')} pessoas` : '',
    orcamento: p.orcamento !== null && p.orcamento !== undefined ? formatarReais(p.orcamento) : '',
    editais: editais.join('; '),
    link_documentos: p.link_documentos ?? '',
    objetivo: p.objetivo ?? '',
    justificativa: p.justificativa ?? '',
    escopo: p.escopo ?? '',
    publico_alvo: p.publico_alvo ?? '',
    atividades: p.atividades ?? '',
    cronograma: p.cronograma ?? '',
    resultados_esperados: p.resultados_esperados ?? '',
    data: dataBr(hoje),
    gerado_por: quemGerou,
  };
}

export const nomeDoResumo = (p: Projeto, hoje: string) => `Resumo de escopo – ${p.titulo} – ${dataBr(hoje)}`;
