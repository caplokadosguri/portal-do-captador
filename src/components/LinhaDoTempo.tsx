'use client';

import { CSSProperties } from 'react';
import {
  corDoEvento, Evento, mesesDaLinha, passou, posicaoNaLinha, quando, rotuloMes, siglas, tipoDe, TIPOS,
} from '@/lib/eventos';

/**
 * Calendário em barras: cada evento ocupa o período previsto. Barra listrada
 * = data ainda especulada; barra cheia = data confirmada. Recorrentes e
 * contínuos atravessam o ano inteiro.
 */
export default function LinhaDoTempo({ eventos, hoje, aoAbrir }: { eventos: Evento[]; hoje: string; aoAbrir: (id: string) => void }) {
  const ativos = eventos.filter((e) => e.situacao !== 'cancelado' && !passou(e, hoje));
  const comData = ativos.filter((e) => e.frequencia === 'unico' && e.inicio).sort((a, b) => a.inicio!.localeCompare(b.inicio!));
  const aoLongo = ativos.filter((e) => e.frequencia !== 'unico');
  const meses = mesesDaLinha(comData, hoje);
  const pHoje = posicaoNaLinha(hoje, meses);

  const estiloBarra = (e: Evento, esq: number, larg: number): CSSProperties => {
    const cor = corDoEvento(e);
    const cor2 = e.tipos[1] ? tipoDe(e.tipos[1]).cor : cor;
    return {
      left: `${esq * 100}%`,
      width: `${Math.max(larg * 100, 0.9)}%`,
      background: e.data_confirmada
        ? `linear-gradient(90deg, ${cor} 0 60%, ${cor2} 60% 100%)`
        : `repeating-linear-gradient(135deg, ${cor} 0 7px, color-mix(in srgb, ${cor2} 45%, transparent) 7px 14px)`,
    };
  };

  return (
    <section className="linha-tempo fileira-n" aria-label="Linha do tempo dos eventos">
      <h2>
        <span className="barra" style={{ background: '#F9B341' }} aria-hidden="true" />
        Linha do tempo
      </h2>
      <div className="lt-rolagem">
        <div className="lt-grade">
          <div className="lt-cab">
            <span className="lt-nome" />
            <div className="lt-trilha">
              {meses.map((m, i) => (
                <span key={m} className="lt-mes" style={{ left: `${(i / meses.length) * 100}%`, width: `${100 / meses.length}%` }}>
                  {rotuloMes(m)}
                  {(i === 0 || m.endsWith('-01')) && <em>{m.slice(0, 4)}</em>}
                </span>
              ))}
            </div>
          </div>
          {[...comData, ...aoLongo].map((e) => {
            const unico = e.frequencia === 'unico' && e.inicio;
            const esq = unico ? posicaoNaLinha(e.inicio!, meses) : 0;
            const dir = unico ? posicaoNaLinha(e.fim ?? e.inicio!, meses, true) : 1;
            return (
              <button key={e.id} type="button" className="lt-linha" onClick={() => aoAbrir(e.id)} title={`${e.nome} · ${quando(e)}`}>
                <span className="lt-nome">
                  <strong>{e.nome}</strong>
                  <span>{siglas(e) || '—'} · {quando(e)}</span>
                </span>
                <span className="lt-trilha">
                  {meses.map((m, i) => <span key={m} className="lt-divisa" style={{ left: `${(i / meses.length) * 100}%` }} />)}
                  {unico ? (
                    <span className="lt-barra" style={estiloBarra(e, esq, dir - esq)} />
                  ) : (
                    <span className="lt-barra lt-continua" style={{ left: 0, width: '100%', borderColor: corDoEvento(e), color: corDoEvento(e) }}>
                      {e.frequencia === 'recorrente' ? 'recorrente' : 'contínuo'}
                    </span>
                  )}
                  <span className="lt-hoje" style={{ left: `${pHoje * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="lt-legenda pequeno">
        {TIPOS.map((t) => (
          <span key={t.valor}><i style={{ background: t.cor }} />{t.sigla} · {t.rotulo}</span>
        ))}
        <span><i className="listrada" />data especulada</span>
        <span><i style={{ background: '#c9d6dc' }} />data confirmada</span>
        <span><i className="hoje" />hoje</span>
      </p>
    </section>
  );
}
