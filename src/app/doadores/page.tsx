'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Cabecalho, { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaDoador from '@/components/FichaDoador';
import { Carteira, carregarCarteira, montarFileiras, VisaoDoador } from '@/lib/carteira';
import { formatarData, formatarReais } from '@/lib/contato';
import { podeVer, useMembro } from '@/lib/membro';
import { NOME_SITUACAO } from '@/lib/situacao';

function detalhe(v: VisaoDoador): string {
  if (v.rel?.status_conversa === 'nova_mensagem') return 'Nova mensagem';
  if (v.falha?.motivo === 'atualizar_cartao') return 'Cartão precisa ser atualizado';
  if (v.falha?.motivo === 'lembrete') return 'Falta de saldo ou limite';
  if (v.brindeDevido && v.brinde?.status !== 'entregue') return `Brinde: ${v.brindeDevido.nome}`;
  if (v.plano) return `${v.plano.proximo.nome} em ${formatarData(v.plano.dataProximo)}`;
  if (v.situacao === 'pontual') return v.valorAlto ? 'Valor alto: contato pessoal' : `${v.pontual?.convites ?? 0} convite(s)`;
  return v.doador.email ?? '';
}

export default function Doadores() {
  const { carregando, membro, email } = useMembro();
  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const recarregar = useCallback(() => {
    carregarCarteira().then(setCarteira).catch((e: Error) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (podeVer(membro, 'doadores')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(() => (carteira ? montarFileiras(carteira) : []), [carteira]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!carteira || q.length < 2) return [];
    return carteira.visoes.filter((v) => `${v.doador.nome ?? ''} ${v.doador.email ?? ''}`.toLowerCase().includes(q)).slice(0, 30);
  }, [busca, carteira]);

  if (carregando) return <Carregando />;
  if (!podeVer(membro, 'doadores')) return <SemAcesso email={email} />;

  const visaoAberta = carteira?.visoes.find((v) => v.doador.id === aberto) ?? null;
  const contagem = (s: string) => carteira?.visoes.filter((v) => v.situacao === s).length ?? 0;

  const card = (v: VisaoDoador) => (
    <button key={v.doador.id} type="button" className="card-doador" onClick={() => setAberto(v.doador.id)}>
      <strong>{v.doador.nome ?? 'Sem nome'}</strong>
      <span className={`etiqueta ${v.situacao}`} style={{ alignSelf: 'flex-start' }}>{NOME_SITUACAO[v.situacao]}</span>
      <span className="pequeno">{formatarReais(v.principal?.valor ?? null)}</span>
      <span className="suave pequeno">{detalhe(v)}</span>
    </button>
  );

  return (
    <>
      <Cabecalho membro={membro} />
      <main className="pagina pilha" style={{ gap: 28 }}>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 28 }}>Doadores</h1>
          <label className="campo" style={{ minWidth: 260 }}>
            Buscar doador
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" />
          </label>
        </div>

        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}
        {!carteira && !erro && <p className="suave">Carregando doadores…</p>}

        {carteira && (
          <div className="linha pequeno suave">
            <span>{contagem('em_dia')} em dia</span>·
            <span>{contagem('atraso_1') + contagem('atraso_2') + contagem('atraso_3')} em atraso</span>·
            <span>{contagem('pontual')} pontuais</span>·
            <span>convertidos em mensais: {carteira.visoes.filter((v) => v.virouMensal).length}</span>
          </div>
        )}

        {busca.trim().length >= 2 && (
          <section className="fileira">
            <h2>Resultado da busca</h2>
            {encontrados.length ? <div className="fileira-trilho">{encontrados.map(card)}</div> : <p className="vazio">Ninguém encontrado.</p>}
          </section>
        )}

        {fileiras.map((f) => (
          <section key={f.chave} className="fileira" aria-label={f.titulo}>
            <h2>{f.titulo} <span className="suave pequeno">({f.itens.length})</span></h2>
            {f.itens.length ? <div className="fileira-trilho">{f.itens.map(card)}</div> : <p className="vazio">Nada por aqui.</p>}
          </section>
        ))}
      </main>

      {visaoAberta && carteira && (
        <FichaDoador
          key={visaoAberta.doador.id}
          visao={visaoAberta}
          modelos={carteira.modelos}
          aoFechar={() => setAberto(null)}
          aoSalvar={recarregar}
        />
      )}
    </>
  );
}
