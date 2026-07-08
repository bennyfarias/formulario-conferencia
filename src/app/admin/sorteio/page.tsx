'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Users, Play, BookOpen, Loader2 } from 'lucide-react';

export default function SorteioPage() {
  const [presentes, setPresentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados da Animação
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<{nome: string, igreja: string} | null>(null);
  const [vencedor, setVencedor] = useState<{nome: string, igreja: string} | null>(null);

  useEffect(() => {
    async function carregarPresentes() {
      try {
        // 1. Define o intervalo do dia de HOJE
        const agora = new Date();
        const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
        const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

        // 2. Busca todas as presenças de hoje
        const { data: checkins, error: erroCheckin } = await supabase
          .from('presencas')
          .select('participante_id, tipo_participante')
          .gte('data_checkin', hojeInicio)
          .lte('data_checkin', hojeFim);

        if (erroCheckin) throw erroCheckin;

        // 3. Busca os dados de todas as inscrições para cruzar os nomes
        const { data: inscricoes, error: erroInsc } = await supabase
          .from('inscricoes')
          .select('id, nome_titular, igreja, outra_igreja, participantes(id, nome_completo)');

        if (erroInsc) throw erroInsc;

        const listaPresentes: {nome: string, igreja: string}[] = [];

        // 4. Cruza as tabelas para montar a lista final de sorteio
        checkins?.forEach(checkin => {
          if (checkin.tipo_participante === 'titular') {
            const inscricao = inscricoes?.find(i => i.id === checkin.participante_id);
            if (inscricao) {
              listaPresentes.push({
                nome: inscricao.nome_titular,
                igreja: inscricao.igreja === 'Outras' ? inscricao.outra_igreja : inscricao.igreja
              });
            }
          } else {
            inscricoes?.forEach(inscricao => {
              const acompanhante = inscricao.participantes?.find((p: any) => p.id === checkin.participante_id);
              if (acompanhante) {
                listaPresentes.push({
                  nome: acompanhante.nome_completo,
                  igreja: inscricao.igreja === 'Outras' ? inscricao.outra_igreja : inscricao.igreja
                });
              }
            });
          }
        });

        setPresentes(listaPresentes);
      } catch (error) {
        console.error("Erro ao carregar lista de sorteio:", error);
      } finally {
        setLoading(false);
      }
    }

    carregarPresentes();
  }, []);

  const iniciarSorteio = () => {
    if (presentes.length === 0 || isSpinning) return;

    setVencedor(null);
    setIsSpinning(true);

    let tempoDecorrido = 0;
    const tempoTotal = 4000; // 4 segundos de suspense
    const intervaloTroca = 60; // Troca de nome a cada 60ms

    const interval = setInterval(() => {
      const indexAleatorio = Math.floor(Math.random() * presentes.length);
      setCurrentDisplay(presentes[indexAleatorio]);
      tempoDecorrido += intervaloTroca;

      if (tempoDecorrido >= tempoTotal) {
        clearInterval(interval);
        const indexVencedor = Math.floor(Math.random() * presentes.length);
        setVencedor(presentes[indexVencedor]);
        setCurrentDisplay(null);
        setIsSpinning(false);
      }
    }, intervaloTroca);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white w-16 h-16" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      
      {/* Efeitos de Fundo (Luzes desfocadas) */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-900 rounded-full blur-[150px] opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-purple-900 rounded-full blur-[150px] opacity-30 pointer-events-none"></div>

      {/* Cabeçalho */}
      <div className="absolute top-10 w-full text-center z-10 flex flex-col items-center">
        <h2 className="text-gray-400 font-black tracking-[0.3em] uppercase text-sm md:text-xl mb-2">
          Conferência Fé Reformada 2026
        </h2>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
          <Users className="text-gray-300 w-5 h-5" />
          <span className="text-white font-bold tracking-widest text-sm">
            TOTAL DE PRESENTES HOJE: <span className="font-black text-white">{presentes.length}</span>
          </span>
        </div>
      </div>

      {/* Área Central do Sorteio */}
      <div className="w-full max-w-5xl z-10 flex flex-col items-center justify-center mt-16 min-h-[400px]">
        
        {!isSpinning && !vencedor && (
          <div className="text-center animate-in fade-in zoom-in duration-700">
            <BookOpen className="w-24 h-24 md:w-32 md:h-32 text-gray-700 mx-auto mb-8 opacity-50" strokeWidth={1} />
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight opacity-80">
              PRONTO PARA O SORTEIO
            </h1>
          </div>
        )}

        {/* Efeito Roleta Rolando */}
        {isSpinning && currentDisplay && (
          <div className="text-center w-full">
            <div className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter truncate px-4">
              {currentDisplay.nome}
            </div>
            <div className="text-xl md:text-3xl font-bold text-gray-500 uppercase mt-4 tracking-widest">
              {currentDisplay.igreja}
            </div>
          </div>
        )}

        {/* Exibição do Vencedor */}
        {vencedor && !isSpinning && (
          <div className="text-center w-full animate-in slide-in-from-bottom-10 fade-in duration-1000">
            <div className="inline-block mb-6 relative">
              <div className="absolute inset-0 bg-white blur-xl opacity-20 rounded-full animate-pulse"></div>
              <BookOpen className="w-20 h-20 md:w-28 md:h-28 text-white relative z-10" />
            </div>
            <p className="text-blue-400 font-black tracking-[0.2em] uppercase text-sm md:text-xl mb-4">
              O Vencedor É
            </p>
            <div className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter leading-tight drop-shadow-2xl">
              {vencedor.nome}
            </div>
            <div className="inline-block mt-8 bg-white text-black px-8 py-3 rounded-full text-xl md:text-3xl font-black uppercase tracking-widest border-4 border-white shadow-[0_0_40px_rgba(255,255,255,0.3)]">
              {vencedor.igreja}
            </div>
          </div>
        )}

      </div>

      {/* Controles */}
      <div className="absolute bottom-10 z-10">
        <button
          onClick={iniciarSorteio}
          disabled={isSpinning || presentes.length === 0}
          className="group flex items-center justify-center gap-4 bg-white text-black px-12 py-5 rounded-full font-black text-2xl uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
        >
          {isSpinning ? (
            <Loader2 className="animate-spin w-8 h-8" />
          ) : (
            <>
              <Play className="w-8 h-8 fill-black" />
              SORTEAR AGORA
            </>
          )}
        </button>
      </div>
      
    </div>
  );
}