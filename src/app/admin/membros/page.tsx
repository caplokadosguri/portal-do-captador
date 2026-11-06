'use client';

import { useCallback, useEffect, useState } from 'react';
import Cabecalho, { Carregando, SemAcesso } from '@/components/Cabecalho';
import { Membro, Papel, PERFIS, useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

export default function Membros() {
  const { carregando, membro, email } = useMembro();
  const [lista, setLista] = useState<Membro[]>([]);
  const [novo, setNovo] = useState({ email: '', nome: '', papel: 'doadores' as Papel });
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(() => {
    supabase().from('membros').select('*').order('nome').then(({ data }) => setLista((data as Membro[]) ?? []));
  }, []);
  useEffect(() => {
    if (membro?.papel === 'admin') carregar();
  }, [membro, carregar]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().from('membros').insert({ ...novo, email: novo.email.trim().toLowerCase() });
    setAviso(error ? { tipo: 'erro', texto: error.message } : { tipo: 'ok', texto: 'Membro cadastrado. Ele já pode entrar com esse e-mail.' });
    if (!error) {
      setNovo({ email: '', nome: '', papel: 'doadores' });
      carregar();
    }
  }

  async function alternar(m: Membro) {
    if (m.email === membro?.email && m.ativo) return setAviso({ tipo: 'erro', texto: 'Você não pode desativar a si mesmo.' });
    const { error } = await supabase().from('membros').update({ ativo: !m.ativo }).eq('email', m.email);
    setAviso(error ? { tipo: 'erro', texto: error.message } : { tipo: 'ok', texto: m.ativo ? 'Acesso removido.' : 'Acesso reativado.' });
    carregar();
  }

  return (
    <>
      <Cabecalho membro={membro} />
      <main className="pagina pilha" style={{ gap: 20 }}>
        <h1 style={{ fontSize: 28 }}>Membros e perfis</h1>
        <p className="suave" style={{ margin: 0 }}>Quando alguém sair da equipe, desative o acesso no mesmo dia.</p>
        <form className="cartao grade-2" onSubmit={adicionar}>
          <label className="campo">
            E-mail
            <input type="email" required value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          </label>
          <label className="campo">
            Nome
            <input required value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </label>
          <label className="campo">
            Perfil
            <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Papel })}>
              {PERFIS.map((p) => <option key={p.papel} value={p.papel}>{p.nome}</option>)}
            </select>
          </label>
          <button className="botao" type="submit" style={{ alignSelf: 'flex-end' }}>Cadastrar membro</button>
        </form>
        {aviso && <p className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</p>}
        <div className="rolagem cartao">
          <table className="tabela">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Acesso</th></tr></thead>
            <tbody>
              {lista.map((m) => (
                <tr key={m.email}>
                  <td>{m.nome}</td>
                  <td>{m.email}</td>
                  <td>{PERFIS.find((p) => p.papel === m.papel)?.nome}</td>
                  <td>
                    <button type="button" className="botao secundario" onClick={() => alternar(m)}>
                      {m.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
