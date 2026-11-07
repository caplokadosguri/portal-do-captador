'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';
import { Membro, Papel, PERFIS, podeVer } from '@/lib/membro';

const SECOES: { rotulo: string; rota: string; papel: Papel }[] = [
  { rotulo: 'Início', rota: '/admin', papel: 'admin' },
  { rotulo: 'Doadores', rota: '/doadores', papel: 'doadores' },
  { rotulo: 'Editais', rota: '/editais', papel: 'editais' },
  { rotulo: 'Projetos', rota: '/projetos', papel: 'editais' },
  { rotulo: 'Parceiros', rota: '/parceiros', papel: 'parceiros' },
  { rotulo: 'Eventos', rota: '/eventos', papel: 'eventos' },
];

/** Moldura das telas internas: fundo escuro e barra de navegação no topo. */
export default function Tela({ membro, children }: { membro: Membro; children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  async function sair() {
    await supabase().auth.signOut();
    router.replace('/login');
  }

  const perfil = PERFIS.find((p) => p.papel === membro.papel) ?? PERFIS[0];
  const secoes = SECOES.filter((s) => (s.papel === 'admin' ? membro.papel === 'admin' : podeVer(membro, s.papel)));

  return (
    <div className="tela-escura">
      <header className={`nav-topo${rolou ? ' solida' : ''}`}>
        <Link href="/" className="nav-marca" aria-label="Trocar perfil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/casd-logo-escuro.svg" alt="CASD" />
          <span className="flix">FLIX</span>
        </Link>
        <nav aria-label="Seções" className="nav-secoes">
          {secoes.map((s) => (
            <Link key={s.rota} href={s.rota} aria-current={caminho.startsWith(s.rota) ? 'page' : undefined}>
              {s.rotulo}
            </Link>
          ))}
        </nav>
        <details className="nav-conta">
          <summary aria-label="Conta">
            <span className="avatar" style={{ background: perfil.cor }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={perfil.tinta} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={perfil.icone} />
              </svg>
            </span>
            <span className="seta" aria-hidden="true">▾</span>
          </summary>
          <div className="nav-menu">
            <p className="pequeno"><strong>{membro.nome}</strong><br /><span className="suave">{perfil.nome}</span></p>
            <Link href="/">Trocar perfil</Link>
            <button type="button" onClick={sair}>Sair do portal</button>
          </div>
        </details>
      </header>
      {children}
    </div>
  );
}
