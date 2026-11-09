'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/cliente';
import { inicioDaSemana, meusPlantoes, Plantao, quandoRelativo, rotuloDia, somarDias } from '@/lib/escala';
import { Membro, Papel, PERFIS, podeVer } from '@/lib/membro';
import { hojeIso } from '@/lib/texto';

type MeuPlantao = ReturnType<typeof meusPlantoes>[number];

const descrever = (p: MeuPlantao, hoje: string) =>
  [[quandoRelativo(p.data, hoje), rotuloDia(p.data)].filter(Boolean).join(', '), p.periodo?.toLowerCase(), p.diretor_do_dia ? `diretor-de-dia: ${p.diretor_do_dia}` : null, p.observacao].filter(Boolean).join(' · ');

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
  const [plantoes, setPlantoes] = useState<MeuPlantao[] | null>(null);
  const [hojeEscala, setHojeEscala] = useState('');
  // O aviso só aparece depois de carregar a escala, então ler o sessionStorage aqui não muda a primeira renderização.
  const [escondido, setEscondido] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem('aviso-sede-escondido') === hojeIso();
    } catch {
      return false;
    }
  });

  // Membro-de-dia na sede: dias desta semana e da próxima.
  useEffect(() => {
    const hoje = hojeIso();
    supabase().from('escala_sede').select('*').eq('membro_email', membro.email)
      .gte('data', hoje).lte('data', somarDias(inicioDaSemana(hoje), 13))
      .then(({ data }) => {
        setHojeEscala(hoje);
        setPlantoes(meusPlantoes((data as Plantao[]) ?? [], membro.email, hoje));
      });
  }, [membro.email]);

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
    <div className={`tela-escura${plantoes?.length && !escondido ? ' com-aviso-sede' : ''}`}>
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
            <p className="pequeno">
              <span className="suave">Membro-de-dia na sede</span><br />
              {plantoes === null ? '…' : plantoes.length === 0 ? 'Você não está na escala desta semana nem da próxima.' : plantoes.map((p) => (
                <span key={p.id} style={{ display: 'block' }}>{descrever(p, hojeEscala)}</span>
              ))}
            </p>
            {membro.papel === 'admin' && <Link href="/admin/escala">Escala da sede</Link>}
            <Link href="/">Trocar perfil</Link>
            <Link href="/senha">Trocar senha</Link>
            <button type="button" onClick={sair}>Sair do portal</button>
          </div>
        </details>
        {!!plantoes?.length && !escondido && (
          <div className="aviso-sede" role="status">
            <span>
              📍 Você é membro-de-dia na sede: {descrever(plantoes[0], hojeEscala)}
              {plantoes.length > 1 ? ` (e mais ${plantoes.length - 1} ${plantoes.length === 2 ? 'dia' : 'dias'}: veja no menu da conta)` : ''}
            </span>
            <button
              type="button"
              aria-label="Esconder aviso por hoje"
              onClick={() => {
                setEscondido(true);
                try { sessionStorage.setItem('aviso-sede-escondido', hojeIso()); } catch { /* sem sessionStorage */ }
              }}
            >×</button>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
