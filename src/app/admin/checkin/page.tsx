'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, AlertTriangle, Loader2, ScanLine } from 'lucide-react';

export default function CheckinPage() {
  const [scannerLoadError, setScannerLoadError] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [nomePessoa, setNomePessoa] = useState('');
  
  // REFERÊNCIAS MÁGICAS PARA TRAVAR A METRALHADORA DA CÂMERA
  const scannerRef = useRef<any>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    let html5QrcodeScanner: any = null;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        // Reduzimos o FPS de 10 para 5 para ser mais suave
        { fps: 5, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scannerRef.current = html5QrcodeScanner;
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
      
    }).catch(err => {
      console.error(err);
      setScannerLoadError(true);
    });

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch((error: any) => console.error("Failed to clear scanner", error));
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    // 1. TRAVA IMEDIATA: Se já estiver processando, ignora todas as outras leituras
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    // 2. PAUSA A CÂMERA VISUALMENTE
    if (scannerRef.current) {
      try { scannerRef.current.pause(true); } catch(e) {}
    }

    setScanningStatus('loading');
    
    const partes = decodedText.split('|');
    if (partes.length !== 2) {
      exibirErro("QR Code Inválido ou não pertence a este evento.");
      return;
    }

    const tipo = partes[0]; // 'titular' ou 'acompanhante'
    const id = partes[1];

    try {
      let nomeEncontrado = '';
      
      // Busca o nome do dono do Crachá
      if (tipo === 'titular') {
        const { data: inscricao, error } = await supabase.from('inscricoes').select('nome_titular, status_pagamento').eq('id', id).single();
        if (error || !inscricao) throw new Error("Inscrição não encontrada.");
        if (inscricao.status_pagamento !== 'confirmado') throw new Error("Atenção: Pagamento Pendente!");
        nomeEncontrado = inscricao.nome_titular;
      } else {
        const { data: acompanhante, error } = await supabase.from('participantes').select('nome_completo, inscricoes(status_pagamento)').eq('id', id).single();
        if (error || !acompanhante) throw new Error("Participante não encontrado.");
        if ((acompanhante.inscricoes as any).status_pagamento !== 'confirmado') throw new Error("Atenção: Pagamento do Titular Pendente!");
        nomeEncontrado = acompanhante.nome_completo;
      }

      setNomePessoa(nomeEncontrado);

      // LÓGICA DE DATAS BLINDADA: Garante que a pessoa pode fazer 1 check-in POR DIA civil
      const agora = new Date();
      const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
      const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();
      
      const { data: presencaExiste } = await supabase
        .from('presencas')
        .select('id')
        .eq('participante_id', id)
        .gte('data_checkin', hojeInicio) // A partir de meia-noite de hoje
        .lte('data_checkin', hojeFim)    // Até 23:59 de hoje
        .limit(1);

      if (presencaExiste && presencaExiste.length > 0) {
        exibirErro("ESTE CRACHÁ JÁ FEZ CHECK-IN HOJE!");
        return;
      }

      // 3. Salvar a presença UMA ÚNICA VEZ
      const { error: erroInsert } = await supabase.from('presencas').insert([{
        tipo_participante: tipo,
        participante_id: id
      }]);

      if (erroInsert) throw erroInsert;

      // SUCESSO! Fica verde na tela
      setMensagem("Entrada Liberada!");
      setScanningStatus('success');

      // Limpa a tela e volta a câmera ao normal após 2.5 segundos
      setTimeout(() => {
        setScanningStatus('idle');
        isProcessing.current = false; // Destrava
        if (scannerRef.current) {
          try { scannerRef.current.resume(); } catch(e) {} // Liga a câmera
        }
      }, 2500);

    } catch (error: any) {
      exibirErro(error.message);
    }
  };

  const onScanFailure = (error: any) => {
    // Silencia os avisos da câmera tentando focar
  };

  const exibirErro = (msg: string) => {
    setMensagem(msg);
    setScanningStatus('error');
    setTimeout(() => {
      setScanningStatus('idle');
      isProcessing.current = false; // Destrava
      if (scannerRef.current) {
        try { scannerRef.current.resume(); } catch(e) {} // Liga a câmera
      }
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2rem] p-6 shadow-2xl">
        
        <div className="text-center mb-6">
          <ScanLine className="w-12 h-12 text-black mx-auto mb-2" />
          <h1 className="text-2xl font-black text-black">Portaria Rápida</h1>
          <p className="text-gray-500 text-sm mt-1">Para começar, clique no botão azul abaixo e libere a câmera do seu celular.</p>
        </div>

        {/* Leitor de Câmera com Fundo Branco */}
        <div className="rounded-2xl overflow-hidden bg-white border-2 border-gray-200 p-4 mb-6 relative">
          {scannerLoadError ? (
            <div className="p-8 text-center text-red-500 font-bold">Erro ao acessar a câmera. Verifique as permissões do navegador.</div>
          ) : (
            <div id="reader" className="w-full border-none"></div>
          )}
        </div>

        {/* Painel de Mensagens de Status */}
        <div className={`rounded-xl p-6 text-center transition-all min-h-[140px] flex flex-col items-center justify-center
          ${scanningStatus === 'idle' ? 'bg-gray-100' : ''}
          ${scanningStatus === 'loading' ? 'bg-blue-100' : ''}
          ${scanningStatus === 'success' ? 'bg-green-100 border-2 border-green-500' : ''}
          ${scanningStatus === 'error' ? 'bg-red-100 border-2 border-red-500' : ''}
        `}>
          
          {scanningStatus === 'idle' && (
            <p className="text-gray-500 font-bold">Aguardando QR Code...</p>
          )}

          {scanningStatus === 'loading' && (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          )}

          {scanningStatus === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-2" />
              <p className="text-green-800 font-black text-xl">{mensagem}</p>
              <p className="text-green-700 font-bold text-sm mt-1">{nomePessoa}</p>
            </>
          )}

          {scanningStatus === 'error' && (
            <>
              <AlertTriangle className="w-12 h-12 text-red-600 mb-2" />
              <p className="text-red-800 font-black text-lg leading-tight">{mensagem}</p>
              {nomePessoa && <p className="text-red-700 font-bold text-sm mt-2">{nomePessoa}</p>}
            </>
          )}

        </div>
      </div>

      {/* ESTILOS FORÇADOS PARA OS BOTÕES NATIVOS DA BIBLIOTECA */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Oculta o link inútil de escanear imagem */
        #html5-qrcode-anchor-scan-type-change {
          display: none !important;
        }

        /* Estiliza o botão principal de pedir permissão */
        #html5-qrcode-button-camera-permission {
          background-color: #141adfff !important; /* Azul escuro */
          color: white !important;
          font-weight: 900 !important;
          padding: 14px 24px !important;
          border-radius: 12px !important;
          border: none !important;
          font-size: 16px !important;
          cursor: pointer !important;
          width: 100% !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          text-transform: uppercase !important;
        }

        /* Estiliza os botões secundários de start/stop da câmera */
        #html5-qrcode-button-camera-start,
        #html5-qrcode-button-camera-stop {
          background-color: #111827 !important; /* Preto */
          color: white !important;
          font-weight: 800 !important;
          padding: 10px 20px !important;
          border-radius: 8px !important;
          border: none !important;
          margin: 5px !important;
          cursor: pointer !important;
        }

        /* Melhora o visual da caixa do vídeo */
        #reader video {
          border-radius: 12px !important;
        }
      `}} />
    </div>
  );
}