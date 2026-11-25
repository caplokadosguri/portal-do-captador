'use client';

import { useEffect, useRef, useState } from 'react';
import { diasEntre } from '@/lib/texto';
import { diasAteAniversario } from '@/lib/aniversario';
import type { Modelo, ParteMensagem, VisaoDoador } from '@/lib/carteira';
import { formatarCelular, formatarData, formatarReais, linkWhatsApp, modeloDeCobranca, MotivoContato, motivoDoModelo, MOTIVOS_CONTATO, preencherModelo, vcard } from '@/lib/contato';
import { ITEANO, mudaComTratamento, partesDaVariacao, rotuloVersao, saudacaoDaHora, TODAS_VERSOES, Tratamento, TRATAMENTOS, Versao, versaoPreenchida, versaoSugerida } from '@/lib/mensagens';
import { desistiu, voltouAPagar } from '@/lib/recuperacao';
import { NOME_SITUACAO } from '@/lib/situacao';
import { supabase } from '@/lib/supabase/cliente';

const STATUS_CONVERSA: [string, string][] = [
  ['', '—'],
  ['lembrete_1', '1º lembrete enviado'],
  ['lembrete_2', '2º lembrete enviado'],
  ['aguardando_resposta', 'Aguardando resposta'],
  ['nova_mensagem', 'Nova mensagem'],
  ['em_atendimento', 'Em atendimento'],
  ['contato_humano', 'Precisa de contato humano'],
  ['resolvido', 'Resolvido'],
];
const STATUS_BRINDE: [string, string][] = [
  ['pendente', 'Pendente'], ['preparado', 'Preparado'], ['enviado', 'Enviado'], ['entregue', 'Entregue'], ['em_espera', 'Em espera'],
];
const STATUS_PONTUAL: [string, string][] = [
  ['agradecido', 'Agradecido'], ['impacto_enviado', 'Impacto enviado'], ['convidado', 'Convidado'],
  ['virou_mensal', 'Virou mensal'], ['sem_resposta', 'Sem resposta'],
];
const CANAIS: [string, string, keyof VisaoDoador['doador'] | null][] = [
  ['whatsapp', 'WhatsApp', 'aceita_whatsapp'], ['ligacao', 'Ligação', 'aceita_ligacao'], ['email', 'E-mail', 'aceita_email'],
  ['sms', 'SMS', 'aceita_sms'], ['carta', 'Carta', 'aceita_cartas'], ['presencial', 'Presencial', null],
];

interface ContatoRegistrado { id: string; membro: string; canal: string; motivo: string; modelo: string | null; versao?: number | null; resultado: string | null; nota: string | null; criado_em: string }

/** "100", "100,50" ou "R$ 1.234,56" -> número; vazio ou inválido -> null. */
function valorEmReais(t: string): number | null {
  const limpo = t.replace(/[^\d,.]/g, '');
  if (!limpo) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

/** Modelo do plano para o marco em que o doador está. */
const MODELO_DO_MARCO: Record<string, string> = { inicio: 'boas_vindas', renovacao_1: 'renovacao_1', meses_6: 'meses_6', ano_1: 'ano_1' };

function modeloSugerido(v: VisaoDoador, hoje: string): string {
  if (v.falha?.motivo === 'atualizar_cartao') return 'cartao_vencido';
  if (v.situacao.startsWith('atraso')) return modeloDeCobranca(v.principal?.meio_pagamento);
  if ((diasAteAniversario(v.doador.nascimento_dia ?? null, v.doador.nascimento_mes ?? null, hoje) ?? 99) <= 6) return 'aniversario';
  if (v.situacao === 'pontual') return 'pontual_convite';
  if (v.situacao === 'sem_doacao') return 'lead_convite';
  // O marco que pede ação (atrasado, hoje ou chegando); senão, o último alcançado.
  const marco = v.marco?.checkpoint.chave ?? v.plano?.atual?.chave;
  if (!marco) return 'boas_vindas';
  return MODELO_DO_MARCO[marco] ?? 'semestral';
}
export default function FichaDoador({ visao, modelos, dadosDe, hoje, nomeMembro, aoFechar, aoSalvar }: {
  dadosDe?: string | null;
  hoje: string;
  nomeMembro: string;
  visao: VisaoDoador;
  modelos: Modelo[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { doador, principal } = visao;
  const [chaveModelo, setChaveModelo] = useState(() => {
    const sugerido = modeloSugerido(visao, hoje);
    return modelos.some((m) => m.chave === sugerido) ? sugerido : modelos[0]?.chave ?? '';
  });
  // Mensagens do plano têm versões (1, 2, 3) e tratamento (masculino/feminino).
  const [versao, setVersao] = useState<Versao>(1);
  const [tratamento, setTratamento] = useState<Tratamento | null>(() => (visao.rel?.tratamento === 'm' || visao.rel?.tratamento === 'f' ? visao.rel.tratamento : null));
  const sugeriuVersao = useRef(false);
  // Histórico carregado, para sugerir a versão pela quantidade de mensagens do mesmo tipo já enviadas.
  const historicoRef = useRef<ContatoRegistrado[]>([]);
  const jaEnviadas = (chave: string) => historicoRef.current.filter((h) => h.motivo === motivoDoModelo(chave)).length;
  // Doador do ITA: turma e apelido conferidos na Wikita; muda a saudação ("Saudações Iteanas…").
  const [ita, setIta] = useState({
    iteano: !!visao.rel?.iteano,
    turma_ita: visao.rel?.turma_ita ?? '',
    apelido_ita: visao.rel?.apelido_ita ?? '',
  });
  // A mensagem vai em partes, uma de cada vez, para parecer conversa e não disparo.
  const preencher = (chave: string, ver: Versao = versao, trat: Tratamento | null = tratamento, apelido: string = ita.apelido_ita): ParteMensagem[] => {
    const m = modelos.find((x) => x.chave === chave);
    if (!m) return [];
    const base = m.partes?.length ? m.partes : [{ rotulo: 'Mensagem', texto: m.texto }];
    const partes = (m.variacoes && partesDaVariacao(m.variacoes, ver, trat ?? 'm')) || base;
    const dados = {
      nome: doador.nome, valor: principal?.valor, meses: visao.plano?.mesesDeDoacao, membro: nomeMembro,
      brinde: visao.brinde?.item, tempo: (visao.marco?.checkpoint ?? visao.plano?.atual)?.nome,
      saudacao: saudacaoDaHora(new Date().getHours()),
      apelido,
    };
    return partes.map((p) => ({ rotulo: p.rotulo, texto: preencherModelo(p.texto, dados) }));
  };
  const [partes, setPartes] = useState<ParteMensagem[]>(() => preencher(chaveModelo));
  const modeloAtual = modelos.find((x) => x.chave === chaveModelo);
  const temVersoes = !!modeloAtual?.variacoes;
  /** Troca modelo, versão ou tratamento e remonta as partes. */
  function trocarMensagem(mudanca: { chave?: string; versao?: Versao; tratamento?: Tratamento; apelido?: string }) {
    const chave = mudanca.chave ?? chaveModelo;
    // Ao trocar de mensagem, a versão volta para a sugerida daquela mensagem.
    const novas = mudanca.chave ? modelos.find((x) => x.chave === mudanca.chave)?.variacoes : null;
    const ver = mudanca.versao ?? (mudanca.chave ? (novas ? versaoSugerida(novas, jaEnviadas(mudanca.chave), ita.iteano) : 1) : versao);
    const trat = mudanca.tratamento ?? tratamento;
    setChaveModelo(chave);
    setVersao(ver);
    if (mudanca.tratamento) setTratamento(mudanca.tratamento);
    setPartes(preencher(chave, ver, trat, mudanca.apelido ?? ita.apelido_ita));
    setEnviadas([]);
    if (mudanca.chave) setRegistro((r) => ({ ...r, motivo: motivoDoModelo(chave) }));
  }
  async function escolherTratamento(t: Tratamento) {
    trocarMensagem({ tratamento: t });
    // Fica lembrado para os próximos contatos com este doador.
    const { error } = await supabase().from('relacionamento').upsert({ doador_id: doador.id, tratamento: t });
    if (error) setAviso({ tipo: 'erro', texto: `Não salvou o tratamento: ${error.message}` });
  }
  /** Salva a marcação do ITA e ajusta a mensagem (versão Iteano e apelido). */
  const itaSalvo = useRef(ita);
  async function salvarIta(novo: typeof ita) {
    setIta(novo);
    const antes = itaSalvo.current;
    if (antes.iteano === novo.iteano && antes.turma_ita === novo.turma_ita && antes.apelido_ita === novo.apelido_ita) return;
    itaSalvo.current = novo;
    const variacoes = modelos.find((x) => x.chave === chaveModelo)?.variacoes;
    const ver = !variacoes ? versao : novo.iteano ? (versaoPreenchida(variacoes, ITEANO) ? ITEANO : versao) : versao === ITEANO ? versaoSugerida(variacoes, jaEnviadas(chaveModelo)) : versao;
    if (antes.iteano !== novo.iteano || antes.apelido_ita !== novo.apelido_ita) trocarMensagem({ versao: ver, apelido: novo.apelido_ita });
    const { error } = await supabase().from('relacionamento').upsert({
      doador_id: doador.id, iteano: novo.iteano, turma_ita: novo.turma_ita.trim() || null, apelido_ita: novo.apelido_ita.trim() || null,
    });
    if (error) setAviso({ tipo: 'erro', texto: `Não salvou a marcação do ITA: ${error.message}` });
  }
  const [enviadas, setEnviadas] = useState<boolean[]>([]);
  const [rel, setRel] = useState({
    status_conversa: visao.rel?.status_conversa ?? '',
    proximo_contato: visao.rel?.proximo_contato ?? '',
    anotacoes: visao.rel?.anotacoes ?? '',
  });
  const [registro, setRegistro] = useState<{ canal: string; motivo: MotivoContato; resultado: string; nota: string }>(
    () => ({ canal: 'ligacao', motivo: motivoDoModelo(chaveModelo), resultado: '', nota: '' }),
  );
  const [historico, setHistorico] = useState<ContatoRegistrado[]>([]);
  // Perfil do doador ou histórico de contatos (editável).
  const [aba, setAba] = useState<'perfil' | 'contatos'>('perfil');
  const [editando, setEditando] = useState<{ id: string; canal: string; motivo: string; resultado: string; nota: string; data: string } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [obsRecuperacao, setObsRecuperacao] = useState('');
  // Valor com que voltou a doar (pode mudar ao voltar da inadimplência).
  const [valorNovo, setValorNovo] = useState(() => (principal?.valor != null ? String(principal.valor) : ''));
  const [editandoValor, setEditandoValor] = useState<{ anterior: string; novo: string } | null>(null);
  const [filtro, setFiltro] = useState<MotivoContato | 'todos'>('todos');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const buscarHistorico = () =>
    supabase().from('contatos').select('*').eq('doador_id', doador.id).order('criado_em', { ascending: false }).limit(50);

  async function carregarHistorico() {
    const { data } = await buscarHistorico();
    aplicarHistorico((data as ContatoRegistrado[]) ?? []);
  }

  function aplicarHistorico(lista: ContatoRegistrado[]) {
    setHistorico(lista);
    // Na abertura, sugere a versão pela quantidade de mensagens do plano que o doador já recebeu.
    if (!sugeriuVersao.current) {
      sugeriuVersao.current = true;
      const m = modelos.find((x) => x.chave === chaveModelo);
      historicoRef.current = lista;
      if (m?.variacoes) trocarMensagem({ versao: versaoSugerida(m.variacoes, jaEnviadas(chaveModelo), ita.iteano) });
    }
  }

  useEffect(() => {
    ref.current?.showModal();
    const sb = supabase();
    sb.from('acessos').insert({ doador_id: doador.id, acao: 'abriu_ficha' }).then(() => undefined);
    buscarHistorico().then(({ data }) => aplicarHistorico((data as ContatoRegistrado[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doador.id]);

  function resultado(error: { message: string } | null, ok: string) {
    setAviso(error ? { tipo: 'erro', texto: `Não salvou: ${error.message}` } : { tipo: 'ok', texto: ok });
    if (!error) aoSalvar();
  }

  /** Tira o lembrete do marco da fileira de checkpoints, sem registrar contato, e fecha a ficha. */
  async function dispensarMarco() {
    if (!visao.marco) return;
    const { error } = await supabase().from('marcos_dispensados').insert({
      doador_id: doador.id, data_marco: visao.marco.data, checkpoint: visao.marco.checkpoint.chave,
    });
    if (error) return resultado(error, '');
    aoSalvar();
    ref.current?.close();
  }

  // Liberado também para quem não aceitou WhatsApp (decisão da diretoria executiva, 16/11/2026); a ficha avisa.
  const pedeTratamento = temVersoes && mudaComTratamento(modeloAtual?.variacoes, versao);
  const podeWhatsApp = !!linkWhatsApp(doador.celular, 'x') && (!pedeTratamento || !!tratamento);
  const proxima = partes.findIndex((_, i) => !enviadas[i]);

  async function enviarParte(i: number) {
    const link = linkWhatsApp(doador.celular, partes[i].texto);
    if (!link) return;
    window.open(link, '_blank', 'noopener');
    const primeira = !enviadas.some(Boolean);
    setEnviadas((e) => Object.assign([...e], { [i]: true }));
    if (!primeira) return;
    // Um registro por conversa, com o texto completo.
    const { error } = await supabase().from('contatos').insert({
      doador_id: doador.id, canal: 'whatsapp', motivo: motivoDoModelo(chaveModelo), modelo: chaveModelo, versao: temVersoes ? versao : null,
      nota: partes.map((p) => p.texto).join('\n\n').slice(0, 500),
    });
    resultado(error, 'Contato por WhatsApp registrado. Envie as próximas partes em ordem.');
    carregarHistorico();
  }

  async function copiarParte(i: number) {
    try {
      await navigator.clipboard.writeText(partes[i].texto);
      setAviso({ tipo: 'ok', texto: `Parte ${i + 1} copiada.` });
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não deu para copiar neste navegador.' });
    }
  }

  async function copiarCelular() {
    try {
      await navigator.clipboard.writeText(formatarCelular(doador.celular) ?? '');
      setAviso({ tipo: 'ok', texto: 'Celular copiado.' });
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não deu para copiar neste navegador.' });
    }
  }

  function baixarContato() {
    const blob = new Blob([vcard(doador)], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(doador.nome ?? 'doador').replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'doador'}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
    supabase().from('acessos').insert({ doador_id: doador.id, acao: 'baixou_contato' }).then(() => undefined);
  }

  async function salvarRelacionamento() {
    const { error } = await supabase().from('relacionamento').upsert({
      doador_id: doador.id,
      status_conversa: rel.status_conversa || null,
      proximo_contato: rel.proximo_contato || null,
      anotacoes: rel.anotacoes || null,
      atualizado_em: new Date().toISOString(),
    });
    resultado(error, 'Acompanhamento salvo.');
  }

  async function registrarContato() {
    const { error } = await supabase().from('contatos').insert({
      doador_id: doador.id, canal: registro.canal, motivo: registro.motivo,
      resultado: registro.resultado || null, nota: registro.nota || null,
    });
    resultado(error, 'Contato registrado.');
    if (!error) setRegistro({ ...registro, resultado: '', nota: '' });
    carregarHistorico();
  }

  /** Corrige um contato registrado (tipo, canal, resultado, nota, data). */
  async function salvarEdicao() {
    if (!editando) return;
    const antes = historico.find((h) => h.id === editando.id);
    const mudouData = antes && antes.criado_em.slice(0, 10) !== editando.data;
    const { data, error } = await supabase().from('contatos').update({
      canal: editando.canal, motivo: editando.motivo, resultado: editando.resultado || null, nota: editando.nota || null,
      ...(mudouData && editando.data ? { criado_em: `${editando.data}T12:00:00-03:00` } : {}),
    }).eq('id', editando.id).select('id');
    if (!error && !data?.length) return setAviso({ tipo: 'erro', texto: 'Só quem registrou o contato (ou a diretoria) pode alterar.' });
    resultado(error, 'Contato corrigido.');
    if (!error) setEditando(null);
    carregarHistorico();
  }

  async function apagarContato(id: string) {
    const { data, error } = await supabase().from('contatos').delete().eq('id', id).select('id');
    setApagando(null);
    if (!error && !data?.length) return setAviso({ tipo: 'erro', texto: 'Só quem registrou o contato (ou a diretoria) pode excluir.' });
    resultado(error, 'Contato excluído.');
    carregarHistorico();
  }

  // Recuperação: inadimplente que voltou a doar (ou que pagou depois de uma cobrança).
  const pagouDepois = voltouAPagar(visao, hoje);
  const podeRecuperar = !visao.recuperado && (visao.situacao.startsWith('atraso') || pagouDepois);
  /** Começo da inadimplência: o do atraso atual; se já está em dia, a primeira cobrança recente registrada. */
  const inicioDaInadimplencia = () =>
    visao.atrasoDesde ??
    historico.filter((h) => h.motivo === 'cobranca' && diasEntre(h.criado_em.slice(0, 10), hoje) <= 120).map((h) => h.criado_em.slice(0, 10)).sort()[0] ??
    visao.ultimaCobranca?.slice(0, 10) ??
    null;

  // Doação mensal ativa (em dia ou em atraso): pode pedir para parar.
  const podeDesistir = !visao.recuperado && (podeRecuperar || visao.situacao === 'em_dia');

  async function marcarRecuperado(tipo: 'recuperado' | 'desistiu' = 'recuperado') {
    const sb = supabase();
    const { error } = await sb.from('recuperacoes').insert({
      doador_id: doador.id, tipo, inadimplente_desde: inicioDaInadimplencia(), observacao: obsRecuperacao.trim() || null,
      ...(tipo === 'recuperado'
        ? { valor_mensal: valorEmReais(valorNovo) ?? principal?.valor ?? null, valor_anterior: principal?.valor ?? null }
        : { valor_mensal: principal?.valor ?? null }),
    });
    if (error) return resultado(error, '');
    // A abordagem acabou: sai das pendências.
    await sb.from('relacionamento').upsert({ doador_id: doador.id, status_conversa: 'resolvido', proximo_contato: null, atualizado_em: new Date().toISOString() });
    setRel((r) => ({ ...r, status_conversa: 'resolvido', proximo_contato: '' }));
    setObsRecuperacao('');
    resultado(null, tipo === 'desistiu'
      ? 'Marcado: pediu para parar de doar. Saiu das pendências e do plano. Lembre de cancelar a doação na Trackmob.'
      : 'Marcado como recuperado: saiu das pendências e entrou na conta de recuperados.');
  }

  async function salvarValores() {
    if (!visao.recuperado || !editandoValor) return;
    const { error } = await supabase().from('recuperacoes').update({
      valor_anterior: valorEmReais(editandoValor.anterior), valor_mensal: valorEmReais(editandoValor.novo),
    }).eq('id', visao.recuperado.id);
    resultado(error, 'Valores da recuperação corrigidos.');
    if (!error) setEditandoValor(null);
  }

  async function desfazerRecuperado() {
    if (!visao.recuperado) return;
    const { error } = await supabase().from('recuperacoes').delete().eq('id', visao.recuperado.id);
    resultado(error, 'Marcação desfeita.');
  }

  async function salvarBrinde(status: string) {
    if (!visao.brindeDevido) return;
    const { error } = await supabase().from('brindes').upsert(
      { doador_id: doador.id, checkpoint: visao.brindeDevido.chave, status, atualizado_em: new Date().toISOString() },
      { onConflict: 'doador_id,checkpoint' },
    );
    resultado(error, 'Brinde atualizado.');
  }

  async function salvarPontual(status: string, novoConvite = false) {
    const { error } = await supabase().from('trilha_pontual').upsert({
      doador_id: doador.id,
      status,
      convites: (visao.pontual?.convites ?? 0) + (novoConvite ? 1 : 0),
      atualizado_em: new Date().toISOString(),
    });
    resultado(error, novoConvite ? 'Convite registrado.' : 'Trilha atualizada.');
  }

  const ultimaPagaNasCobrancas =
    visao.cobrancas.filter((c) => c.doacao_id === principal?.id && c.pago_em).map((c) => c.pago_em!).sort().at(-1) ?? null;
  const aceites = CANAIS.filter(([, , campo]) => campo).map(([, nome, campo]) => ({ nome, sim: doador[campo!] === true }));

  return (
    <dialog ref={ref} className="ficha" onClose={aoFechar} aria-labelledby="ficha-titulo">
      <div className="ficha-topo">
        <div className="pilha" style={{ gap: 6, flex: 1 }}>
          <h2 id="ficha-titulo">{doador.nome ?? 'Doador sem nome'}</h2>
          <div className="linha pequeno">
            <span className={`etiqueta ${visao.situacao}`}>{NOME_SITUACAO[visao.situacao]}</span>
            {principal && <span>{formatarReais(principal.valor)} · {principal.frequencia ?? '—'} · {principal.meio_pagamento ?? '—'}</span>}
          </div>
        </div>
        <div className="linha" style={{ gap: 8 }}>
          {visao.marco && (
            <button
              type="button"
              className="botao secundario"
              style={{ color: '#fff', borderColor: '#fff' }}
              onClick={dispensarMarco}
              title={`Tira o lembrete de “${visao.marco.checkpoint.nome}” da fileira de checkpoints sem registrar contato`}
            >
              Dispensar
            </button>
          )}
          <button type="button" className="botao secundario" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => ref.current?.close()} aria-label="Fechar ficha">
            Fechar
          </button>
        </div>
      </div>

      <div className="abas-ficha" role="tablist" aria-label="Seções da ficha">
        <button type="button" role="tab" aria-selected={aba === 'perfil'} onClick={() => setAba('perfil')}>Perfil</button>
        <button type="button" role="tab" aria-selected={aba === 'contatos'} onClick={() => setAba('contatos')}>
          Histórico de contatos<span className="conta">{historico.length}</span>
        </button>
      </div>

      <div className="ficha-corpo">
        {aviso && <p className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</p>}

        {aba === 'perfil' && <>

        {visao.situacao.startsWith('atraso') && (
          <p className="aviso" role="note">
            <strong>Antes de cobrar, confira na Trackmob se a doação já foi paga.</strong>{' '}
            Os dados de pagamento são da importação de {dadosDe ? formatarData(dadosDe) : 'data desconhecida'}
            {visao.atrasoDesde ? `; em aberto desde ${formatarData(visao.atrasoDesde)}` : ''}. Quem voltou a pagar depois de uma falha não aparece como atrasado.
          </p>
        )}

        {(podeRecuperar || podeDesistir || visao.recuperado) && (
          <section className="cartao pilha" style={{ gap: 8, borderColor: visao.recuperado ? (desistiu(visao.recuperado) ? '#8E9CA3' : '#3FA66B') : undefined }}>
            <strong>{podeRecuperar || (visao.recuperado && !desistiu(visao.recuperado)) ? 'Recuperação' : 'Doação mensal'}</strong>
            {desistiu(visao.recuperado) ? (
              <div className="linha" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  ✕ Pediu para parar de doar em {formatarData(visao.recuperado!.recuperado_em)}
                  {visao.recuperado!.observacao ? ` · ${visao.recuperado!.observacao}` : ''}. Fora das pendências e do plano de doadores.
                  {visao.situacao !== 'cancelado' ? ' Se ainda não fez, cancele a doação na Trackmob para não seguir cobrando.' : ''}
                </span>
                <button type="button" className="botao-link" onClick={desfazerRecuperado}>Desfazer</button>
              </div>
            ) : visao.recuperado ? (
              <div className="linha" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  ✓ Recuperado em {formatarData(visao.recuperado.recuperado_em)}
                  {visao.recuperado.valor_anterior != null && visao.recuperado.valor_mensal != null && Number(visao.recuperado.valor_anterior) !== Number(visao.recuperado.valor_mensal)
                    ? ` · ${formatarReais(visao.recuperado.valor_anterior)} → ${formatarReais(visao.recuperado.valor_mensal)} por mês`
                    : visao.recuperado.valor_mensal != null ? ` · ${formatarReais(visao.recuperado.valor_mensal)} por mês` : ''}
                  {visao.recuperado.observacao ? ` · ${visao.recuperado.observacao}` : ''}. Fora das pendências de cobrança
                  {visao.situacao.startsWith('atraso') ? ' até a próxima importação confirmar o pagamento' : ''}.
                </span>
                <button type="button" className="botao-link" onClick={() => setEditandoValor({
                  anterior: String(visao.recuperado!.valor_anterior ?? principal?.valor ?? ''), novo: String(visao.recuperado!.valor_mensal ?? ''),
                })}>Corrigir valor</button>
                <button type="button" className="botao-link" onClick={desfazerRecuperado}>Desfazer</button>
                {editandoValor && (
                  <div className="linha" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}>
                    <label className="campo">Valor de antes (R$)<input inputMode="decimal" value={editandoValor.anterior} onChange={(e) => setEditandoValor({ ...editandoValor, anterior: e.target.value })} style={{ width: 120 }} /></label>
                    <label className="campo">Valor agora (R$)<input inputMode="decimal" value={editandoValor.novo} onChange={(e) => setEditandoValor({ ...editandoValor, novo: e.target.value })} style={{ width: 120 }} /></label>
                    <button type="button" className="botao pequeno" onClick={salvarValores}>Salvar</button>
                    <button type="button" className="botao secundario pequeno" onClick={() => setEditandoValor(null)}>Cancelar</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <span className="pequeno suave">
                  {!podeRecuperar
                    ? 'Se o doador pedir para parar de doar, marque aqui: ele sai do plano de doadores e das fileiras.'
                    : pagouDepois
                    ? `Voltou a pagar depois da cobrança de ${formatarData(visao.ultimaCobranca!.slice(0, 10))}. Confirme para contar como recuperado.`
                    : 'Quando a abordagem terminar e o doador voltar a doar, marque aqui: ele sai das fileiras de atraso e entra na conta de recuperados.'}
                </span>
                <div className="linha" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <input aria-label="Observação" placeholder={podeRecuperar ? 'Observação (opcional): ex.: atualizou o cartão' : 'Motivo (opcional)'} value={obsRecuperacao}
                    onChange={(e) => setObsRecuperacao(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
                  {podeRecuperar && (
                    <label className="campo" title="Se voltou com outro valor, coloque o novo">
                      Valor mensal ao voltar (R$)
                      <input inputMode="decimal" value={valorNovo} onChange={(e) => setValorNovo(e.target.value)} style={{ width: 130 }} />
                    </label>
                  )}
                  {podeRecuperar && <button type="button" className="botao" onClick={() => marcarRecuperado('recuperado')}>Voltou a doar: marcar como recuperado</button>}
                  <button type="button" className="botao secundario" onClick={() => marcarRecuperado('desistiu')}>Pediu para parar de doar</button>
                </div>
              </>
            )}
          </section>
        )}

        {visao.situacao === 'sem_doacao' && (
          <p className="aviso" role="note">
            Sem doação concluída: a pessoa se cadastrou na página de doação mas não concluiu (ou deixou um Pix ou boleto sem pagar).
            Não entra no plano de doadores nem nos aniversariantes; aparece em “Cadastros para converter” se aceitou contato.
            Quando não for mais convidar, marque “Resolvido” no acompanhamento.
          </p>
        )}

        <section className="grade-2 pequeno">
          <div className="cartao pilha" style={{ gap: 6 }}>
            <strong>Doação</strong>
            <span>Desde {formatarData(principal?.criada_em ?? null)}</span>
            <span>Última cobrança paga: {formatarData(principal?.ultima_cobranca_paga ?? ultimaPagaNasCobrancas)}</span>
            {visao.falha && <span>Motivo da falha: {visao.falha.mensagem ?? 'não informado'}</span>}
            {principal?.campanha && <span>Campanha: {principal.campanha}</span>}
            {doador.nascimento_dia && doador.nascimento_mes && (
              <span>Aniversário: {String(doador.nascimento_dia).padStart(2, '0')}/{String(doador.nascimento_mes).padStart(2, '0')}</span>
            )}
          </div>
          <div className="cartao pilha" style={{ gap: 6 }}>
            <strong>Plano de doadores</strong>
            {visao.plano ? (
              <>
                <span>Etapa: {visao.plano.atual?.nome ?? 'Antes das boas-vindas'}</span>
                <span>Próximo: {visao.plano.proximo.nome} em {formatarData(visao.plano.dataProximo)}</span>
                {visao.marco && (
                  <span className="linha" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span>
                      Lembrete: <strong>{visao.marco.checkpoint.nome}</strong>{' '}
                      {visao.marco.dias < 0 ? `atrasado há ${-visao.marco.dias} ${visao.marco.dias === -1 ? 'dia' : 'dias'}` : visao.marco.dias === 0 ? 'hoje' : `em ${formatarData(visao.marco.data)}`}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="suave">{visao.situacao === 'pontual' ? 'Trilha dos pontuais' : 'Fora do plano'}</span>
            )}
            <span className="linha" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span>Celular: {formatarCelular(doador.celular) ?? <span className="suave">não informado</span>}</span>
              {doador.celular?.trim() && <button type="button" className="botao secundario pequeno" onClick={copiarCelular}>Copiar</button>}
              {doador.celular?.trim() && !doador.aceita_whatsapp && <span className="suave pequeno">(não aceitou WhatsApp)</span>}
            </span>
            <span className="suave">Aceita: {aceites.filter((a) => a.sim).map((a) => a.nome).join(', ') || 'nenhum canal'}</span>
            <span className="linha" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="linha" style={{ gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={ita.iteano} onChange={(e) => salvarIta({ ...ita, iteano: e.target.checked })} />
                Do ITA
              </label>
              {ita.iteano && (
                <>
                  <input aria-label="Turma do ITA" placeholder="Turma (ex.: T25)" value={ita.turma_ita} style={{ width: 120 }}
                    onChange={(e) => setIta({ ...ita, turma_ita: e.target.value })} onBlur={() => salvarIta(ita)} />
                  <input aria-label="Apelido no ITA" placeholder="Apelido" value={ita.apelido_ita} style={{ width: 160 }}
                    onChange={(e) => setIta({ ...ita, apelido_ita: e.target.value })} onBlur={() => salvarIta(ita)} />
                </>
              )}
            </span>
            <span className="suave">
              {doador.tem_endereco === true ? 'Endereço fornecido' : doador.tem_endereco === false ? 'Sem endereço' : 'Endereço: importe o relatório de doadores'}
            </span>
          </div>
        </section>

        <section className="pilha">
          <h3>Mensagem</h3>
          <label className="campo">
            Modelo
            <select value={chaveModelo} onChange={(e) => trocarMensagem({ chave: e.target.value })}>
              {modelos.map((m) => <option key={m.chave} value={m.chave}>{m.titulo}</option>)}
            </select>
          </label>
          {temVersoes && (
            <div className="linha" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="campo">
                Versão
                <select value={versao} onChange={(e) => trocarMensagem({ versao: Number(e.target.value) as Versao })}>
                  {TODAS_VERSOES.map((n) => {
                    const cheia = versaoPreenchida(modeloAtual?.variacoes, n);
                    return <option key={n} value={n} disabled={!cheia}>{rotuloVersao(n)}{cheia ? '' : ' (em branco)'}</option>;
                  })}
                </select>
              </label>
              {pedeTratamento && <div className="campo">
                Tratamento
                <div className="linha" style={{ gap: 6 }} role="group" aria-label="Tratamento">
                  {TRATAMENTOS.map(([t, nome]) => (
                    <button key={t} type="button" className={`botao pequeno ${tratamento === t ? '' : 'secundario'}`} aria-pressed={tratamento === t} onClick={() => escolherTratamento(t)}>
                      {nome}
                    </button>
                  ))}
                </div>
              </div>}
            </div>
          )}
          {pedeTratamento && !tratamento && <p className="aviso pequeno">Escolha masculino ou feminino para liberar o envio (fica salvo para os próximos contatos).</p>}
          <p className="suave pequeno" style={{ margin: 0 }}>
            Envie uma parte de cada vez, na ordem. Cada botão abre a conversa com o texto daquela parte; edite à vontade antes.
          </p>
          <ol className="partes-msg">
            {partes.map((p, i) => (
              <li key={`${chaveModelo}-${i}`} className={enviadas[i] ? 'enviada' : i === proxima ? 'proxima' : undefined}>
                <div className="linha" style={{ justifyContent: 'space-between' }}>
                  <strong className="pequeno">{i + 1}. {p.rotulo}</strong>
                  {enviadas[i] && <span className="pequeno">✓ enviada</span>}
                </div>
                <textarea
                  aria-label={`Parte ${i + 1}: ${p.rotulo}`}
                  value={p.texto}
                  rows={Math.min(6, Math.max(2, Math.ceil(p.texto.length / 70)))}
                  onChange={(e) => setPartes((ps) => ps.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                />
                <div className="linha">
                  <button type="button" className="botao whatsapp pequeno" onClick={() => enviarParte(i)} disabled={!podeWhatsApp}>
                    {enviadas[i] ? 'Enviar de novo' : 'Enviar no WhatsApp'}
                  </button>
                  <button type="button" className="botao secundario pequeno" onClick={() => copiarParte(i)}>Copiar</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="linha">
            <button type="button" className="botao secundario" onClick={baixarContato}>Baixar contato</button>
          </div>
          {!doador.aceita_whatsapp && podeWhatsApp && <p className="aviso pequeno">Este doador não marcou que aceita WhatsApp. O envio está liberado pela diretoria; use com cuidado.</p>}
          {!podeWhatsApp && <p className="suave pequeno">Celular ausente ou inválido.</p>}
        </section>

        <section className="pilha">
          <h3>Acompanhamento</h3>
          <div className="grade-2">
            <label className="campo">
              Situação da conversa
              <select value={rel.status_conversa} onChange={(e) => setRel({ ...rel, status_conversa: e.target.value })}>
                {STATUS_CONVERSA.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            <label className="campo">
              Próximo contato
              <input type="date" value={rel.proximo_contato} onChange={(e) => setRel({ ...rel, proximo_contato: e.target.value })} />
            </label>
          </div>
          <label className="campo">
            Anotações
            <textarea value={rel.anotacoes} onChange={(e) => setRel({ ...rel, anotacoes: e.target.value })} />
          </label>
          <button type="button" className="botao" style={{ alignSelf: 'flex-start' }} onClick={salvarRelacionamento}>Salvar acompanhamento</button>
        </section>

        {visao.brindeDevido && (
          <section className="pilha">
            <h3>Brinde: {visao.brindeDevido.nome}</h3>
            <label className="campo">
              Status
              <select value={visao.brinde?.status ?? 'pendente'} onChange={(e) => salvarBrinde(e.target.value)}>
                {STATUS_BRINDE.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            {!doador.aceita_cartas && <p className="suave pequeno">Não aceitou cartas: não enviar brinde pelo correio.</p>}
            {doador.aceita_cartas && (
              <p className="suave pequeno">
                {doador.tem_endereco ? 'Endereço fornecido na Trackmob: consulte lá para o envio.' : 'Sem endereço na Trackmob: combine a entrega com o doador.'}
              </p>
            )}
          </section>
        )}

        {visao.situacao === 'pontual' && (
          <section className="pilha">
            <h3>Trilha dos pontuais {visao.valorAlto && <span className="etiqueta atraso_1">Valor alto: contato pessoal</span>}</h3>
            <div className="linha">
              <label className="campo" style={{ flex: 1 }}>
                Status
                <select value={visao.pontual?.status ?? 'agradecido'} onChange={(e) => salvarPontual(e.target.value)}>
                  {STATUS_PONTUAL.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </label>
              <button type="button" className="botao secundario" style={{ alignSelf: 'flex-end' }} onClick={() => salvarPontual('convidado', true)}>
                Registrar convite ({visao.pontual?.convites ?? 0})
              </button>
            </div>
          </section>
        )}

        </>}

        {aba === 'contatos' && <>
        <section className="pilha">
          <h3>Contatos registrados</h3>
          <p className="pequeno suave" style={{ margin: 0 }}>Corrija ou exclua registros errados (ex.: clique repetido no WhatsApp). Só quem registrou, ou a diretoria, pode alterar.</p>
          {historico.length > 0 && (
            <div className="chips" role="group" aria-label="Filtrar por tipo de contato">
              <button type="button" className={`chip-filtro${filtro === 'todos' ? ' ativo' : ''}`} onClick={() => setFiltro('todos')}>
                Todos ({historico.length})
              </button>
              {MOTIVOS_CONTATO.filter((m) => historico.some((h) => h.motivo === m.valor)).map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  className={`chip-filtro${filtro === m.valor ? ' ativo' : ''}`}
                  style={{ '--cor-chip': m.cor } as React.CSSProperties}
                  onClick={() => setFiltro(m.valor)}
                >
                  {m.rotulo} ({historico.filter((h) => h.motivo === m.valor).length})
                </button>
              ))}
            </div>
          )}
          {historico.length === 0 ? (
            <p className="vazio">Nenhum contato registrado.</p>
          ) : (
            <ul className="lista-simples">
              {historico.filter((h) => filtro === 'todos' || h.motivo === filtro).map((h) => {
                const m = MOTIVOS_CONTATO.find((x) => x.valor === h.motivo);
                const modelo = h.modelo ? modelos.find((x) => x.chave === h.modelo)?.titulo : null;
                return (
                  <li key={h.id} className="contato-registrado">
                    {editando?.id === h.id ? (
                      <div className="pilha" style={{ gap: 8 }}>
                        <div className="grade-2">
                          <label className="campo">Data<input type="date" value={editando.data} onChange={(e) => setEditando({ ...editando, data: e.target.value })} /></label>
                          <label className="campo">Tipo de contato
                            <select value={editando.motivo} onChange={(e) => setEditando({ ...editando, motivo: e.target.value })}>
                              {MOTIVOS_CONTATO.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
                            </select>
                          </label>
                          <label className="campo">Canal
                            <select value={editando.canal} onChange={(e) => setEditando({ ...editando, canal: e.target.value })}>
                              {CANAIS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                            </select>
                          </label>
                          <label className="campo">Resultado<input value={editando.resultado} onChange={(e) => setEditando({ ...editando, resultado: e.target.value })} /></label>
                        </div>
                        <label className="campo">Nota<textarea value={editando.nota} onChange={(e) => setEditando({ ...editando, nota: e.target.value })} /></label>
                        <div className="linha" style={{ gap: 8 }}>
                          <button type="button" className="botao pequeno" onClick={salvarEdicao}>Salvar</button>
                          <button type="button" className="botao secundario pequeno" onClick={() => setEditando(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="linha" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                          <div style={{ flex: 1 }}>
                            <span className="selo-mini" style={{ '--cor-selo': m?.cor ?? '#8E9CA3' } as React.CSSProperties}>{m?.rotulo ?? h.motivo}</span>{' '}
                            <strong>{new Date(h.criado_em).toLocaleDateString('pt-BR')}</strong> · {CANAIS.find(([v]) => v === h.canal)?.[1] ?? h.canal}{modelo ? ` · ${modelo}` : ''}{h.versao ? ` (${rotuloVersao(h.versao as Versao).toLowerCase()})` : ''} · {h.membro}
                            {h.resultado && <> · {h.resultado}</>}
                          </div>
                          <div className="linha" style={{ gap: 6, flexShrink: 0 }}>
                            {apagando === h.id ? (
                              <>
                                <button type="button" className="botao pequeno perigo" onClick={() => apagarContato(h.id)}>Confirmar exclusão</button>
                                <button type="button" className="botao secundario pequeno" onClick={() => setApagando(null)}>Cancelar</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="botao secundario pequeno" onClick={() => { setApagando(null); setEditando({ id: h.id, canal: h.canal, motivo: h.motivo, resultado: h.resultado ?? '', nota: h.nota ?? '', data: h.criado_em.slice(0, 10) }); }}>Editar</button>
                                <button type="button" className="botao secundario pequeno" onClick={() => { setEditando(null); setApagando(h.id); }}>Excluir</button>
                              </>
                            )}
                          </div>
                        </div>
                        {h.nota && <div className="suave nota-contato">{h.nota}</div>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="pilha">
          <h3>Registrar contato</h3>
          <div className="grade-2">
            <label className="campo">
              Canal
              <select value={registro.canal} onChange={(e) => setRegistro({ ...registro, canal: e.target.value })}>
                {CANAIS.map(([v, n, campo]) => (
                  <option key={v} value={v}>{n}{campo && doador[campo] !== true ? ' (não aceitou)' : ''}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              Tipo de contato
              <select value={registro.motivo} onChange={(e) => setRegistro({ ...registro, motivo: e.target.value as MotivoContato })}>
                {MOTIVOS_CONTATO.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
              </select>
            </label>
            <label className="campo">
              Resultado
              <input value={registro.resultado} onChange={(e) => setRegistro({ ...registro, resultado: e.target.value })} placeholder="Ex.: vai atualizar o cartão" />
            </label>
          </div>
          <label className="campo">
            Nota
            <textarea value={registro.nota} onChange={(e) => setRegistro({ ...registro, nota: e.target.value })} />
          </label>
          <button type="button" className="botao secundario" style={{ alignSelf: 'flex-start' }} onClick={registrarContato}>Registrar contato</button>
        </section>

        </>}
      </div>
    </dialog>
  );
}
