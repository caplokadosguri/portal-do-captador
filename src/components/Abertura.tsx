'use client';

import { useEffect, useRef, useState } from 'react';
import { AVIAO, LETRA_C, LETRA_D, LETRA_S, VOO_CAMINHO, VOO_ESCALAS, VOO_TEMPOS } from './logoPaths';
import './abertura.css';

export const DURACAO_ABERTURA_MS = 5600;

// O voo usa animação nativa do SVG: o avião segue uma curva de verdade e é redesenhado
// em vetor a cada quadro, então continua nítido mesmo quando cobre a tela.
const VOO = { begin: '1.9s', dur: '2.9s', fill: 'freeze' } as const;

/** Abertura CASDflix: o avião voa em curvas, se aproxima até cobrir a tela e revela os perfis. */
export default function Abertura() {
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
                style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 640, fontWeight: 400, letterSpacing: -8 }}
              >
                flix
              </text>
            </svg>
          </div>
          <div className="ab-aviao-entra">
            <svg ref={voo} viewBox="0 0 1280 720">
              <g transform="translate(401.2 387.7)">
                <g>
                  <animateMotion
                    path={VOO_CAMINHO}
                    rotate="auto"
                    calcMode="spline"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    keySplines="0.42 0 0.75 1"
                    {...VOO}
                  />
                  <g>
                    <animateTransform attributeName="transform" type="scale" values={VOO_ESCALAS} keyTimes={VOO_TEMPOS} {...VOO} />
                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="90;90;-12.6"
                        keyTimes="0;0.72;1"
                        calcMode="spline"
                        keySplines="0 0 1 1;0.45 0 0.55 1"
                        {...VOO}
                      />
                      <path d={AVIAO} fill="#F9B341" transform="scale(0.37011) translate(-760 -400)" />
                    </g>
                  </g>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="ab-cobre" aria-hidden="true" />
    </>
  );
}
