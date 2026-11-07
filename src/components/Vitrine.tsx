'use client';

import { CSSProperties, ReactNode, useRef } from 'react';

/** Banner grande do topo, como o destaque da Netflix. */
export function Destaque({
  rotulo,
  titulo,
  descricao,
  meta,
  acoes,
  cor = '#F9B341',
}: {
  rotulo: string;
  titulo: string;
  descricao?: ReactNode;
  meta?: ReactNode[];
  acoes?: ReactNode;
  cor?: string;
}) {
  return (
    <section className="destaque" style={{ '--cor-destaque': cor } as CSSProperties} aria-label={rotulo}>
      <svg className="destaque-aviao" viewBox="440 0 505 657" aria-hidden="true">
        <path d="M692 8 L455 540 L633 540 L692 40 Z M692 8 L929 540 L752 540 L692 642 L692 40 Z" />
      </svg>
      <div className="destaque-texto">
        <span className="destaque-rotulo">{rotulo}</span>
        <h1>{titulo}</h1>
        {meta && meta.filter(Boolean).length > 0 && (
          <p className="destaque-meta">
            {meta.filter(Boolean).map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </p>
        )}
        {descricao && <div className="destaque-descricao">{descricao}</div>}
        {acoes && <div className="destaque-acoes">{acoes}</div>}
      </div>
    </section>
  );
}

/** Uma fileira horizontal com título marcado por uma barra colorida. */
export function Fileira({
  titulo,
  cor = '#F9B341',
  quantidade,
  vazio = 'Nada por aqui.',
  children,
}: {
  titulo: string;
  cor?: string;
  quantidade?: number;
  vazio?: string;
  children: ReactNode[];
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const rolar = (sentido: 1 | -1) => {
    const el = trilho.current;
    if (el) el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  return (
    <section className="fileira-n" aria-label={titulo}>
      <h2>
        <span className="barra" style={{ background: cor }} aria-hidden="true" />
        {titulo}
        {quantidade !== undefined && <span className="quantos">{quantidade}</span>}
      </h2>
      {children.length === 0 ? (
        <p className="vazio">{vazio}</p>
      ) : (
        <div className="trilho-moldura">
          <button type="button" className="trilho-seta esquerda" onClick={() => rolar(-1)} aria-label={`Voltar em ${titulo}`}>‹</button>
          <div className="trilho" ref={trilho}>{children}</div>
          <button type="button" className="trilho-seta direita" onClick={() => rolar(1)} aria-label={`Avançar em ${titulo}`}>›</button>
        </div>
      )}
    </section>
  );
}

/** Card em paisagem: capa colorida com um número grande, título embaixo. */
export function Card({
  titulo,
  linha,
  grande,
  selo,
  cor = '#3192B3',
  corSelo,
  aoAbrir,
}: {
  titulo: string;
  linha?: string;
  grande?: string;
  selo?: string;
  cor?: string;
  corSelo?: string;
  aoAbrir: () => void;
}) {
  return (
    <button type="button" className="card-n" style={{ '--cor-card': cor } as CSSProperties} onClick={aoAbrir}>
      {selo && <span className="card-selo" style={corSelo ? { background: corSelo } : undefined}>{selo}</span>}
      {grande && <span className="card-grande">{grande}</span>}
      <span className="card-rodape">
        <strong>{titulo}</strong>
        {linha && <span>{linha}</span>}
      </span>
    </button>
  );
}

/** Barra de ferramentas que fica entre o destaque e as fileiras. */
export function Ferramentas({ children }: { children: ReactNode }) {
  return <div className="ferramentas">{children}</div>;
}
