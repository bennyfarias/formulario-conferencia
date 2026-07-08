'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, AlertTriangle, Loader2, ScanLine } from 'lucide-react';

export default function CheckinPage() {
  const [scannerLoadError, setScannerLoadError] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [nomePessoa, setNomePessoa] = useState('');
  
  const scannerRef = useRef<any>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    let html5QrcodeScanner: any = null;

    // Importação dinâmica com acesso aos formatos suportados
    import('html5-qrcode').then((html5Qrcode) => {
      const { Html5QrcodeScanner, Html5QrcodeSupportedFormats } = html5Qrcode;

      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          // O SEGREDO 1: Focar apenas em QR Codes poupa memória e acelera a leitura de imagens grandes
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          // O SEGREDO 2: Sem 'qrbox', a câmara lê o ecrã inteiro.
          
          // O SEGREDO 3: Forçar alta resolução (Full HD/4K) para ler QR Codes minúsculos à distância
          videoConstraints: {
            facingMode: "environment",
            width: { min: 1280, ideal: 1920, max: 3840 },
            height: { min: 720, ideal: 1080, max: 2160 }
          }
        },
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
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    if (scannerRef.current) {
      try { scannerRef.current.pause(true); } catch(e) {}
    }

    setScanningStatus('loading');
    
    const partes = decodedText.split('|');
    if (partes.length !== 2) {
      exibirErro("QR Code Inválido ou não pertence a este evento.");
      return;
    }

    const tipo = partes[0]; 
    const id = partes[1];

    try {
      let nomeEncontrado = '';
      
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

      const agora = new Date();
      const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
      const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();
      
      const { data: presencaExiste } = await supabase
        .from('presencas')
        .select('id')
        .eq('participante_id', id)
        .gte('data_checkin', hojeInicio)
        .lte('data_checkin', hojeFim)
        .limit(1);

      if (presencaExiste && presencaExiste.length > 0) {
        exibirErro("ESTE CRACHÁ JÁ FEZ CHECK-IN HOJE!");
        return;
      }

      const { error: erroInsert } = await supabase.from('presencas').insert([{
        tipo_participante: tipo,
        participante_id: id
      }]);

      if (erroInsert) throw erroInsert;

      setMensagem("Entrada Liberada!");
      setScanningStatus('success');

      setTimeout(() => {
        setScanningStatus('idle');
        isProcessing.current = false;
        if (scannerRef.current) {
          try { scannerRef.current.resume(); } catch(e) {}
        }
      }, 2500);

    } catch (error: any) {
      exibirErro(error.message);
    }
  };

  const onScanFailure = (error: any) => {};

  const exibirErro = (msg: string) => {
    setMensagem(msg);
    setScanningStatus('error');
    setTimeout(() => {
      setScanningStatus('idle');
      isProcessing.current = false;
      if (scannerRef.current) {
        try { scannerRef.current.resume(); } catch(e) {}
      }
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2rem] p-6 shadow-2xl">
        
        <div className="text-center mb-6">
          <ScanLine className="w-12 h-12 text-black mx-auto mb-2" />
          <h1 className="text-2xl font-black text-black">Portaria Rápida</h1>
          <p className="text-gray-500 text-sm mt-1">Para começar, libere a câmara do telemóvel.</p>
        </div>

        {/* Leitor de Câmara com Fundo Branco */}
        <div className="rounded-2xl overflow-hidden bg-white border-2 border-gray-200 p-4 mb-2 relative">
          {scannerLoadError ? (
            <div className="p-8 text-center text-red-500 font-bold">Erro ao aceder à câmara. Verifique as permissões do navegador.</div>
          ) : (
            <div id="reader" className="w-full border-none"></div>
          )}
        </div>
        
      

        {/* Painel de Mensagens de Estado */}
        <div className={`rounded-xl p-6 text-center transition-all min-h-[140px] flex flex-col items-center justify-center
          ${scanningStatus === 'idle' ? 'bg-gray-100' : ''}
          ${scanningStatus === 'loading' ? 'bg-blue-100' : ''}
          ${scanningStatus === 'success' ? 'bg-green-100 border-2 border-green-500' : ''}
          ${scanningStatus === 'error' ? 'bg-red-100 border-2 border-red-500' : ''}
        `}>
          
          {scanningStatus === 'idle' && (
            <p className="text-gray-500 font-bold">A aguardar QR Code...</p>
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

      <style dangerouslySetInnerHTML={{__html: `
        #html5-qrcode-anchor-scan-type-change { display: none !important; }
        #html5-qrcode-select-camera {
          width: 100% !important; padding: 12px 16px !important; margin-bottom: 12px !important;
          border: 2px solid #111827 !important; border-radius: 12px !important; font-weight: 800 !important;
          font-size: 14px !important; color: #111827 !important; background-color: #f3f4f6 !important;
          cursor: pointer !important; outline: none !important;
        }
        #html5-qrcode-select-camera:disabled {
          background-color: #e5e7eb !important; color: #9ca3af !important; border-color: #d1d5db !important;
          cursor: not-allowed !important; opacity: 0.7 !important;
        }
        #html5-qrcode-select-camera option { color: #000 !important; background-color: #fff !important; font-weight: bold !important; }
        #html5-qrcode-button-camera-permission {
          background-color: #2563eb !important; color: white !important; font-weight: 900 !important;
          padding: 14px 24px !important; border-radius: 12px !important; border: none !important;
          font-size: 16px !important; cursor: pointer !important; width: 100% !important; margin-top: 10px !important;
          text-transform: uppercase !important;
        }
        #html5-qrcode-button-camera-start, #html5-qrcode-button-camera-stop {
          background-color: #111827 !important; color: white !important; font-weight: 800 !important;
          padding: 12px 20px !important; border-radius: 10px !important; border: none !important;
          margin: 5px !important; cursor: pointer !important; width: 100% !important;
        }
        #reader video { border-radius: 12px !important; width: 100% !important; object-fit: cover !important; }
      `}} />
    </div>
  );
}