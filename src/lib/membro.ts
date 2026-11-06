'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase/cliente';

export type Papel = 'admin' | 'doadores' | 'editais' | 'parceiros' | 'eventos';

export interface Membro {
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

export const PERFIS: { papel: Papel; nome: string; rota: string; cor: string; tinta: string; icone: string }[] = [
  { papel: 'admin', nome: 'Administrador', rota: '/admin', cor: '#3192B3', tinta: '#FFFFFF', icone: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z' },
  { papel: 'doadores', nome: 'Doadores', rota: '/doadores', cor: '#F9B341', tinta: '#12303D', icone: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' },
  { papel: 'editais', nome: 'Editais', rota: '/editais', cor: '#2A5F74', tinta: '#FFFFFF', icone: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6' },
  { papel: 'parceiros', nome: 'Parceiros', rota: '/parceiros', cor: '#B8692A', tinta: '#FFFFFF', icone: 'M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 7V5h6v2 M3 12h18' },
  { papel: 'eventos', nome: 'Eventos', rota: '/eventos', cor: '#12303D', tinta: '#FFFFFF', icone: 'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4 M4 10h16' },
];

/** Quem está logado e qual o seu papel. `null` = logado, mas sem acesso liberado. */
export function useMembro() {
  const [estado, setEstado] = useState<{ carregando: boolean; membro: Membro | null; email: string | null }>({
    carregando: true,
    membro: null,
    email: null,
  });

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getUser();
      const email = data.user?.email?.toLowerCase() ?? null;
      if (!email) return setEstado({ carregando: false, membro: null, email: null });
      const { data: m } = await sb.from('membros').select('*').eq('email', email).eq('ativo', true).maybeSingle();
      setEstado({ carregando: false, membro: (m as Membro) ?? null, email });
    })();
  }, []);

  return estado;
}

export function podeVer(membro: Membro | null, papel: Papel): boolean {
  return !!membro && (membro.papel === 'admin' || membro.papel === papel);
}
