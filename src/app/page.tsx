'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Abertura, { DURACAO_ABERTURA_MS } from '@/components/Abertura';
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

  useEffect(() => {
    if (vista !== 'nao') return;
    const t = setTimeout(() => {
      sessionStorage.setItem('abertura-vista', '1');
      setTerminou(true);
    }, DURACAO_ABERTURA_MS);
    return () => clearTimeout(t);
  }, [vista]);

  if (vista === 'servidor') return null;
  const abertura = vista === 'nao' && !terminou ? 'tocando' : 'pronta';

  const visiveis = membro ? (membro.papel === 'admin' ? PERFIS : PERFIS.filter((p) => p.papel === membro.papel)) : [];

  return (
    <>
      {abertura === 'tocando' && <Abertura />}
      <div className={abertura === 'tocando' ? 'revela' : undefined}>
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
          </main>
        )}
      </div>
    </>
  );
}
