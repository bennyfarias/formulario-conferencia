'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer, Search, Filter, Sparkles, Plus, Trash2, CheckCircle2, ListChecks } from 'lucide-react';

// ===== CONFIGURAÇÃO DA FOLHA COLACRIL A4256 =====
const COLS = 3;
const ROWS = 11;
const LABELS_PER_PAGE = COLS * ROWS; // 33
const LABEL_WIDTH = 63.5; // mm
const LABEL_HEIGHT = 25.4; // mm

const MARGIN_TOP = 8.8; // mm 
const MARGIN_LEFT = 7.2; // mm 
const GAP_X = 2.5; // mm 
const GAP_Y = 0; // mm 

const DATA_CORTE_LOTE_EXTRA = '2026-07-05T00:00:00.000Z'; // Linha de Corte do Lote Extra

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function CrachasPage() {
  const [crachas, setCrachas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // FILTROS
  const [filtroIgreja, setFiltroIgreja] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [somenteLoteExtra, setSomenteLoteExtra] = useState(false);
  
  // FILA DE IMPRESSÃO (Seleção Manual)
  const [selecionados, setSelecionados] = useState<string[]>([]);

  useEffect(() => {
    async function carregarCrachas() {
      const { data, error } = await supabase.from('inscricoes').select('*, participantes(*)').eq('status_pagamento', 'confirmado');
      if (error) { alert('Erro ao carregar dados.'); setLoading(false); return; }

      const listaCrachas: any[] = [];
      data?.forEach((inscricao: any) => {
        const isExtra = new Date(inscricao.criado_em) >= new Date(DATA_CORTE_LOTE_EXTRA);
        const igrejaNome = inscricao.igreja === 'Outras' ? inscricao.outra_igreja : inscricao.igreja;

        // Adiciona Titular (Gerando um UID único)
        listaCrachas.push({ uid: `titular-${inscricao.id}`, id: inscricao.id, tipo: 'titular', nome: inscricao.nome_titular, igreja: igrejaNome, isExtra });
        
        // Adiciona Acompanhantes
        inscricao.participantes?.forEach((p: any) => {
          listaCrachas.push({ uid: `acomp-${p.id}`, id: p.id, tipo: 'acompanhante', nome: p.nome_completo, igreja: igrejaNome, isExtra });
        });
      });

      // ORDENAÇÃO: Fila VIP
      const ordemIgrejas: Record<string, number> = { 'PIPR': 1, '2IPBV': 2, '3IPBV': 3, '4IPBV': 4, '5IPBV': 5, '6IPBV': 6 };
      listaCrachas.sort((a, b) => {
        const pesoA = ordemIgrejas[a.igreja.trim().toUpperCase()] || 99;
        const pesoB = ordemIgrejas[b.igreja.trim().toUpperCase()] || 99;
        if (pesoA !== pesoB) return pesoA - pesoB;
        if (pesoA === 99 && a.igreja !== b.igreja) return a.igreja.localeCompare(b.igreja, 'pt-BR');
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

      setCrachas(listaCrachas); setLoading(false);
    }
    carregarCrachas();
  }, []);

  const igrejasDisponiveis = useMemo(() => Array.from(new Set(crachas.map(c => c.igreja))).sort(), [crachas]);

  // Aplica os filtros gerais da busca
  const crachasFiltrados = useMemo(() => {
    return crachas.filter(c => {
      const matchIgreja = filtroIgreja === '' || c.igreja === filtroIgreja;
      const matchNome = filtroNome === '' || c.nome.toLowerCase().includes(filtroNome.toLowerCase());
      const matchExtra = somenteLoteExtra ? c.isExtra : true;
      return matchIgreja && matchNome && matchExtra;
    });
  }, [crachas, filtroIgreja, filtroNome, somenteLoteExtra]);

  // Determina quem realmente vai para a folha A4
  const crachasParaImprimir = useMemo(() => {
    if (selecionados.length > 0) {
      // Se tiver alguém na fila manual, ignora os filtros de busca e imprime só a fila
      return crachas.filter(c => selecionados.includes(c.uid));
    }
    // Se a fila estiver vazia, imprime todos os resultados do filtro
    return crachasFiltrados;
  }, [crachas, crachasFiltrados, selecionados]);

  // FUNÇÕES DA FILA MANAL
  const toggleSelecao = (uid: string) => {
    setSelecionados(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const adicionarTodosFiltrados = () => {
    const uidsFiltrados = crachasFiltrados.map(c => c.uid);
    const combinados = Array.from(new Set([...selecionados, ...uidsFiltrados]));
    setSelecionados(combinados);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><Loader2 className="animate-spin text-blue-600" size={42} /></div>;
  const paginas = chunk(crachasParaImprimir, LABELS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-200 p-6 print:p-0 print:bg-white">
      
      {/* PAINEL DE CONTROLE (Não sai na impressão) */}
      <div className="max-w-6xl mx-auto mb-6 bg-white rounded-2xl shadow p-6 print:hidden border-2 border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Gerador de Etiquetas</h1>
            <p className="text-gray-600 font-medium mt-1">
              Imprimindo: <strong className="text-blue-600">{crachasParaImprimir.length}</strong> crachás | Folhas: <strong>{paginas.length}</strong>
            </p>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-black hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl w-full md:w-auto justify-center">
            <Printer size={20} /> IMPRIMIR CRACHÁS
          </button>
        </div>

        {/* ÁREA 1: FILTROS GERAIS */}
        <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1.5"><Filter size={14}/> Filtrar Igreja</label>
            <select value={filtroIgreja} onChange={e => setFiltroIgreja(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Todas as Igrejas</option>
              {igrejasDisponiveis.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1.5"><Search size={14}/> Buscar Nome</label>
            <input type="text" placeholder="Pesquisar pessoa..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"/>
          </div>
          <div className="flex-none flex items-end">
            <button onClick={() => setSomenteLoteExtra(!somenteLoteExtra)} className={`w-full p-2.5 rounded-lg font-bold border transition-all flex items-center justify-center gap-2 ${somenteLoteExtra ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'}`}>
              <Sparkles size={16} strokeWidth={3}/> {somenteLoteExtra ? 'Filtrando Lote Extra' : 'Isolar Lote Extra'}
            </button>
          </div>
        </div>

        {/* ÁREA 2: FILA DE IMPRESSÃO MANUAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Lado Esquerdo: Resultados para Adicionar */}
          <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-72">
            <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
              <span className="font-bold text-sm text-gray-700 flex items-center gap-2"><Search size={16}/> Resultados ({crachasFiltrados.length})</span>
              <button onClick={adicionarTodosFiltrados} className="text-xs font-bold bg-white border border-gray-300 px-3 py-1 rounded shadow-sm hover:bg-gray-50 text-blue-600">Adicionar Todos</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-white space-y-1">
              {crachasFiltrados.map(c => {
                const isSelected = selecionados.includes(c.uid);
                return (
                  <div key={c.uid} onClick={() => toggleSelecao(c.uid)} className={`p-2.5 border rounded-lg cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50'}`}>
                    <div>
                      <p className={`font-bold text-sm ${isSelected ? 'text-green-800' : 'text-gray-900'}`}>{c.nome}</p>
                      <p className="text-xs font-medium text-gray-500">{c.igreja} {c.isExtra && <span className="text-purple-600 font-bold ml-1">• Lote Extra</span>}</p>
                    </div>
                    {isSelected ? <CheckCircle2 className="text-green-500" size={20}/> : <Plus className="text-gray-400" size={20}/>}
                  </div>
                );
              })}
              {crachasFiltrados.length === 0 && <p className="text-center text-sm text-gray-400 mt-10 font-medium">Nenhum resultado encontrado.</p>}
            </div>
          </div>

          {/* Lado Direito: Fila de Impressão */}
          <div className="border-2 border-blue-200 rounded-xl overflow-hidden flex flex-col h-72 bg-blue-50">
            <div className="bg-blue-100 p-3 border-b border-blue-200 flex justify-between items-center">
              <span className="font-bold text-sm text-blue-900 flex items-center gap-2"><ListChecks size={16}/> Fila de Impressão Específica</span>
              {selecionados.length > 0 && <button onClick={() => setSelecionados([])} className="text-xs font-bold bg-white border border-red-200 px-3 py-1 rounded shadow-sm hover:bg-red-50 text-red-600">Limpar Fila</button>}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {selecionados.length === 0 ? (
                <div className="text-center mt-12 px-4">
                  <Printer className="mx-auto mb-2 text-blue-300" size={32}/>
                  <p className="text-sm font-bold text-blue-800">A fila específica está vazia.</p>
                  <p className="text-xs text-blue-600 mt-1 leading-relaxed">Neste modo, o sistema irá imprimir automaticamente todos os <strong>{crachasFiltrados.length}</strong> crachás dos Resultados da Busca ao lado.</p>
                </div>
              ) : (
                crachas.filter(c => selecionados.includes(c.uid)).map(c => (
                  <div key={c.uid} onClick={() => toggleSelecao(c.uid)} className="p-2.5 bg-white border border-blue-200 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-red-50 group">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{c.nome}</p>
                      <p className="text-xs font-medium text-gray-500">{c.igreja}</p>
                    </div>
                    <Trash2 className="text-gray-300 group-hover:text-red-500 transition-colors" size={18}/>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RENDERIZAÇÃO DAS FOLHAS A4 (Fila de Impressão) */}
      {paginas.map((pagina, pIndex) => (
        <div key={pIndex} className="folha" style={{ width: '210mm', height: '297mm', margin: '0 auto', background: '#fff', position: 'relative', boxSizing: 'border-box', paddingTop: `${MARGIN_TOP}mm`, paddingLeft: `${MARGIN_LEFT}mm` }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${LABEL_WIDTH}mm)`, gridTemplateRows: `repeat(${ROWS}, ${LABEL_HEIGHT}mm)`, columnGap: `${GAP_X}mm`, rowGap: `${GAP_Y}mm` }}>
            {pagina.map((c, index) => (
              <div key={index} style={{ width: `${LABEL_WIDTH}mm`, height: `${LABEL_HEIGHT}mm`, boxSizing: 'border-box', padding: '2mm 2mm 2mm 4mm', display: 'flex', alignItems: 'center', background: '#fff', pageBreakInside: 'avoid', breakInside: 'avoid', overflow: 'hidden' }}>
                {/* QR Code */}
                <div style={{ width: '17mm', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <QRCodeSVG value={`${c.tipo}|${c.id}`} size={52} level="L" includeMargin={false} />
                </div>
                {/* Textos */}
                <div style={{ flex: 1, paddingLeft: '3mm', color: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
                  <div style={{ fontSize: '6px', fontWeight: 800, color: '#666', marginBottom: '1mm', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Fé Reformada 2026
                  </div>
                  <div style={{ fontWeight: 900, fontSize: '9.5px', lineHeight: '10.5px', textTransform: 'uppercase', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.nome}
                  </div>
                  <div style={{ marginTop: '1.5mm', fontSize: '8px', lineHeight: '9px', color: '#333', fontWeight: 800, textTransform: 'uppercase', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.igreja}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <style jsx global>{`
        @page { size: A4 portrait; margin: 0 !important; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .folha { margin: 0 !important; box-shadow: none !important; page-break-after: always; break-after: page; }
          .folha:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}