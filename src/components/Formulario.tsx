'use client';

import React from 'react';
import { Lock } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        
        {/* Ícone de Cadeado Minimalista */}
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        
        {/* Título Principal */}
        <h1 className="text-3xl font-black text-black mb-4 uppercase tracking-tight">
          Inscrições Encerradas
        </h1>
        
        {/* Mensagem Explicativa */}
        <p className="text-gray-600 text-lg leading-relaxed font-medium">
          As vagas para a <strong>Conferência Fé Reformada 2026</strong> esgotaram e o período de inscrições chegou ao fim.
          <br /><br />
          Agradecemos a todos pelo interesse!
        </p>

      </div>
    </div>
  );
}