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
    `FN:${escaparVcf(d.nome ?? 'Doador CASD')}`,
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
