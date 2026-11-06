// Geometria do voo da abertura, ajustada ao tamanho da tela.
// O palco de referência tem 1280x720 e é escalado para caber ("contain"). A fase 2 (o avião
// voltando por baixo e subindo pelo meio, sem mudar de tamanho) precisa começar e terminar
// fora da área visível, que muda conforme a proporção da tela; por isso é calculada aqui.

import { VOO_FASE1, VOO_FASE1_COMPRIMENTO, VOO_FASE1_ESCALAS, VOO_FASE1_TEMPOS } from './vooFase1';

export const VOO_INICIO_S = 1.9;
export const VOO_DURACAO_S = 3.2;
const T1 = 0.6; // fim da volta (avião já fora da tela, embaixo)
const T2 = 0.66; // volta por baixo, já na vertical
const PARTIDA = { x: 401.2, y: 387.7 }; // ponto do avião sobre o "A" do logo
const K = 0.37011; // unidades do desenho do avião -> unidades do palco
const NARIZ = (400 - 8) * K; // do ponto de referência até o bico
const CAUDA = (642 - 400) * K; // até a ponta da cauda
const BASE_ASAS = (540 - 400) * K; // até a linha da base das asas
const DESLOC_CENTRO = (760 - 692) * K; // para centralizar o avião na horizontal
const LARGURA_AVIAO = 474 * K;
const SAIDA_FASE1 = { x: 1045, y: 960 }; // onde a volta termina, descendo
const ESCALA_FIM_FASE1 = 1.6;

export interface GeometriaVoo {
  viewBox: string;
  caminho: string;
  keyPoints: string;
  keyTimes: string;
  keySplines: string;
  escalas: string;
  tempos: string;
  cortina: { inicioS: number; duracaoS: number };
  duracaoTotalMs: number;
}

export function geometriaVoo(largura: number, altura: number): GeometriaVoo {
  // Área visível em unidades do palco (mesma escala do logo).
  const w = Math.max(1280, (720 * largura) / altura);
  const h = Math.max(720, (1280 * altura) / largura);
  const topo = 360 - h / 2;
  const fundo = 360 + h / 2;

  // Tamanho constante na subida: as asas precisam cobrir toda a largura visível.
  const escala = Math.max(7.5, (w * 1.03) / LARGURA_AVIAO);
  const x = 640 + DESLOC_CENTRO * escala;
  const y0 = fundo + NARIZ * escala + 4; // bico logo abaixo da tela
  const y1 = topo - CAUDA * escala - 4; // cauda logo acima da tela
  const l2 = y0 - y1;

  // Em telas altas (celular), a volta precisa descer mais para sair de fato da tela.
  const ySaida = Math.max(SAIDA_FASE1.y, fundo + (CAUDA + 30) * ESCALA_FIM_FASE1);
  const extra = ySaida - SAIDA_FASE1.y;
  const fase1 = extra > 0 ? `${VOO_FASE1} L${(SAIDA_FASE1.x - PARTIDA.x).toFixed(1)} ${(ySaida - PARTIDA.y).toFixed(1)}` : VOO_FASE1;
  const l1 = VOO_FASE1_COMPRIMENTO + extra;
  const p = l1 / (l1 + l2);

  const caminho = `${fase1} M${(x - PARTIDA.x).toFixed(1)} ${(y0 - PARTIDA.y).toFixed(1)} L${(x - PARTIDA.x).toFixed(1)} ${(y1 - PARTIDA.y).toFixed(1)}`;

  // Cortina: a tela de perfis aparece logo abaixo da base das asas, subindo junto com o avião.
  const inicioFase2 = VOO_INICIO_S + VOO_DURACAO_S * T2;
  const duracaoFase2 = VOO_DURACAO_S * (1 - T2);
  const quando = (yBase: number) => inicioFase2 + ((y0 - (yBase - BASE_ASAS * escala)) / l2) * duracaoFase2;
  const cortinaInicio = quando(fundo);
  const cortinaFim = quando(topo);

  return {
    viewBox: `${640 - w / 2} ${topo} ${w} ${h}`,
    caminho,
    keyPoints: `0;${p.toFixed(5)};${p.toFixed(5)};1`,
    keyTimes: `0;${T1};${T2};1`,
    keySplines: '0.2 0 1 1;0 0 1 1;0 0 1 1',
    escalas: `${VOO_FASE1_ESCALAS};${escala.toFixed(3)};${escala.toFixed(3)}`,
    tempos: `${VOO_FASE1_TEMPOS};${T2};1`,
    cortina: { inicioS: cortinaInicio, duracaoS: cortinaFim - cortinaInicio },
    duracaoTotalMs: Math.ceil((VOO_INICIO_S + VOO_DURACAO_S) * 1000) + 100,
  };
}
