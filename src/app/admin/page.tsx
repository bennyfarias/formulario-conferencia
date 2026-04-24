'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Search, Eye, CheckCircle, Clock, X, Loader2, Users, DollarSign, Download, LogOut, AlertCircle
} from 'lucide-react';

const LIMITE_MAXIMO = 800;

export default function AdminDashboard() {
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState<any>(null);
  const [filtro, setFiltro] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        carregarDados();
      }
    };
    checkAuth();
  }, [router]);

  async function carregarDados() {
    setLoading(true);
    const { data, error } = await supabase
      .from('inscricoes')
      .select('*, participantes(*)')
      .order('criado_em', { ascending: false });

    if (!error) setInscricoes(data || []);
    setLoading(false);
  }

  const exportarCSV = () => {
    // Atualizado com a coluna de Sexo
    const headers = ["Nome Titular", "Sexo Titular", "Email", "Telefone", "Igreja", "Outra Igreja", "Forma Pgto", "Valor", "Status", "Participantes (Nome - Sexo)"];
    
    const rows = inscricoes.map(i => [
      i.nome_titular,
      i.sexo || 'Não informado', // Novo campo
      i.email,
      i.telefone,
      i.igreja,
      i.outra_igreja || '-',
      i.forma_pagamento,
      i.valor_total,
      i.status_pagamento,
      // Inclui o sexo dos participantes na exportação
      i.participantes?.map((p: any) => `${p.nome_completo} (${p.sexo || 'N/A'})`).join('; ') || 'Nenhum'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "lista_inscricoes_fe_reformada.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmarInscricao = async (inscricao: any) => {
    // 1. Atualiza no Banco
    const { error: dbError } = await supabase
      .from('inscricoes')
      .update({ status_pagamento: 'confirmado' })
      .eq('id', inscricao.id);
      
    if (dbError) {
      alert('Erro no banco: ' + dbError.message);
      return;
    }

    // 2. Dispara o E-mail pelo Mailjet
    try {
      const response = await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailDestino: inscricao.email,
          nomeTitular: inscricao.nome_titular,
          valorTotal: inscricao.valor_total
        }),
      });

      const dadosResposta = await response.json();

      if (!response.ok) {
        throw new Error(dadosResposta.error || 'Erro desconhecido na API do Mailjet');
      }

      alert('Inscrição aprovada e E-mail enviado com sucesso!');
      setAnalisando(null);
      carregarDados();
      
    } catch (err: any) {
      alert('ERRO DO E-MAIL: ' + err.message);
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const filtrados = inscricoes.filter(i => i.nome_titular.toLowerCase().includes(filtro.toLowerCase()));

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestão Fé Reformada</h1>
            <p className="text-gray-500">Administração de inscritos e confirmação de pagamentos.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportarCSV} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
              <Download size={18} /> Exportar CSV
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><DollarSign size={24}/></div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Confirmado</p>
                <p className="text-2xl font-bold text-gray-900">R$ {inscricoes.filter(i => i.status_pagamento === 'confirmado').reduce((acc, curr) => acc + curr.valor_total, 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Users size={24}/></div>
              <div><p className="text-sm text-gray-500 font-medium">Ocupação</p><p className="text-2xl font-bold">{inscricoes.length} / {LIMITE_MAXIMO}</p></div>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full" style={{ width: `${(inscricoes.length / LIMITE_MAXIMO) * 100}%` }}></div></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><Clock size={24}/></div>
              <div><p className="text-sm text-gray-500 font-medium">Pendentes</p><p className="text-2xl font-bold">{inscricoes.filter(i => i.status_pagamento === 'pendente').length}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b"><input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Pesquisar por nome..." className="w-full md:w-96 p-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400 tracking-widest">
              <tr>
                <th className="px-8 py-5">Inscrito</th>
                <th className="px-8 py-5">Igreja</th>
                <th className="px-8 py-5 text-center">Pgto</th>
                <th className="px-8 py-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.map(i => (
                <tr key={i.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5 font-bold text-gray-900">
                    {i.nome_titular} <span className="text-xs text-gray-400 font-normal ml-2">({i.sexo || '?'})</span>
                  </td>
                  <td className="px-8 py-5 text-gray-500">{i.igreja === 'Outras' ? i.outra_igreja : i.igreja}</td>
                  <td className="px-8 py-5 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${i.status_pagamento === 'confirmado' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{i.status_pagamento}</span></td>
                  <td className="px-8 py-5 text-right"><button onClick={() => setAnalisando(i)} className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-all shadow-sm">Analisar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE ANÁLISE COM TODAS AS INFORMAÇÕES */}
      {analisando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[85vh]">
            
            <div className="w-full md:w-3/5 bg-gray-100 flex items-center justify-center p-8 border-r">
              {analisando.comprovante_url ? (
                <img 
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprovantes/${analisando.comprovante_url}`} 
                  className="max-h-full max-w-full object-contain rounded-2xl shadow-lg"
                  alt="Comprovante"
                />
              ) : (
                <div className="text-center text-gray-400 p-10"><Eye size={48} className="mx-auto mb-4 opacity-20" /><p className="font-bold">Pagamento via Cartão (Sem foto)</p></div>
              )}
            </div>

            <div className="w-full md:w-2/5 p-10 overflow-y-auto bg-white">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-gray-900">Dossiê de Inscrição</h2>
                <button onClick={() => setAnalisando(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"><X size={20} /></button>
              </div>

              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 p-4 bg-gray-50 rounded-2xl">
                    <div className="flex justify-between">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Nome Completo</p>
                      {/* Mostrar o sexo do titular no card */}
                      <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold uppercase">{analisando.sexo || 'N/A'}</span>
                    </div>
                    <p className="font-bold text-gray-900">{analisando.nome_titular}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email</p>
                    <p className="font-bold text-gray-900 text-xs truncate">{analisando.email}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Telefone</p>
                    <p className="font-bold text-gray-900">{analisando.telefone}</p>
                  </div>
                  <div className="col-span-2 p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Congregação</p>
                    <p className="font-bold text-gray-900">{analisando.igreja === 'Outras' ? analisando.outra_igreja : analisando.igreja}</p>
                  </div>
                </div>

                <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Inscrições Adicionais</p>
                  {analisando.participantes && analisando.participantes.length > 0 ? (
                    <ul className="space-y-2">
                      {analisando.participantes.map((p: any, idx: number) => (
                        <li key={idx} className="text-sm font-bold text-blue-800 flex items-center justify-between">
                          <span className="flex items-center gap-2"><CheckCircle size={14} /> {p.nome_completo}</span>
                          {/* Mostrar o sexo do participante */}
                          <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">{p.sexo || '?'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-blue-400 italic">Inscrição Individual</p>
                  )}
                </div>

                <div className="p-5 bg-gray-900 rounded-2xl flex justify-between items-center text-white">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Valor Total</p><p className="text-2xl font-black">R$ {analisando.valor_total.toFixed(2)}</p></div>
                  <div className="text-right uppercase text-[10px] font-black px-3 py-1 bg-white/10 rounded-lg">{analisando.forma_pagamento}</div>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => confirmarInscricao(analisando)}
                  disabled={analisando.status_pagamento === 'confirmado'}
                  className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle size={20} /> Aprovar e Enviar E-mail
                </button>
                <button className="w-full py-3 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-red-500">Rejeitar e Notificar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}