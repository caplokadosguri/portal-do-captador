// Conferência de doadores do ITA pela Wikita (wikita.aeita.com.br), a wiki da AEITA com as
// turmas, nomes e apelidos. A lista da wiki só é lida e comparada no navegador do admin;
// o portal guarda apenas os doadores confirmados (turma e apelido, no relacionamento).

export const WIKITA = 'https://wikita.aeita.com.br';
export const PRIMEIRA_TURMA = 1950;
export const ULTIMA_TURMA = 2030;

export interface PessoaWikita {
  nome: string;
  /** Apelido como está na wiki (pode ter alternativas: "X ou Y"). */
  apelido: string;
  /** Texto entre parênteses depois do nome (curso, outra turma...). */
  detalhe: string;
  /** Ano da página da turma em que a pessoa aparece. */
  ano: number;
}

export const turmaCurta = (ano: number) => `T${String(ano % 100).padStart(2, '0')}`;
export const linkTurma = (ano: number) => `${WIKITA}/wiki/Turma_de_${ano}`;

/** Tira a marcação de wiki: [[a|b]] -> b, [[a]] -> a, [url texto] -> texto, negrito/itálico, tags e refs. */
export function limparWiki(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lê o wikitexto de uma página "Turma de AAAA": uma pessoa por item de lista ("* [[Nome]] (curso) Apelido"). */
export function lerTurma(wikitexto: string, ano: number): PessoaWikita[] {
  const pessoas: PessoaWikita[] = [];
  for (const linha of wikitexto.split('\n')) {
    const m = linha.match(/^\s*[*#]+\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\](.*)$/);
    if (!m) continue;
    const alvo = m[1].trim();
    const nome = limparWiki(m[2] ?? alvo);
    // Só nomes de pessoa: pelo menos duas palavras e nada de página especial ou de turma.
    if (/^(turma de|categoria:|category:|arquivo:|file:|imagem:)/i.test(alvo) || nome.split(' ').length < 2) continue;
    let resto = m[3].trim();
    let detalhe = '';
    if (resto.startsWith('(')) {
      let nivel = 0;
      let fim = -1;
      for (let i = 0; i < resto.length; i++) {
        if (resto[i] === '(') nivel++;
        if (resto[i] === ')' && --nivel === 0) { fim = i; break; }
      }
      if (fim > 0) {
        detalhe = limparWiki(resto.slice(1, fim));
        resto = resto.slice(fim + 1);
      }
    }
    const apelido = limparWiki(resto).replace(/^[-–—:,;.\s]+/, '').trim();
    pessoas.push({ nome, apelido, detalhe, ano });
  }
  return pessoas;
}

/** Primeira opção do apelido ("Marte ou Alf" -> "Marte"). */
export const apelidoSugerido = (apelido: string) => apelido.split(/\s+ou\s+/i)[0].trim();

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von']);

/** Nome em palavras minúsculas, sem acento e sem partículas ("de", "da"...). */
export function palavrasDoNome(nome: string): string[] {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p));
}

export type Semelhanca = 'exato' | 'provavel';

/**
 * Compara o nome do doador com o da wiki. "exato": mesmas palavras na mesma ordem.
 * "provavel": mesmo primeiro e último nome e um nome contido no outro (ex.: sem o nome do meio).
 */
export function compararNomes(doador: string, wiki: string): Semelhanca | null {
  const a = palavrasDoNome(doador);
  const b = palavrasDoNome(wiki);
  if (a.length < 2 || b.length < 2) return null;
  if (a.join(' ') === b.join(' ')) return 'exato';
  if (a[0] !== b[0] || a[a.length - 1] !== b[b.length - 1]) return null;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  const resto = new Set(maior);
  return menor.every((p) => resto.has(p)) ? 'provavel' : null;
}

export interface Candidato {
  doadorId: string;
  doadorNome: string;
  pessoa: PessoaWikita;
  semelhanca: Semelhanca;
}

/** Cruza doadores com as pessoas da wiki (indexadas pelo primeiro nome). Exatos primeiro. */
export function cruzar(doadores: { id: string; nome: string | null }[], pessoas: PessoaWikita[]): Candidato[] {
  const porPrimeiro = new Map<string, PessoaWikita[]>();
  for (const p of pessoas) {
    const k = palavrasDoNome(p.nome)[0];
    if (!k) continue;
    porPrimeiro.set(k, [...(porPrimeiro.get(k) ?? []), p]);
  }
  const achados: Candidato[] = [];
  for (const d of doadores) {
    if (!d.nome) continue;
    const k = palavrasDoNome(d.nome)[0];
    for (const p of porPrimeiro.get(k ?? '') ?? []) {
      const s = compararNomes(d.nome, p.nome);
      if (s) achados.push({ doadorId: d.id, doadorNome: d.nome, pessoa: p, semelhanca: s });
    }
  }
  return achados.sort((x, y) => (x.semelhanca === y.semelhanca ? x.doadorNome.localeCompare(y.doadorNome) : x.semelhanca === 'exato' ? -1 : 1));
}
