'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer } from 'lucide-react';

// ===== CONFIGURAÇÃO DA FOLHA COLACRIL A4256 =====
// 33 etiquetas: 3 colunas x 11 linhas, cada etiqueta 63,5mm x 25,4mm
const COLS = 3;
const ROWS = 11;
const LABELS_PER_PAGE = COLS * ROWS; // 33

const LABEL_WIDTH = 63.5; // mm
const LABEL_HEIGHT = 25.4; // mm

// Ajuste fino (mm) — faça 1 teste de impressão em papel comum, sobreponha
// na folha de etiqueta real contra a luz e corrija estes valores se precisar.
const MARGIN_TOP = 13.5; // distância do topo da folha até a 1ª linha
const MARGIN_LEFT = 7.2; // distância da esquerda da folha até a 1ª coluna
const GAP_X = 2.5; // espaço horizontal entre colunas
const GAP_Y = 0; // espaço vertical entre linhas (geralmente 0 nessa folha)

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function CrachasPage() {
  const [crachas, setCrachas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarCrachas() {
      const { data, error } = await supabase
        .from('inscricoes')
        .select('*, participantes(*)')
        .eq('status_pagamento', 'confirmado');

      if (error) {
        alert('Erro ao carregar dados.');
        setLoading(false);
        return;
      }

      const listaCrachas: any[] = [];

      data?.forEach((inscricao: any) => {
        const igrejaNome = inscricao.igreja === 'Outras'
          ? inscricao.outra_igreja
          : inscricao.igreja;

        listaCrachas.push({
          id: inscricao.id,
          tipo: 'titular',
          nome: inscricao.nome_titular,
          igreja: igrejaNome,
        });

        inscricao.participantes?.forEach((p: any) => {
          listaCrachas.push({
            id: p.id,
            tipo: 'acompanhante',
            nome: p.nome_completo,
            igreja: igrejaNome,
          });
        });
      });

      listaCrachas.sort((a, b) => a.nome.localeCompare(b.nome));
      setCrachas(listaCrachas);
      setLoading(false);
    }

    carregarCrachas();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-black" size={42} />
      </div>
    );
  }

  const paginas = chunk(crachas, LABELS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-200 p-6">
      <div className="max-w-6xl mx-auto mb-6 flex justify-between items-center bg-white rounded-xl shadow p-6 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-black">Gerador de Etiquetas</h1>
          <p className="text-gray-600">
            Total: <strong>{crachas.length}</strong> | Folhas: <strong>{paginas.length}</strong> (33 por folha)
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-xl"
        >
          <Printer size={20} />
          Imprimir
        </button>
      </div>

      {paginas.map((pagina, pIndex) => (
        <div
          key={pIndex}
          className="folha"
          style={{
            width: '210mm',
            height: '297mm',
            margin: '0 auto 8mm auto',
            background: '#fff',
            position: 'relative',
            boxSizing: 'border-box',
            paddingTop: `${MARGIN_TOP}mm`,
            paddingLeft: `${MARGIN_LEFT}mm`,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${LABEL_WIDTH}mm)`,
              gridTemplateRows: `repeat(${ROWS}, ${LABEL_HEIGHT}mm)`,
              columnGap: `${GAP_X}mm`,
              rowGap: `${GAP_Y}mm`,
            }}
          >
            {pagina.map((c, index) => (
              <div
                key={index}
                style={{
                  width: `${LABEL_WIDTH}mm`,
                  height: `${LABEL_HEIGHT}mm`,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  background: '#fff',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    background: '#000',
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '7px',
                    padding: '1.2mm',
                  }}
                >
                  FÉ REFORMADA 2026
                </div>

                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1.5mm',
                  }}
                >
                  <div
                    style={{
                      width: '20mm',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <QRCodeSVG
                      value={`${c.tipo}|${c.id}`}
                      size={70}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div
                    style={{
                      flex: 1,
                      paddingLeft: '2mm',
                      color: '#000',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: '11px',
                        lineHeight: '12px',
                        textTransform: 'uppercase',
                        wordBreak: 'break-word',
                      }}
                    >
                      {c.nome}
                    </div>

                    <div
                      style={{
                        marginTop: '2mm',
                        fontSize: '8px',
                        lineHeight: '9px',
                        color: '#444',
                        wordBreak: 'break-word',
                      }}
                    >
                      {c.igreja}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0;
            padding: 0;
          }

          .print\\:hidden {
            display: none !important;
          }

          .folha {
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
          }

          .folha:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}