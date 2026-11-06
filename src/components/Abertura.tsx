'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeometriaVoo } from './aberturaGeometria';
import { VOO_DURACAO_S, VOO_INICIO_S } from './aberturaGeometria';
import { AVIAO, LETRA_C, LETRA_D, LETRA_S } from './logoPaths';
import './abertura.css';

// O voo usa animação nativa do SVG: o avião segue a curva de verdade e é redesenhado em vetor
// a cada quadro. Fase 1: volta pela tela e sai por baixo. Some por um instante. Fase 2: volta
// por baixo, no meio, subindo na vertical sem mudar de tamanho; a tela nova aparece atrás das asas.
const VOO = { begin: `${VOO_INICIO_S}s`, dur: `${VOO_DURACAO_S}s`, fill: 'freeze' } as const;

export default function Abertura({ geometria }: { geometria: GeometriaVoo }) {
  const [escala, setEscala] = useState(1);
  const voo = useRef<SVGSVGElement>(null);

  useEffect(() => {
    voo.current?.setCurrentTime(0); // alinha o relógio do voo com as animações CSS
    const ajustar = () => setEscala(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  return (
    <>
      <div className="ab-fundo" aria-hidden="true">
        <div className="ab-palco" style={{ transform: `translate(-50%, -50%) scale(${escala})` }}>
          <div className="ab-lockup">
            <svg viewBox="0 0 2810 650">
              <g className="ab-letras" fill="#3192B3" fillRule="evenodd">
                <path d={LETRA_C} />
                <path d={LETRA_S} />
                <path d={LETRA_D} />
              </g>
              <text
                className="ab-flix"
                x="1885"
                y="540"
                fill="#F9B341"
                style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 672, fontWeight: 400 }}
              >
                FLIX
              </text>
            </svg>
          </div>
        </div>
      </div>
      <div className="ab-aviao-camada" aria-hidden="true">
        <svg ref={voo} viewBox={geometria.viewBox}>
          <g transform="translate(401.2 387.7)">
            <g>
              <animateMotion
                path={geometria.caminho}
                rotate="auto"
                calcMode="spline"
                keyPoints={geometria.keyPoints}
                keyTimes={geometria.keyTimes}
                keySplines={geometria.keySplines}
                {...VOO}
              />
              <g>
                <animateTransform attributeName="transform" type="scale" values={geometria.escalas} keyTimes={geometria.tempos} {...VOO} />
                <g>
                  <animateTransform attributeName="transform" type="rotate" values="90;90" keyTimes="0;1" {...VOO} />
                  <path d={AVIAO} fill="#F9B341" transform="scale(0.37011) translate(-760 -400)" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
