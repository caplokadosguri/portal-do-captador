'use client';

import { useEffect, useRef, useState } from 'react';
import type { Modelo, VisaoDoador } from '@/lib/carteira';
import { formatarData, formatarReais, linkWhatsApp, preencherModelo, vcard } from '@/lib/contato';
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

interface ContatoRegistrado { id: string; membro: string; canal: string; motivo: string; resultado: string | null; nota: string | null; criado_em: string }

function modeloSugerido(v: VisaoDoador): string {
  if (v.falha?.motivo === 'atualizar_cartao') return 'cartao_vencido';
  if (v.situacao.startsWith('atraso')) return 'cobranca';
  if (v.situacao === 'pontual') return 'pontual_convite';
  return 'checkpoint';
}
function motivoDoContexto(v: VisaoDoador): string {
  if (v.situacao.startsWith('atraso')) return 'cobranca';
  if (v.situacao === 'pontual') return 'pontual';
  return 'plano';
}

export default function FichaDoador({ visao, modelos, aoFechar, aoSalvar }: {
  visao: VisaoDoador;
  modelos: Modelo[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { doador, principal } = visao;
  const [chaveModelo, setChaveModelo] = useState(modeloSugerido(visao));
  const preencher = (chave: string) => {
    const m = modelos.find((x) => x.chave === chave);
    return m ? preencherModelo(m.texto, { nome: doador.nome, valor: principal?.valor, meses: visao.plano?.mesesDeDoacao }) : '';
  };
  const [mensagem, setMensagem] = useState(() => preencher(chaveModelo));
  const [rel, setRel] = useState({
    status_conversa: visao.rel?.status_conversa ?? '',
    proximo_contato: visao.rel?.proximo_contato ?? '',
    anotacoes: visao.rel?.anotacoes ?? '',
  });
  const [registro, setRegistro] = useState({ canal: 'ligacao', resultado: '', nota: '' });
  const [historico, setHistorico] = useState<ContatoRegistrado[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    const sb = supabase();
    sb.from('acessos').insert({ doador_id: doador.id, acao: 'abriu_ficha' }).then(() => undefined);
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doador.id]);

  async function carregarHistorico() {
    const { data } = await supabase()
      .from('contatos').select('*').eq('doador_id', doador.id).order('criado_em', { ascending: false }).limit(20);
    setHistorico((data as ContatoRegistrado[]) ?? []);
  }

  function resultado(error: { message: string } | null, ok: string) {
    setAviso(error ? { tipo: 'erro', texto: `Não salvou: ${error.message}` } : { tipo: 'ok', texto: ok });
    if (!error) aoSalvar();
  }

  const link = doador.aceita_whatsapp ? linkWhatsApp(doador.celular, mensagem) : null;

  async function abrirWhatsApp() {
    if (!link) return;
    window.open(link, '_blank', 'noopener');
    const { error } = await supabase().from('contatos').insert({
      doador_id: doador.id, canal: 'whatsapp', motivo: motivoDoContexto(visao), nota: mensagem.slice(0, 500),
    });
    resultado(error, 'Contato por WhatsApp registrado.');
    carregarHistorico();
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
      doador_id: doador.id, canal: registro.canal, motivo: motivoDoContexto(visao),
      resultado: registro.resultado || null, nota: registro.nota || null,
    });
    resultado(error, 'Contato registrado.');
    if (!error) setRegistro({ ...registro, resultado: '', nota: '' });
    carregarHistorico();
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
        <button type="button" className="botao secundario" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => ref.current?.close()} aria-label="Fechar ficha">
          Fechar
        </button>
      </div>

      <div className="ficha-corpo">
        {aviso && <p className={`aviso ${aviso.tipo}`} role="status">{aviso.texto}</p>}

        <section className="grade-2 pequeno">
          <div className="cartao pilha" style={{ gap: 6 }}>
            <strong>Doação</strong>
            <span>Desde {formatarData(principal?.criada_em ?? null)}</span>
            <span>Última cobrança paga: {formatarData(principal?.ultima_cobranca_paga ?? ultimaPagaNasCobrancas)}</span>
            {visao.falha && <span>Motivo da falha: {visao.falha.mensagem ?? 'não informado'}</span>}
            {principal?.campanha && <span>Campanha: {principal.campanha}</span>}
          </div>
          <div className="cartao pilha" style={{ gap: 6 }}>
            <strong>Plano de doadores</strong>
            {visao.plano ? (
              <>
                <span>Etapa: {visao.plano.atual?.nome ?? 'Antes das boas-vindas'}</span>
                <span>Próximo: {visao.plano.proximo.nome} em {formatarData(visao.plano.dataProximo)}</span>
              </>
            ) : (
              <span className="suave">{visao.situacao === 'pontual' ? 'Trilha dos pontuais' : 'Fora do plano'}</span>
            )}
            <span className="suave">Aceita: {aceites.filter((a) => a.sim).map((a) => a.nome).join(', ') || 'nenhum canal'}</span>
          </div>
        </section>

        <section className="pilha">
          <h3>Mensagem</h3>
          <label className="campo">
            Modelo
            <select value={chaveModelo} onChange={(e) => { setChaveModelo(e.target.value); setMensagem(preencher(e.target.value)); }}>
              {modelos.map((m) => <option key={m.chave} value={m.chave}>{m.titulo}</option>)}
            </select>
          </label>
          <label className="campo">
            Texto (edite antes de enviar)
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </label>
          <div className="linha">
            <button type="button" className="botao whatsapp" onClick={abrirWhatsApp} disabled={!link}>Abrir no WhatsApp</button>
            <button type="button" className="botao secundario" onClick={baixarContato}>Baixar contato</button>
          </div>
          {!doador.aceita_whatsapp && <p className="suave pequeno">Este doador não aceitou contato por WhatsApp.</p>}
          {doador.aceita_whatsapp && !link && <p className="suave pequeno">Celular ausente ou inválido.</p>}
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

        <section className="pilha">
          <h3>Registrar outro contato</h3>
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

        <section className="pilha">
          <h3>Histórico</h3>
          {historico.length === 0 ? (
            <p className="vazio">Nenhum contato registrado.</p>
          ) : (
            <ul className="lista-simples">
              {historico.map((h) => (
                <li key={h.id}>
                  <strong>{new Date(h.criado_em).toLocaleDateString('pt-BR')}</strong> · {h.canal} · {h.motivo} · {h.membro}
                  {h.resultado && <> · {h.resultado}</>}
                  {h.nota && <div className="suave">{h.nota}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
