'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer } from 'lucide-react';

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

      data?.forEach((inscricao) => {
        const igrejaNome =
          inscricao.igreja === 'Outras'
            ? inscricao.outra_igreja
            : inscricao.igreja;

        listaCrachas.push({
          id: inscricao.id,
          tipo: 'titular',
          nome: inscricao.nome_titular,
          igreja: igrejaNome,
        });

        if (inscricao.participantes?.length > 0) {
          inscricao.participantes.forEach((p: any) => {
            listaCrachas.push({
              id: p.id,
              tipo: 'acompanhante',
              nome: p.nome_completo,
              igreja: igrejaNome,
            });
          });
        }
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

  return (
    <div className="min-h-screen bg-gray-200 p-8">

      {/* Barra Superior */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-center print:hidden bg-white rounded-xl shadow p-6">

        <div>
          <h1 className="text-3xl font-black">
            Gerador de Crachás
          </h1>

          <p className="text-gray-500 mt-1">
            Total para impressão: <strong>{crachas.length}</strong> crachás.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition"
        >
          <Printer size={20} />
          Imprimir Tudo
        </button>

      </div>

      {/* Área de impressão */}
      <div
        className="mx-auto flex flex-wrap justify-center gap-3 print:gap-0"
        style={{
          maxWidth: '21cm',
        }}
      >

        {crachas.map((c, index) => (

          <div
            key={index}
            className="bg-white border border-gray-400 flex flex-col overflow-hidden"
            style={{
              width: '7.8cm',
              height: '2.8cm',
              margin: '2mm',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >

            {/* Cabeçalho */}
            <div
              className="bg-black text-white text-center font-bold uppercase"
              style={{
                fontSize: '7px',
                padding: '1.5px',
                letterSpacing: '1px',
              }}
            >
              Fé Reformada 2026
            </div>

            {/* Conteúdo */}
            <div
              className="flex flex-1 items-center justify-between"
              style={{
                padding: '2mm',
              }}
            >

              {/* Nome */}
              <div
                style={{
                  width: '62%',
                  overflow: 'hidden',
                }}
              >

                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 900,
                    lineHeight: '11px',
                    textTransform: 'uppercase',
                    wordBreak: 'break-word',
                  }}
                >
                  {c.nome}
                </div>

                <div
                  style={{
                    marginTop: '3px',
                    fontSize: '8px',
                    color: '#666',
                    fontWeight: 600,
                    lineHeight: '9px',
                    wordBreak: 'break-word',
                  }}
                >
                  {c.igreja}
                </div>

              </div>

              {/* QRCode */}
              <div
                style={{
                  width: '32%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <QRCodeSVG
                  value={`${c.tipo}|${c.id}`}
                  size={58}
                  level="H"
                  includeMargin={false}
                />
              </div>

            </div>

          </div>

        ))}

      </div>

      <style jsx global>{`
        @media print {

          body {
            background: white !important;
            margin: 0;
          }

          .print\\:hidden {
            display: none !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

    </div>
  );
}