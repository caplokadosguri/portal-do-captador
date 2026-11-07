'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Abertura from '@/components/Abertura';
import { geometriaVoo } from '@/components/aberturaGeometria';
import { SemAcesso } from '@/components/Cabecalho';
import { PERFIS, useMembro } from '@/lib/membro';

export default function QuemEstaCaptando() {
  const { carregando, membro, email } = useMembro();
  // A abertura toca uma vez por sessão do navegador.
  const vista = useSyncExternalStore(
    () => () => undefined,
    () => (sessionStorage.getItem('abertura-vista') ? 'sim' : 'nao'),
    () => 'servidor',
  );
  const [terminou, setTerminou] = useState(false);
  // "Rever abertura": cada clique toca de novo (o número também reinicia as animações).
  const [rever, setRever] = useState(0);
  const [revista, setRevista] = useState(0);
  // Calculada uma vez, no navegador, para o tamanho da tela.
  const [geometria] = useState(() => (typeof window === 'undefined' ? null : geometriaVoo(window.innerWidth, window.innerHeight)));

  useEffect(() => {
    if (vista !== 'nao') return;
    const t = setTimeout(() => {
      sessionStorage.setItem('abertura-vista', '1');
      setTerminou(true);
    }, geometria?.duracaoTotalMs ?? 0);
    return () => clearTimeout(t);
  }, [vista, geometria]);

  useEffect(() => {
    if (!rever) return;
    const t = setTimeout(() => setRevista(rever), geometria?.duracaoTotalMs ?? 0);
    return () => clearTimeout(t);
  }, [rever, geometria]);

  if (vista === 'servidor' || !geometria) return null;
  const abertura = (vista === 'nao' && !terminou) || rever > revista ? 'tocando' : 'pronta';

  const visiveis = membro ? (membro.papel === 'admin' ? PERFIS : PERFIS.filter((p) => p.papel === membro.papel)) : [];

  return (
    <>
      {abertura === 'tocando' && <Abertura key={`abertura-${rever}`} geometria={geometria} />}
      <div
        key={`tela-${rever}`}
        className={abertura === 'tocando' ? 'revela' : undefined}
        style={
          abertura === 'tocando'
            ? { animation: `ab-cortina ${geometria.cortina.duracaoS.toFixed(3)}s linear ${geometria.cortina.inicioS.toFixed(3)}s forwards` }
            : undefined
        }
      >
        {!carregando && !membro ? (
          <SemAcesso email={email} />
        ) : (
          <main className="perfis">
            <h1>Quem está captando?</h1>
            <div className="perfis-grade">
              {visiveis.map((p) => (
                <Link key={p.papel} href={p.rota} className="perfil">
                  <span className="quadro" style={{ background: p.cor }}>
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={p.tinta} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={p.icone} />
                    </svg>
                  </span>
                  {p.nome}
                </Link>
              ))}
            </div>
            {membro && <p className="suave pequeno">Conectado como {membro.nome}</p>}
            {abertura === 'pronta' && (
              <button type="button" className="rever-abertura" onClick={() => setRever((n) => n + 1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5" />
                </svg>
                Rever abertura
              </button>
            )}
          </main>
        )}
      </div>
    </>
  );
}
