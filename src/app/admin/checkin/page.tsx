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

    import('html5-qrcode').then((html5Qrcode) => {
      const { Html5QrcodeScanner, Html5QrcodeSupportedFormats } = html5Qrcode;

      // CONFIGURAÇÃO OTIMIZADA PARA VELOCIDADE
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 15, // Aumentado para o scanner "ver" mais frames por segundo
          qrbox: { width: 250, height: 250 }, // Mantém o foco centralizado
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          // RESOLUÇÃO EQUILIBRADA: Não é 4K (pesado), é a resolução ideal para leitura rápida
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
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
    
    // Feedback visual imediato
    setScanningStatus('loading');
    
    const partes = decodedText.split('|');
    if (partes.length !== 2) {
      exibirErro("QR Code Inválido.");
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
        exibirErro("CRACHÁ JÁ REGISTRADO HOJE!");
        return;
      }

      const { error: erroInsert } = await supabase.from('presencas').insert([{
        tipo_participante: tipo,
        participante_id: id
      }]);

      if (erroInsert) throw erroInsert;

      setMensagem("ENTRADA LIBERADA!");
      setScanningStatus('success');

      setTimeout(() => {
        setScanningStatus('idle');
        isProcessing.current = false;
      }, 2000);

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
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2rem] p-6 shadow-2xl">
        <div className="text-center mb-6">
          <ScanLine className="w-12 h-12 text-black mx-auto mb-2" />
          <h1 className="text-2xl font-black text-black">Portaria Rápida</h1>
        </div>

        <div className="rounded-2xl overflow-hidden bg-black border-2 border-gray-200 p-1 mb-4 relative">
          {scannerLoadError ? (
            <div className="p-8 text-center text-red-500 font-bold">Erro na câmara. Verifique permissões.</div>
          ) : (
            <div id="reader" className="w-full"></div>
          )}
        </div>
        
        <div className={`rounded-xl p-4 text-center transition-all min-h-[100px] flex flex-col items-center justify-center
          ${scanningStatus === 'idle' ? 'bg-gray-100' : ''}
          ${scanningStatus === 'loading' ? 'bg-blue-100' : ''}
          ${scanningStatus === 'success' ? 'bg-green-100' : ''}
          ${scanningStatus === 'error' ? 'bg-red-100' : ''}
        `}>
          {scanningStatus === 'idle' && <p className="text-gray-500 font-black">APONTE PARA O QR CODE</p>}
          {scanningStatus === 'loading' && <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}
          {scanningStatus === 'success' && <><CheckCircle2 className="w-10 h-10 text-green-600 mb-1" /><p className="text-green-800 font-black text-lg">{mensagem}</p><p className="text-green-700 font-bold text-sm">{nomePessoa}</p></>}
          {scanningStatus === 'error' && <><AlertTriangle className="w-10 h-10 text-red-600 mb-1" /><p className="text-red-800 font-black text-md">{mensagem}</p></>}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        #html5-qrcode-anchor-scan-type-change { display: none !important; }
        #html5-qrcode-select-camera { width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #ccc; font-weight: bold; }
        #html5-qrcode-button-camera-permission { background-color: #000; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; width: 100%; margin-bottom: 10px; }
        #html5-qrcode-button-camera-start, #html5-qrcode-button-camera-stop { background-color: #333; color: #fff; padding: 10px; border-radius: 8px; font-weight: bold; width: 48%; }
        #reader video { width: 100%; height: 300px; object-fit: cover; }
      `}} />
    </div>
  );
}