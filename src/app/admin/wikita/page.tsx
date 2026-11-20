'use client';

import { useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { useMembro } from '@/lib/membro';
import { buscarTudo, supabase } from '@/lib/supabase/cliente';
import { apelidoSugerido, Candidato, cruzar, lerTurma, linkTurma, PessoaWikita, PRIMEIRA_TURMA, turmaCurta, ULTIMA_TURMA } from '@/lib/wikita';

interface Linha extends Candidato {
  marcar: boolean;
  apelido: string;
  turma: string;
}

// Confere quais doadores são do ITA cruzando os nomes com as turmas da Wikita.
// A lista da wiki fica só na memória desta tela; o portal guarda só os confirmados.
export default function DoadoresDoIta() {
  const { carregando, membro, email } = useMembro();
  const [de, setDe] = useState(1980);
  const [ate, setAte] = useState(ULTIMA_TURMA);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [vazias, setVazias] = useState<number[]>([]);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  async function conferir() {
    setAviso(null); setLinhas(null); setVazias([]); setFalhas([]);
    const anos = Array.from({ length: Math.max(0, ate - de + 1) }, (_, i) => de + i);
    const pessoas: PessoaWikita[] = [];
    const semNinguem: number[] = [];
    const erros: string[] = [];
    let feitas = 0;
    // Algumas turmas por vez, para não sobrecarregar a wiki.
    const fila = [...anos];
    const trabalhar = async () => {
      for (let ano = fila.shift(); ano !== undefined; ano = fila.shift()) {
        try {
          const r = await fetch(`/api/wikita?ano=${ano}`);
          const j = await r.json();
          if (!r.ok) throw new Error(j.erro ?? `erro ${r.status}`);
          const lidas = lerTurma(j.texto ?? '', ano);
          if (!lidas.length) semNinguem.push(ano);
          pessoas.push(...lidas);
        } catch (e) {
          erros.push(`${turmaCurta(ano)}: ${(e as Error).message}`);
        }
        setProgresso(`Lendo as turmas da Wikita… ${++feitas} de ${anos.length}`);
      }
    };
    setProgresso(`Lendo as turmas da Wikita… 0 de ${anos.length}`);
    await Promise.all([trabalhar(), trabalhar(), trabalhar()]);

    setProgresso('Comparando com os doadores…');
    try {
      const sb = supabase();
      const [doadores, marcados] = await Promise.all([
        buscarTudo<{ id: string; nome: string | null }>((a, b) => sb.from('doadores').select('id,nome').order('id').range(a, b)),
        buscarTudo<{ doador_id: string }>((a, b) => sb.from('relacionamento').select('doador_id').eq('iteano', true).order('doador_id').range(a, b)),
      ]);
      const ja = new Set(marcados.map((m) => m.doador_id));
      const achados = cruzar(doadores.filter((d) => !ja.has(d.id)), pessoas);
      setLinhas(achados.map((c) => ({ ...c, marcar: c.semelhanca === 'exato', apelido: apelidoSugerido(c.pessoa.apelido), turma: turmaCurta(c.pessoa.ano) })));
      setVazias(semNinguem.sort((a, b) => a - b));
      setFalhas(erros);
      setProgresso(`${pessoas.length} pessoas lidas em ${anos.length - erros.length} turmas; ${achados.length} possíveis doadores do ITA (fora os ${ja.size} já marcados).`);
    } catch (e) {
      setAviso({ tipo: 'erro', texto: `Não deu para ler os doadores: ${(e as Error).message}` });
      setProgresso(null);
    }
  }

  async function salvar() {
    if (!linhas) return;
    const escolhidos = linhas.filter((l) => l.marcar);
    // O mesmo doador pode aparecer duas vezes (dois homônimos na wiki): vale o primeiro marcado.
    const porDoador = new Map(escolhidos.map((l) => [l.doadorId, l] as const));
    if (porDoador.size < escolhidos.length && !window.confirm('Algum doador está marcado com duas pessoas da wiki. Salvar só a primeira de cada?')) return;
    setSalvando(true);
    const registros = [...porDoador.values()].map((l) => ({
      doador_id: l.doadorId, iteano: true, turma_ita: l.turma.trim() || null, apelido_ita: l.apelido.trim() || null,
    }));
    for (let i = 0; i < registros.length; i += 200) {
      const { error } = await supabase().from('relacionamento').upsert(registros.slice(i, i + 200));
      if (error) {
        setSalvando(false);
        return setAviso({ tipo: 'erro', texto: `Parou no ${i + 1}º: ${error.message}` });
      }
    }
    setSalvando(false);
    setAviso({ tipo: 'ok', texto: `${registros.length} doadores marcados como “Do ITA”. Nas fichas deles, a mensagem já sugere a versão Iteano.` });
    setLinhas(linhas.filter((l) => !porDoador.has(l.doadorId)));
  }

  const mudar = (i: number, m: Partial<Linha>) => setLinhas((ls) => ls && ls.map((l, j) => (j === i ? { ...l, ...m } : l)));
  const marcados = linhas?.filter((l) => l.marcar).length ?? 0;

  return (
    <Tela membro={membro}>
      <main className="pagina pilha pagina-escura" style={{ gap: 16 }}>
        <h1 style={{ fontSize: 28 }}>Doadores do ITA</h1>
        <p className="suave" style={{ margin: 0 }}>
          Lê as páginas “Turma de AAAA” da Wikita e compara os nomes com os doadores. Nada da wiki fica guardado:
          só os doadores que você confirmar viram “Do ITA”, com turma e apelido. “Exato” = mesmo nome completo;
          “Provável” = mesmo primeiro e último nome (confira antes de marcar: pode ser homônimo).
        </p>
        {aviso && <p className={`aviso ${aviso.tipo}`}>{aviso.texto}</p>}

        <div className="linha" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="campo">
            Da turma de
            <input type="number" min={PRIMEIRA_TURMA} max={ULTIMA_TURMA} value={de} onChange={(e) => setDe(Number(e.target.value))} style={{ width: 110 }} />
          </label>
          <label className="campo">
            até
            <input type="number" min={PRIMEIRA_TURMA} max={ULTIMA_TURMA} value={ate} onChange={(e) => setAte(Number(e.target.value))} style={{ width: 110 }} />
          </label>
          <button type="button" className="botao" onClick={conferir} disabled={!!progresso && !linhas && !aviso}>Conferir na Wikita</button>
        </div>
        {progresso && <p className="pequeno" role="status">{progresso}</p>}
        {falhas.length > 0 && <p className="aviso erro pequeno">Não foi possível ler: {falhas.join('; ')}</p>}
        {vazias.length > 0 && (
          <p className="suave pequeno">
            Turmas sem nenhum nome reconhecido (página vazia ou em outro formato):{' '}
            {vazias.map((a, i) => <span key={a}>{i > 0 && ', '}<a href={linkTurma(a)} target="_blank" rel="noreferrer">{turmaCurta(a)}</a></span>)}
          </p>
        )}

        {linhas && linhas.length > 0 && (
          <>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr><th>Marcar</th><th>Doador</th><th>Na Wikita</th><th>Turma</th><th>Apelido</th><th>Semelhança</th></tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={`${l.doadorId}-${l.pessoa.nome}-${l.pessoa.ano}`}>
                      <td><input type="checkbox" aria-label={`Marcar ${l.doadorNome}`} checked={l.marcar} onChange={(e) => mudar(i, { marcar: e.target.checked })} /></td>
                      <td>{l.doadorNome}</td>
                      <td>
                        <a href={linkTurma(l.pessoa.ano)} target="_blank" rel="noreferrer">{l.pessoa.nome}</a>
                        {l.pessoa.detalhe && <span className="suave pequeno"> ({l.pessoa.detalhe})</span>}
                      </td>
                      <td><input aria-label="Turma" value={l.turma} onChange={(e) => mudar(i, { turma: e.target.value })} style={{ width: 70 }} /></td>
                      <td>
                        <input aria-label="Apelido" value={l.apelido} onChange={(e) => mudar(i, { apelido: e.target.value })} style={{ width: 170 }} />
                        {l.pessoa.apelido !== l.apelido && l.pessoa.apelido && <div className="suave pequeno">na wiki: {l.pessoa.apelido}</div>}
                      </td>
                      <td>{l.semelhanca === 'exato' ? 'Exato' : 'Provável'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="linha" style={{ gap: 10 }}>
              <button type="button" className="botao" onClick={salvar} disabled={!marcados || salvando}>
                {salvando ? 'Salvando…' : `Marcar ${marcados} como “Do ITA”`}
              </button>
            </div>
          </>
        )}
        {linhas && linhas.length === 0 && <p className="suave">Nenhum doador novo encontrado nessas turmas.</p>}
      </main>
    </Tela>
  );
}
