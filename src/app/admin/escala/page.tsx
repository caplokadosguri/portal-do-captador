'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { diasDaSemana, inicioDaSemana, PERIODOS, semanaParaEscalar, Plantao, rotuloDia, rotuloSemana, semMembro, somarDias, textoDaEscala } from '@/lib/escala';
import { Membro, useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

// Escala da sede: o diretor de Captação registra os dias que vieram na escala do
// diretor de Gestão e escolhe o membro-de-dia de cada um. O membro vê no portal.
export default function Escala() {
  const { carregando, membro, email } = useMembro();
  // "Hoje" só é lido no navegador, depois de carregar (nada de data no pré-render).
  const [hoje, setHoje] = useState('');
  const [segunda, setSegunda] = useState('');
  const [lista, setLista] = useState<Plantao[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(() => {
    const sb = supabase();
    const h = hojeIso();
    sb.from('escala_sede').select('*').gte('data', somarDias(inicioDaSemana(h), -28)).order('data')
      .then(({ data, error }) => {
        if (error) return setAviso({ tipo: 'erro', texto: error.message });
        setLista((data as Plantao[]) ?? []);
        setHoje(h);
        setSegunda((s) => s || semanaParaEscalar(h));
      });
    sb.from('membros').select('*').eq('ativo', true).order('nome').then(({ data }) => setMembros((data as Membro[]) ?? []));
  }, []);
  useEffect(() => {
    if (membro?.papel === 'admin') carregar();
  }, [membro, carregar]);

  const nomes = useMemo(() => new Map(membros.map((m) => [m.email, m.nome])), [membros]);
  const dias = useMemo(() => (segunda ? diasDaSemana(segunda) : []), [segunda]);
  // Quantas vezes cada membro já está escalado nesta semana (para dividir a carga).
  const vezes = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of lista) if (p.membro_email && p.data >= segunda && p.data <= dias[6]) n.set(p.membro_email, (n.get(p.membro_email) ?? 0) + 1);
    return n;
  }, [lista, segunda, dias]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;
  if (!segunda) return <Carregando />;

  async function adicionar(data: string) {
    const { error } = await supabase().from('escala_sede').insert({ data });
    if (error) return setAviso({ tipo: 'erro', texto: error.message });
    carregar();
  }

  async function mudar(p: Plantao, campo: keyof Plantao, valor: string) {
    const v = valor.trim() === '' ? null : valor.trim();
    if ((p[campo] ?? null) === v) return;
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, [campo]: v } : x)));
    const { error } = await supabase().from('escala_sede').update({ [campo]: v }).eq('id', p.id);
    if (error) {
      setAviso({ tipo: 'erro', texto: error.message });
      carregar();
    }
  }

  async function remover(p: Plantao) {
    const { error } = await supabase().from('escala_sede').delete().eq('id', p.id);
    if (error) return setAviso({ tipo: 'erro', texto: error.message });
    carregar();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoDaEscala(lista, nomes, segunda));
      setAviso({ tipo: 'ok', texto: 'Mensagem copiada. É só colar no grupo.' });
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não deu para copiar neste navegador.' });
    }
  }

  const faltam = semMembro(lista, segunda);
  const ehEsta = segunda === inicioDaSemana(hoje);

  return (
    <Tela membro={membro}>
      <main className="pagina pilha pagina-escura" style={{ gap: 18 }}>
        <h1 style={{ fontSize: 28 }}>Escala da sede</h1>
        <p className="suave" style={{ margin: 0 }}>
          Registre os dias em que a Captação precisa ir à sede (da escala do diretor de Gestão) e escolha o membro-de-dia.
          Cada membro vê no portal se está escalado nesta semana ou na próxima, e quando.
        </p>

        <div className="linha" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="linha" style={{ gap: 8 }}>
            <button type="button" className="botao secundario pequeno" onClick={() => setSegunda(somarDias(segunda, -7))} aria-label="Semana anterior">←</button>
            <strong>Semana de {rotuloSemana(segunda)}</strong>
            {ehEsta && <span className="chip">esta semana</span>}
            {segunda === somarDias(inicioDaSemana(hoje), 7) && <span className="chip">semana que vem</span>}
            <button type="button" className="botao secundario pequeno" onClick={() => setSegunda(somarDias(segunda, 7))} aria-label="Próxima semana">→</button>
          </div>
          <button type="button" className="botao secundario" onClick={copiar}>Copiar mensagem da semana</button>
        </div>
        {faltam > 0 && <p className="aviso" style={{ margin: 0 }}>{faltam} {faltam === 1 ? 'dia ainda sem' : 'dias ainda sem'} membro-de-dia nesta semana.</p>}
        {aviso && <p className={`aviso ${aviso.tipo}`} role="status" style={{ margin: 0 }}>{aviso.texto}</p>}

        <div className="pilha" style={{ gap: 10 }}>
          {dias.map((d) => {
            const doDia = lista.filter((p) => p.data === d);
            return (
              <section key={d} className={`dia-escala${d === hoje ? ' hoje' : ''}${d < hoje ? ' passou' : ''}`}>
                <div className="linha" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{rotuloDia(d)}{d === hoje ? ' · hoje' : ''}</strong>
                  <button type="button" className="botao-link" onClick={() => adicionar(d)}>+ Captação vai neste dia</button>
                </div>
                {doDia.map((p) => (
                  <div key={p.id} className={`plantao${p.membro_email ? '' : ' sem-membro'}`}>
                    <label className="campo">Membro-de-dia
                      <select value={p.membro_email ?? ''} onChange={(e) => mudar(p, 'membro_email', e.target.value)}>
                        <option value="">— escolher —</option>
                        {membros.map((m) => (
                          <option key={m.email} value={m.email}>{m.nome}{vezes.get(m.email) ? ` (${vezes.get(m.email)}× na semana)` : ''}</option>
                        ))}
                      </select>
                    </label>
                    <label className="campo">Período
                      <select value={p.periodo ?? ''} onChange={(e) => mudar(p, 'periodo', e.target.value)}>
                        <option value="">—</option>
                        {PERIODOS.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </label>
                    <label className="campo">Diretor-de-dia
                      <input defaultValue={p.diretor_do_dia ?? ''} onBlur={(e) => mudar(p, 'diretor_do_dia', e.target.value)} placeholder="Responsável na sede" />
                    </label>
                    <label className="campo">Observação
                      <input defaultValue={p.observacao ?? ''} onBlur={(e) => mudar(p, 'observacao', e.target.value)} placeholder="Ex.: chegar 13h30" />
                    </label>
                    <button type="button" className="botao-link" onClick={() => remover(p)} aria-label={`Tirar ${rotuloDia(d)} da escala`}>remover</button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </main>
    </Tela>
  );
}
