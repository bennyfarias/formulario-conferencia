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
      // Puxa apenas quem já pagou
      const { data, error } = await supabase
        .from('inscricoes')
        .select('*, participantes(*)')
        .eq('status_pagamento', 'confirmado');

      if (error) {
        alert("Erro ao carregar dados.");
        setLoading(false);
        return;
      }

      const listaCrachas: any[] = [];

      data?.forEach(inscricao => {
        const igrejaNome = inscricao.igreja === 'Outras' ? inscricao.outra_igreja : inscricao.igreja;
        
        // Adiciona Titular
        listaCrachas.push({
          id: inscricao.id,
          tipo: 'titular',
          nome: inscricao.nome_titular,
          igreja: igrejaNome
        });

        // Adiciona Acompanhantes
        if (inscricao.participantes && inscricao.participantes.length > 0) {
          inscricao.participantes.forEach((p: any) => {
            listaCrachas.push({
              id: p.id,
              tipo: 'acompanhante',
              nome: p.nome_completo,
              igreja: igrejaNome
            });
          });
        }
      });

      // Organiza por ordem alfabética para facilitar na hora de entregar
      listaCrachas.sort((a, b) => a.nome.localeCompare(b.nome));
      setCrachas(listaCrachas);
      setLoading(false);
    }
    
    carregarCrachas();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-200 p-8">
      {/* Barra superior (não aparece na impressão) */}
      <div className="max-w-5xl mx-auto mb-8 flex justify-between items-center print:hidden bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-black">Gerador de Crachás</h1>
          <p className="text-gray-500">Total para impressão: {crachas.length} crachás.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-black hover:bg-gray-800 transition-colors shadow-md"
        >
          <Printer size={20} /> Imprimir Tudo
        </button>
      </div>

      {/* Grid de Crachás (Tamanho e layout preparados para folha A4) */}
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-3 print:gap-4 print:p-0">
        {crachas.map((c, index) => (
          <div key={index} className="bg-white border-2 border-gray-300 rounded-xl p-4 flex flex-col items-center text-center shadow-sm break-inside-avoid w-full aspect-[3/4]">
            
            <div className="w-full bg-black text-white text-[10px] uppercase font-black tracking-widest py-1.5 rounded-md mb-4">
              Fé Reformada 2026
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              {/* O Valor lido pela câmera será: "titular|UUID" ou "acompanhante|UUID" */}
              <QRCodeSVG 
                value={`${c.tipo}|${c.id}`} 
                size={120}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="mt-4 w-full">
              <h2 className="font-black text-black text-sm uppercase leading-tight line-clamp-2">
                {c.nome}
              </h2>
              <p className="text-xs text-gray-500 font-bold mt-1 truncate">
                {c.igreja}
              </p>
            </div>
            
          </div>
        ))}
      </div>
      
      {/* Regra CSS para esconder fundo e botoes durante impressão */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background-color: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}