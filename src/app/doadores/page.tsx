'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaDoador from '@/components/FichaDoador';
import StatusDrive from '@/components/StatusDrive';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { diasAteAniversario, rotuloAniversario } from '@/lib/aniversario';
import { Carteira, carregarCarteira, montarFileiras, VisaoDoador } from '@/lib/carteira';
import { formatarData, formatarReais } from '@/lib/contato';
import { ContatoDoador, exportarCarteira, exportarInadimplentes } from '@/lib/exportacoes';
import { gerarPlanilha } from '@/lib/planilha';
import { DIAS_PARA_CONFERIR } from '@/lib/plano';
import { diasEntre } from '@/lib/texto';
import { buscarTudo, supabase } from '@/lib/supabase/cliente';
import { podeVer, useMembro } from '@/lib/membro';
import { NOME_SITUACAO, Situacao } from '@/lib/situacao';

const COR: Record<Situacao, string> = {
  em_dia: '#3FA66B',
  atraso_1: '#F9B341',
  atraso_2: '#E07B39',
  atraso_3: '#C0564A',
  pontual: '#3192B3',
  cancelado: '#6B7F88',
  sem_dados: '#6B7F88',
};

const COR_FILEIRA: Record<string, string> = {
  atencao: '#E5533D', aniversarios: '#F06FA8', atraso_1: COR.atraso_1, atraso_2: COR.atraso_2, atraso_3: COR.atraso_3,
  checkpoints: '#8E6CD1', pontuais: COR.pontual, em_dia: COR.em_dia, cancelado: COR.cancelado,
};

/** Busca os contatos de cobrança e o nome dos membros para a aba "Inadimplentes". */
async function prepararInadimplentes(carteira: Carteira | null) {
  const sb = supabase();
  const contatos = await buscarTudo<ContatoDoador>((a, b) =>
    sb.from('contatos').select('doador_id, membro, canal, motivo, resultado, nota, criado_em').eq('motivo', 'cobranca').range(a, b),
  );
  const { data: membros } = await sb.from('membros').select('email, nome');
  const nomes = new Map((membros ?? []).map((m: { email: string; nome: string }) => [m.email, m.nome]));
  return exportarInadimplentes(carteira?.visoes ?? [], contatos, (e) => nomes.get(e) ?? e, carteira?.hoje ?? '', carteira?.dadosDe ?? null);
}

function detalhe(v: VisaoDoador, hoje: string): string {
  if (v.rel?.status_conversa === 'nova_mensagem') return 'Nova mensagem';
  const { nascimento_dia: dia, nascimento_mes: mes } = v.doador;
  if (dia && mes && (diasAteAniversario(dia, mes, hoje) ?? 99) <= 6) return `🎂 Aniversário ${rotuloAniversario(dia, mes, hoje)}`;
  if (v.falha?.motivo === 'atualizar_cartao') return 'Cartão precisa ser atualizado';
  if (v.falha?.motivo === 'lembrete') return 'Falta de saldo ou limite';
  if (v.brindeDevido && v.brinde?.status !== 'entregue') return `Brinde: ${v.brindeDevido.nome}`;
  if (v.plano) return `${v.plano.proximo.nome} em ${formatarData(v.plano.dataProximo)}`;
  if (v.situacao === 'pontual') return v.valorAlto ? 'Valor alto: contato pessoal' : `${v.pontual?.convites ?? 0} convite(s)`;
  return '';
}

export default function Doadores() {
  const { carregando, membro, email } = useMembro();
  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => carregarCarteira().then(setCarteira).catch((e: Error) => setErro(e.message)), []);
  const salvou = useCallback(async () => {
    await recarregar();
    setVersao((v) => v + 1);
  }, [recarregar]);

  useEffect(() => {
    if (podeVer(membro, 'doadores')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(() => (carteira ? montarFileiras(carteira) : []), [carteira]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!carteira || q.length < 2) return [];
    return carteira.visoes.filter((v) => `${v.doador.nome ?? ''} ${v.doador.email ?? ''}`.toLowerCase().includes(q)).slice(0, 40);
  }, [busca, carteira]);

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'doadores')) return <SemAcesso email={email} />;

  const visaoAberta = carteira?.visoes.find((v) => v.doador.id === aberto) ?? null;
  const desatualizado = !!carteira && carteira.visoes.length > 0 && (!carteira.dadosDe || diasEntre(carteira.dadosDe, carteira.hoje) > DIAS_PARA_CONFERIR);
  const contagem = (s: Situacao) => carteira?.visoes.filter((v) => v.situacao === s).length ?? 0;
  const atrasados = contagem('atraso_1') + contagem('atraso_2') + contagem('atraso_3');
  const mensal = carteira?.visoes.filter((v) => v.situacao === 'em_dia').reduce((s, v) => s + (v.principal?.valor ?? 0), 0) ?? 0;
  const atencao = fileiras.find((f) => f.chave === 'atencao')?.itens ?? [];
  const primeiro = atencao[0] ?? fileiras.find((f) => f.chave.startsWith('atraso') && f.itens.length)?.itens[0] ?? null;

  const card = (v: VisaoDoador) => (
    <Card
      key={v.doador.id}
      titulo={v.doador.nome ?? 'Sem nome'}
      linha={detalhe(v, carteira?.hoje ?? '') || undefined}
      grande={v.principal?.valor ? formatarReais(v.principal.valor) : undefined}
      selo={NOME_SITUACAO[v.situacao]}
      cor={COR[v.situacao]}
      aoAbrir={() => setAberto(v.doador.id)}
    />
  );

  const titulo = !carteira
    ? 'Carregando doadores…'
    : atencao.length
      ? `${atencao.length} ${atencao.length === 1 ? 'doador precisa' : 'doadores precisam'} de você hoje`
      : atrasados
        ? `${atrasados} ${atrasados === 1 ? 'doação' : 'doações'} em atraso`
        : 'Carteira em dia';

  return (
    <Tela membro={membro}>
      <Destaque
        rotulo="Carteira de doadores"
        titulo={titulo}
        cor={atencao.length || atrasados ? '#E5533D' : '#3FA66B'}
        meta={
          carteira
            ? [
                `${contagem('em_dia')} mensais em dia`,
                `${atrasados} em atraso`,
                `${contagem('pontual')} pontuais`,
                `${formatarReais(mensal)} por mês`,
                carteira.dadosDe ? `pagamentos de ${formatarData(carteira.dadosDe)}` : null,
              ]
            : []
        }
        descricao={
          carteira
            ? 'Comece por quem precisa de atenção, depois os atrasos. Cada contato fica registrado na ficha do doador.'
            : undefined
        }
        acoes={
          primeiro ? (
            <button type="button" className="botao" onClick={() => setAberto(primeiro.doador.id)}>
              ▶ Começar por {primeiro.doador.nome?.split(' ')[0] ?? 'o primeiro'}
            </button>
          ) : undefined
        }
      />

      <div className="miolo">
        <Ferramentas>
          <StatusDrive
            planilha="abordagem"
            pronto={!!carteira}
            versao={versao}
            ehAdmin={membro.papel === 'admin'}
            preparar={() => prepararInadimplentes(carteira)}
          />
          <button type="button" className="link-botao" style={{ alignSelf: 'center' }} onClick={() => gerarPlanilha(exportarCarteira(carteira?.visoes ?? []))}>
            Baixar carteira completa (.xlsx)
          </button>
          <label className="campo">
            <span className="sr">Buscar doador</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" />
          </label>
          {carteira && (
            <p className="resumo">
              <span>Convertidos de pontual para mensal: <strong>{carteira.visoes.filter((v) => v.virouMensal).length}</strong></span>
            </p>
          )}
        </Ferramentas>

        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}
        {carteira && desatualizado && (
          <p className="aviso" role="note">
            <strong>Os dados de pagamento são de {carteira.dadosDe ? formatarData(carteira.dadosDe) : 'uma data desconhecida'}.</strong>{' '}
            Antes de cobrar alguém, confira na Trackmob se já pagou, ou peça à diretoria uma importação nova dos relatórios.
          </p>
        )}

        {busca.trim().length >= 2 && (
          <Fileira titulo="Resultado da busca" quantidade={encontrados.length} vazio="Ninguém encontrado.">
            {encontrados.map(card)}
          </Fileira>
        )}

        {carteira && carteira.visoes.length === 0 && (
          <p className="aviso">Ainda não há doadores. A diretoria importa os relatórios da Trackmob em Início › Importar.</p>
        )}

        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <Fileira key={f.chave} titulo={f.titulo} cor={COR_FILEIRA[f.chave]} quantidade={f.itens.length}>
            {f.itens.map(card)}
          </Fileira>
        ))}
      </div>

      {visaoAberta && carteira && (
        <FichaDoador
          key={visaoAberta.doador.id}
          visao={visaoAberta}
          modelos={carteira.modelos}
          dadosDe={carteira.dadosDe}
          hoje={carteira.hoje}
          nomeMembro={membro.nome}
          aoFechar={() => setAberto(null)}
          aoSalvar={salvou}
        />
      )}
    </Tela>
  );
}
