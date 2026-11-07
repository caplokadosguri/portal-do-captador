'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BotaoImportar from '@/components/BotaoImportar';
import BotaoPlanilha from '@/components/BotaoPlanilha';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaParceria from '@/components/FichaParceria';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { formatarData } from '@/lib/contato';
import { exportarParcerias } from '@/lib/exportacoes';
import { faltandoNoPortal, lerParceriasDoArquivo } from '@/lib/importarPlanilha';
import { podeVer, useMembro } from '@/lib/membro';
import {
  corStatus, emAndamento, montarFileirasParcerias, numeroDeContatos, Parceria, precisaRetomar, rotuloStatus, ultimoContato,
} from '@/lib/parceiros';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

export default function Parceiros() {
  const { carregando, membro, email } = useMembro();
  const [dados, setDados] = useState<{ lista: Parceria[]; nomes: string[]; hoje: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | 'nova' | null>(null);
  const [busca, setBusca] = useState('');

  const recarregar = useCallback(() => {
    const sb = supabase();
    Promise.all([sb.from('parcerias').select('*').order('organizacao'), sb.from('membros').select('nome')]).then(([p, m]) => {
      if (p.error) return setErro(p.error.message);
      const lista = (p.data ?? []) as Parceria[];
      const nomes = [...new Set([...(m.data ?? []).map((x: { nome: string }) => x.nome), ...lista.map((x) => x.responsavel ?? '')])].filter(Boolean).sort();
      setDados({ lista, nomes, hoje: hojeIso() });
    });
  }, []);

  useEffect(() => {
    if (podeVer(membro, 'parceiros')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(() => (dados ? montarFileirasParcerias(dados.lista, dados.hoje) : []), [dados]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!dados || q.length < 2) return [];
    return dados.lista.filter((p) => `${p.organizacao} ${p.pessoa ?? ''} ${p.tipo ?? ''}`.toLowerCase().includes(q));
  }, [busca, dados]);

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'parceiros')) return <SemAcesso email={email} />;

  const lista = dados?.lista ?? [];
  const andamento = lista.filter(emAndamento).length;
  const retomar = dados ? lista.filter((p) => precisaRetomar(p, dados.hoje)) : [];
  const fechados = lista.filter((p) => p.status === 'parceria_fechada' || p.status === 'apoio_confirmado').length;
  const aberta = aberto && aberto !== 'nova' ? lista.find((p) => p.id === aberto) ?? null : null;

  const card = (p: Parceria) => {
    const n = numeroDeContatos(p);
    const u = ultimoContato(p);
    return (
      <Card
        key={p.id}
        titulo={p.organizacao}
        linha={[p.pessoa, u ? `último contato ${formatarData(u)}` : null].filter(Boolean).join(' · ')}
        grande={p.tipo ?? (n ? `${n}º contato` : 'Sem contato')}
        selo={rotuloStatus(p.status)}
        cor={corStatus(p.status)}
        aoAbrir={() => setAberto(p.id)}
      />
    );
  };

  return (
    <Tela membro={membro}>
      <Destaque
        rotulo="Plano de abordagem · Parcerias e doações PJ"
        titulo={!dados ? 'Carregando parcerias…' : retomar.length ? `${retomar.length} ${retomar.length === 1 ? 'empresa espera' : 'empresas esperam'} retorno` : `${andamento} abordagens em andamento`}
        cor={retomar.length ? '#E5533D' : '#B8692A'}
        meta={dados ? [`${andamento} em andamento`, `${fechados} fechadas ou confirmadas`, `${lista.length} no total`] : []}
        descricao={dados ? 'Cada empresa tem até quatro contatos registrados. Mais de 7 dias sem retorno aparece em “Retomar contato”.' : undefined}
        acoes={
          dados ? (
            <>
              {retomar[0] && <button type="button" className="botao" onClick={() => setAberto(retomar[0].id)}>▶ Retomar {retomar[0].organizacao}</button>}
              <button type="button" className={retomar[0] ? 'botao secundario' : 'botao'} onClick={() => setAberto('nova')}>+ Nova abordagem</button>
            </>
          ) : undefined
        }
      />
      <div className="miolo">
        <Ferramentas>
          <button type="button" className="botao destaque-cor" onClick={() => setAberto('nova')}>+ Nova abordagem</button>
          <BotaoPlanilha
            opcoes={[
              {
                rotulo: 'Gerar planilha',
                temModelo: true,
                preparar: () => exportarParcerias(lista),
                verificar: async (arquivo) => {
                  const lidos = await lerParceriasDoArquivo(arquivo);
                  if (!lidos) return 'Este arquivo não parece ser o plano de abordagem (aba “Parcerias e Doações PJ”).';
                  const faltam = faltandoNoPortal(lidos.map((p) => p.organizacao), lista.map((p) => p.organizacao));
                  return faltam.length
                    ? `O arquivo tem ${faltam.length} organização(ões) que não estão no portal (ex.: ${faltam.slice(0, 2).join('; ')}). Use “Importar do Drive” antes, para não perdê-las.`
                    : null;
                },
              },
            ]}
          />
          {dados && (
            <BotaoImportar
              ler={lerParceriasDoArquivo}
              nomeDe={(p) => p.organizacao}
              existentes={lista.map((p) => p.organizacao)}
              gravar={async (novos) => {
                const { error } = await supabase().from('parcerias').insert(novos);
                if (error) throw new Error(error.message);
              }}
              aoTerminar={recarregar}
            />
          )}
          <label className="campo">
            <span className="sr">Buscar parceria</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por empresa, pessoa ou tipo" />
          </label>
        </Ferramentas>
        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}
        {busca.trim().length >= 2 && (
          <Fileira titulo="Resultado da busca" quantidade={encontrados.length} vazio="Nada encontrado.">
            {encontrados.map(card)}
          </Fileira>
        )}
        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <Fileira key={f.chave} titulo={f.titulo} cor={f.cor} quantidade={f.itens.length}>
            {f.itens.map(card)}
          </Fileira>
        ))}
      </div>
      {aberto && dados && (
        <FichaParceria
          key={aberto}
          parceria={aberta}
          responsaveis={dados.nomes}
          podeApagar={membro.papel === 'admin'}
          aoFechar={() => setAberto(null)}
          aoSalvar={recarregar}
        />
      )}
    </Tela>
  );
}
