'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, AlertTriangle, Loader2, ScanLine } from 'lucide-react';

export default function CheckinPage() {
  const [scannerLoadError, setScannerLoadError] = useState(false);
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [nomePessoa, setNomePessoa] = useState('');
  
  // Evitar leitura do mesmo crachá 2 vezes seguidas num espaço de 3 segundos
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    let html5QrcodeScanner: any = null;

    // Import dinâmico para evitar erro de servidor (Next.js SSR)
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

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
    // Bloqueia leituras duplicadas rápidas
    if (decodedText === lastScanned || scanningStatus === 'loading') return;
    
    setLastScanned(decodedText);
    setScanningStatus('loading');
    
    // O QRCode é formatado como: tipo|ID (ex: titular|a1b2-c3d4...)
    const partes = decodedText.split('|');
    if (partes.length !== 2) {
      exibirErro("QR Code Inválido ou não pertence a este evento.");
      return;
    }

    const tipo = partes[0]; // 'titular' ou 'acompanhante'
    const id = partes[1];

    try {
      // 1. Puxar nome para mostrar na tela e verificar pagamento
      let nomeEncontrado = '';
      
      if (tipo === 'titular') {
        const { data: inscricao, error } = await supabase.from('inscricoes').select('nome_titular, status_pagamento').eq('id', id).single();
        if (error || !inscricao) throw new Error("Inscrição não encontrada.");
        if (inscricao.status_pagamento !== 'confirmado') throw new Error("Pagamento não confirmado para esta pessoa.");
        nomeEncontrado = inscricao.nome_titular;
      } else {
        // Acompanhante - precisa checar a inscrição atrelada a ele
        const { data: acompanhante, error } = await supabase.from('participantes').select('nome_completo, inscricao_id, inscricoes(status_pagamento)').eq('id', id).single();
        if (error || !acompanhante) throw new Error("Participante não encontrado.");
        if ((acompanhante.inscricoes as any).status_pagamento !== 'confirmado') throw new Error("Pagamento não confirmado para o titular deste acompanhante.");
        nomeEncontrado = acompanhante.nome_completo;
      }

      setNomePessoa(nomeEncontrado);

      // 2. Verificar se já fez check-in hoje
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);
      
      const { data: presencaExiste } = await supabase
        .from('presencas')
        .select('id')
        .eq('participante_id', id)
        .gte('data_checkin', hojeInicio.toISOString())
        .limit(1);

      if (presencaExiste && presencaExiste.length > 0) {
        exibirErro("ATENÇÃO: Este crachá já fez check-in hoje.");
        return;
      }

      // 3. Registrar Presença
      const { error: erroInsert } = await supabase.from('presencas').insert([{
        tipo_participante: tipo,
        participante_id: id
      }]);

      if (erroInsert) throw erroInsert;

      // SUCESSO
      setMensagem("Entrada Liberada!");
      setScanningStatus('success');

      // Limpa a tela após 3 segundos
      setTimeout(() => {
        setScanningStatus('idle');
        setLastScanned(null);
      }, 3000);

    } catch (error: any) {
      exibirErro(error.message);
    }
  };

  const onScanFailure = (error: any) => {
    // Falhas de leitura contínuas são normais enquanto a câmera tenta focar. Não fazemos nada.
  };

  const exibirErro = (msg: string) => {
    setMensagem(msg);
    setScanningStatus('error');
    setTimeout(() => {
      setScanningStatus('idle');
      setLastScanned(null);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2rem] p-6 shadow-2xl">
        
        <div className="text-center mb-6">
          <ScanLine className="w-12 h-12 text-black mx-auto mb-2" />
          <h1 className="text-2xl font-black text-black">Portaria Rápida</h1>
          <p className="text-gray-500 text-sm">Posicione o crachá na frente da câmera.</p>
        </div>

        {/* Leitor de Câmera */}
        {/* Leitor de Câmera */}
<div className="rounded-2xl overflow-hidden bg-white border-2 border-gray-200 p-4 mb-6">
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
    </div>
  );
}