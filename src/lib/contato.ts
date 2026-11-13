// Ferramentas de contato: link de WhatsApp com mensagem pronta e arquivo de contato (.vcf).

/** Só dígitos, com DDI 55 quando o número for brasileiro sem DDI. */
export function telefoneInternacional(celular: string | null): string | null {
  if (!celular) return null;
  const d = celular.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export function linkWhatsApp(celular: string | null, mensagem: string): string | null {
  const tel = telefoneInternacional(celular);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
}

/** Troca {nome}, {valor} e {meses} pelos dados do doador. */
export interface DadosDaMensagem {
  nome?: string | null;
  valor?: number | null;
  meses?: number | null;
  /** Quem envia (primeiro nome do membro). */
  membro?: string | null;
  /** Brinde do marco; sem brinde definido, "um presente". */
  brinde?: string | null;
  /** Tempo de doação por extenso, ex.: "1 ano e meio". */
  tempo?: string | null;
}

export function preencherModelo(modelo: string, dados: DadosDaMensagem): string {
  const primeiro = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || '';
  const valor = dados.valor == null ? '' : dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return modelo
    .replaceAll('{nome}', primeiro(dados.nome))
    .replaceAll('{valor}', valor)
    .replaceAll('{meses}', dados.meses == null ? '' : String(dados.meses))
    .replaceAll('{membro}', primeiro(dados.membro) || 'a equipe')
    .replaceAll('{brinde}', dados.brinde?.trim() || 'um presente')
    .replaceAll('{tempo}', dados.tempo ?? (dados.meses == null ? '' : `${dados.meses} meses`));
}

function escaparVcf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export function vcard(d: { nome: string | null; celular: string | null; email: string | null }): string {
  const tel = telefoneInternacional(d.celular);
  const linhas = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    // Salvo na agenda como "Nome - Doador", para reconhecer no WhatsApp.
    `N:;${escaparVcf(`${(d.nome ?? '').trim() || 'Doador CASD'} - Doador`)};;;`,
    `FN:${escaparVcf(`${(d.nome ?? '').trim() || 'Doador CASD'} - Doador`)}`,
    tel ? `TEL;TYPE=CELL:+${tel}` : null,
    d.email ? `EMAIL:${escaparVcf(d.email)}` : null,
    'NOTE:Doador CASD',
    'END:VCARD',
  ];
  return linhas.filter(Boolean).join('\r\n') + '\r\n';
}

export function formatarReais(v: number | null): string {
  return v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// Tipos de contato: cada conversa fica registrada com o motivo, para o histórico
// separar cobrança de aniversário, plano, convites etc.
export type MotivoContato = 'cobranca' | 'plano' | 'aniversario' | 'pontual' | 'lead' | 'outro';

export const MOTIVOS_CONTATO: { valor: MotivoContato; rotulo: string; cor: string }[] = [
  { valor: 'cobranca', rotulo: 'Cobrança', cor: '#E07B39' },
  { valor: 'plano', rotulo: 'Plano de doadores', cor: '#8E6CD1' },
  { valor: 'aniversario', rotulo: 'Aniversário', cor: '#F06FA8' },
  { valor: 'pontual', rotulo: 'Convite (pontual)', cor: '#3192B3' },
  { valor: 'lead', rotulo: 'Convite (cadastro)', cor: '#5DA9D6' },
  { valor: 'outro', rotulo: 'Outro', cor: '#8E9CA3' },
];

/** Motivo do contato pelo modelo de mensagem usado. */
export function motivoDoModelo(chave: string): MotivoContato {
  if (chave === 'cobranca' || chave === 'cartao_vencido') return 'cobranca';
  if (chave === 'aniversario') return 'aniversario';
  if (chave === 'pontual_convite') return 'pontual';
  if (chave === 'lead_convite') return 'lead';
  if (['boas_vindas', 'renovacao_1', 'meses_6', 'ano_1', 'semestral', 'checkpoint'].includes(chave)) return 'plano';
  return 'outro';
}
