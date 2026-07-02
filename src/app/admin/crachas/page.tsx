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

// Ajuste Fino Padrão de Fábrica (Colacril / Pimaco 6180)
const MARGIN_TOP = 8.8; // mm (Distância exata do topo)
const MARGIN_LEFT = 7.2; // mm (Distância exata da esquerda)
const GAP_X = 2.5; // mm (Espaço horizontal entre as etiquetas)
const GAP_Y = 0; // mm (Espaço vertical)

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

      // ==========================================
      // ORDENAÇÃO CUSTOMIZADA POR PRIORIDADE DA IGREJA
      // ==========================================
      const ordemIgrejas: Record<string, number> = {
        'PIPR': 1,
        '2IPBV': 2,
        '3IPBV': 3,
        '4IPBV': 4,
        '5IPBV': 5,
        '6IPBV': 6
      };

      listaCrachas.sort((a, b) => {
        const igrejaA = a.igreja.trim().toUpperCase();
        const igrejaB = b.igreja.trim().toUpperCase();

        const pesoA = ordemIgrejas[igrejaA] || 99;
        const pesoB = ordemIgrejas[igrejaB] || 99;

        if (pesoA !== pesoB) {
          return pesoA - pesoB;
        }

        if (pesoA === 99 && igrejaA !== igrejaB) {
          return igrejaA.localeCompare(igrejaB, 'pt-BR');
        }

        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

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
    <div className="min-h-screen bg-gray-200 p-6 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto mb-6 flex justify-between items-center bg-white rounded-xl shadow p-6 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-black">Gerador de Etiquetas (Colacril)</h1>
          <p className="text-gray-600">
            Total: <strong>{crachas.length}</strong> | Folhas: <strong>{paginas.length}</strong> (33 por folha)
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Printer size={20} />
          Imprimir Folhas
        </button>
      </div>

      {paginas.map((pagina, pIndex) => (
        <div
          key={pIndex}
          className="folha"
          style={{
            width: '210mm',
            height: '297mm',
            margin: '0 auto',
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
                  // PADDING AJUSTADO: Empurra 4mm da esquerda para o QR Code não ficar na beirada
                  padding: '2mm 2mm 2mm 4mm', 
                  display: 'flex',
                  alignItems: 'center',
                  background: '#fff',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  overflow: 'hidden',
                }}
              >
                {/* QR Code */}
                <div
                  style={{
                    width: '17mm',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <QRCodeSVG
                    value={`${c.tipo}|${c.id}`}
                    size={52} 
                    level="L"
                    includeMargin={false}
                  />
                </div>

                {/* Informações (Nome e Igreja) */}
                <div
                  style={{
                    flex: 1,
                    paddingLeft: '3mm',
                    color: '#000',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {/* Título do Evento (Substitui a Tira Preta) */}
                  <div
                    style={{
                      fontSize: '6px',
                      fontWeight: 800,
                      color: '#666',
                      marginBottom: '1mm',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Fé Reformada 2026
                  </div>

                  {/* Nome do Participante (MAX 2 LINHAS) */}
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: '9.5px',
                      lineHeight: '10.5px',
                      textTransform: 'uppercase',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {c.nome}
                  </div>

                  {/* Nome da Igreja (MAX 2 LINHAS, FONTE MAIOR) */}
                  <div
                    style={{
                      marginTop: '1.5mm',
                      fontSize: '8px',
                      lineHeight: '9px',
                      color: '#333',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {c.igreja}
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
          margin: 0 !important;
        }

        @media print {
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print\\:hidden {
            display: none !important;
          }

          .folha {
            margin: 0 !important;
            box-shadow: none !important;
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