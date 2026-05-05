'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  Search, Eye, CheckCircle, Clock, X, Loader2, Users, DollarSign, Download, LogOut, Mail, Filter
} from 'lucide-react';

// Ajustado para o limite do 1º Lote
const LIMITE_LOTE_ATUAL = 300; 

export default function AdminDashboard() {
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState<any>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [filtro, setFiltro] = useState('');
  
  // Novo estado para o filtro de Pendentes/Confirmados
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'confirmado'>('todos');
  
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

  const exportarXLSX = () => {
    const headers = [
      "Nome Completo", 
      "Sexo", 
      "Tipo (Titular/Acompanhante)", 
      "Responsável Pelo Pagamento", 
      "Email (Apenas Titular)", 
      "Telefone (Apenas Titular)", 
      "Igreja", 
      "Valor Unitário", 
      "Status do Pagamento"
    ];
    
    const rows: any[] = [];
    rows.push(headers);

    // Exportamos sempre todas as inscrições para garantir que a portaria tenha a lista completa
    inscricoes.forEach(i => {
      rows.push([
        i.nome_titular,
        i.sexo || 'N/A',
        "Titular",
        "-", 
        i.email,
        i.telefone,
        i.igreja === 'Outras' ? i.outra_igreja : i.igreja,
        i.valor_total / (1 + (i.participantes?.length || 0)), // Calcula o valor unitário dinâmico
        i.status_pagamento
      ]);

      if (i.participantes && i.participantes.length > 0) {
        i.participantes.forEach((p: any) => {
          rows.push([
            p.nome_completo,
            p.sexo || 'N/A',
            "Acompanhante",
            i.nome_titular, 
            "-", 
            "-", 
            i.igreja === 'Outras' ? i.outra_igreja : i.igreja,
            i.valor_total / (1 + i.participantes.length), // Calcula o valor unitário dinâmico
            i.status_pagamento 
          ]);
        });
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inscritos");
    
    const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Lista_Fe_Reformada_${dataAtual}.xlsx`);
  };

  const enviarEmailConfirmacao = async (inscricao: any) => {
    setEnviandoEmail(true);
    try {
      const response = await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailDestino: inscricao.email,
          nomeTitular: inscricao.nome_titular,
          valorTotal: inscricao.valor_total,
          // ✅ AGORA SIM! Enviando a quantidade para a API:
          quantidadeAcompanhantes: inscricao.participantes?.length || 0 
        }),
      });

      if (!response.ok) throw new Error('Falha na API de E-mail');
      return true;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setEnviandoEmail(false);
    }
  };

  const confirmarInscricao = async (inscricao: any) => {
    const emailSucesso = await enviarEmailConfirmacao(inscricao);

    if (!emailSucesso) {
      alert('ERRO CRÍTICO: O e-mail de confirmação falhou. A inscrição NÃO foi confirmada no sistema. Tente novamente.');
      return;
    }

    const { error: dbError } = await supabase
      .from('inscricoes')
      .update({ status_pagamento: 'confirmado' })
      .eq('id', inscricao.id);
      
    if (dbError) {
      alert('E-mail enviado, mas erro no banco: ' + dbError.message);
    } else {
      alert('Pagamento aprovado e E-mail enviado com sucesso!');
      setAnalisando(null);
      carregarDados();
    }
  };

  const reenviarEmailApenas = async (inscricao: any) => {
    const sucesso = await enviarEmailConfirmacao(inscricao);
    if (sucesso) {
      alert('E-mail de confirmação reenviado com sucesso!');
    } else {
      alert('Erro ao reenviar o e-mail. Verifique o console.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const filtrados = inscricoes.filter(i => {
    const matchBusca = i.nome_titular.toLowerCase().includes(filtro.toLowerCase());
    const matchStatus = statusFiltro === 'todos' || i.status_pagamento === statusFiltro;
    return matchBusca && matchStatus;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  const totalPessoas = inscricoes.reduce((acc, curr) => acc + 1 + (curr.participantes?.length || 0), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Gestão Fé Reformada</h1>
            <p className="text-gray-600 font-medium">Painel Administrativo da Conferência.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportarXLSX} className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-green-600 rounded-xl text-sm font-black text-green-700 hover:bg-green-50 transition-colors shadow-sm">
              <Download size={18} strokeWidth={3} /> Exportar Excel
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-black hover:bg-red-100 transition-all border-2 border-red-100">
              <LogOut size={18} strokeWidth={3} /> Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-green-100 text-green-700 rounded-2xl"><DollarSign size={28} strokeWidth={3}/></div>
              <div>
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-1">Total Confirmado</p>
                <p className="text-3xl font-black text-black">R$ {inscricoes.filter(i => i.status_pagamento === 'confirmado').reduce((acc, curr) => acc + curr.valor_total, 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 bg-blue-100 text-blue-700 rounded-2xl"><Users size={28} strokeWidth={3}/></div>
              <div>
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-1">Ocupação (1º Lote)</p>
                <p className="text-3xl font-black text-black">{totalPessoas} / {LIMITE_LOTE_ATUAL}</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden"><div className="bg-blue-600 h-full" style={{ width: `${(totalPessoas / LIMITE_LOTE_ATUAL) * 100}%` }}></div></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border-2 border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-100 text-orange-700 rounded-2xl"><Clock size={28} strokeWidth={3}/></div>
              <div>
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-1">Aguardando Análise</p>
                <p className="text-3xl font-black text-black">{inscricoes.filter(i => i.status_pagamento === 'pendente').length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b-2 border-gray-200 bg-gray-50">
            
            {/* NOVA BARRA COM PESQUISA E FILTROS */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  value={filtro} 
                  onChange={e => setFiltro(e.target.value)} 
                  placeholder="Pesquisar por nome do titular..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-base font-bold text-black placeholder-gray-500 focus:outline-none focus:border-black focus:ring-4 focus:ring-gray-200 transition-all" 
                />
              </div>

              {/* BOTÕES DE FILTRO DE STATUS */}
              <div className="flex bg-gray-200 p-1.5 rounded-xl w-full md:w-auto">
                <button 
                  onClick={() => setStatusFiltro('todos')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'todos' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setStatusFiltro('pendente')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'pendente' ? 'bg-orange-100 text-orange-800 shadow-sm' : 'text-gray-500 hover:text-black'}`}
                >
                  Pendentes
                </button>
                <button 
                  onClick={() => setStatusFiltro('confirmado')} 
                  className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'confirmado' ? 'bg-green-100 text-green-800 shadow-sm' : 'text-gray-500 hover:text-black'}`}
                >
                  Confirmados
                </button>
              </div>
            </div>

          </div>
          
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-[11px] uppercase font-black text-gray-600 tracking-widest border-b-2 border-gray-200">
              <tr>
                <th className="px-8 py-5">Inscrito (Titular)</th>
                <th className="px-8 py-5">Igreja</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100">
              {filtrados.map(i => (
                <tr key={i.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-8 py-5 font-black text-black text-lg">
                    {i.nome_titular} <span className="text-sm text-gray-500 font-bold ml-2">({i.sexo || '?'})</span>
                  </td>
                  <td className="px-8 py-5 text-gray-700 font-bold">{i.igreja === 'Outras' ? i.outra_igreja : i.igreja}</td>
                  <td className="px-8 py-5 text-center"><span className={`px-4 py-2 rounded-lg text-xs font-black uppercase ${i.status_pagamento === 'confirmado' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{i.status_pagamento}</span></td>
                  <td className="px-8 py-5 text-right"><button onClick={() => setAnalisando(i)} className="px-6 py-2.5 bg-black text-white text-sm font-black rounded-xl hover:bg-blue-700 transition-all shadow-md">Analisar</button></td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-gray-500 font-bold text-lg">
                    Nenhuma inscrição encontrada neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {analisando && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-6xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[90vh]">
            
            <div className="w-full md:w-3/5 bg-gray-100 flex items-center justify-center p-4 border-r-2 overflow-hidden">
              {analisando.comprovante_url ? (
                analisando.comprovante_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe 
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprovantes/${analisando.comprovante_url}`} 
                    className="w-full h-full rounded-2xl shadow-lg border-none bg-white"
                    title="Visualizador de PDF"
                  />
                ) : (
                  <img 
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprovantes/${analisando.comprovante_url}`} 
                    className="max-h-full max-w-full object-contain rounded-2xl shadow-lg"
                    alt="Comprovante de Pagamento"
                  />
                )
              ) : (
                <div className="text-center text-gray-500 p-10">
                  <Eye size={56} className="mx-auto mb-4 opacity-40" />
                  <p className="font-black text-xl text-black">Inscrição via Cartão</p>
                  <p className="text-base font-medium mt-2">Não há comprovante digital anexado.</p>
                </div>
              )}
            </div>

            <div className="w-full md:w-2/5 p-10 overflow-y-auto bg-white flex flex-col">
              <div className="flex justify-between items-center mb-8 pb-4 border-b-2">
                <h2 className="text-3xl font-black text-black">Dossiê de Inscrição</h2>
                <button onClick={() => setAnalisando(null)} className="p-2 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-600 transition-all text-gray-600"><X size={24} strokeWidth={3} /></button>
              </div>

              <div className="space-y-6 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 p-4 bg-gray-100 rounded-2xl border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Titular Responsável</p>
                      <span className="text-[10px] bg-white border text-black px-2 py-1 rounded-md font-black uppercase shadow-sm">{analisando.sexo || 'N/A'}</span>
                    </div>
                    <p className="text-xl font-black text-black">{analisando.nome_titular}</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-2xl border border-gray-200">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Telefone</p>
                    <p className="font-black text-black">{analisando.telefone}</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-2xl border border-gray-200">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Email</p>
                    <p className="font-bold text-black text-sm truncate">{analisando.email}</p>
                  </div>
                  <div className="col-span-2 p-4 bg-gray-100 rounded-2xl border border-gray-200">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2">Igreja</p>
                    <p className="font-black text-black text-lg">{analisando.igreja === 'Outras' ? analisando.outra_igreja : analisando.igreja}</p>
                  </div>
                </div>

                <div className="p-5 bg-blue-50 rounded-2xl border-2 border-blue-200">
                  <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-3">Acompanhantes</p>
                  {analisando.participantes && analisando.participantes.length > 0 ? (
                    <ul className="space-y-3">
                      {analisando.participantes.map((p: any, idx: number) => (
                        <li key={idx} className="text-base font-black text-blue-900 flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-blue-100">
                          <span className="flex items-center gap-2"><CheckCircle size={18} className="text-blue-500" /> {p.nome_completo}</span>
                          <span className="text-[10px] text-blue-800 bg-blue-100 px-2 py-1 rounded-md uppercase tracking-wider">{p.sexo || '?'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base text-blue-600 font-bold italic">Inscrição Individual (Sem acompanhantes)</p>
                  )}
                </div>

                <div className="p-6 bg-black rounded-2xl flex justify-between items-center text-white mt-auto shadow-xl">
                  <div><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Total</p><p className="text-3xl font-black">R$ {analisando.valor_total.toFixed(2)}</p></div>
                  <div className="text-right uppercase text-xs font-black px-4 py-2 bg-white text-black rounded-lg">{analisando.forma_pagamento}</div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {analisando.status_pagamento === 'pendente' ? (
                  <button 
                    onClick={() => confirmarInscricao(analisando)}
                    disabled={enviandoEmail}
                    className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-green-700 hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {enviandoEmail ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} strokeWidth={3} />} Aprovar e Disparar E-mail
                  </button>
                ) : (
                  <button 
                    onClick={() => reenviarEmailApenas(analisando)}
                    disabled={enviandoEmail}
                    className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {enviandoEmail ? <Loader2 className="animate-spin" size={24} /> : <Mail size={24} strokeWidth={3} />} Reenviar Confirmação
                  </button>
                )}
                
                {analisando.status_pagamento === 'pendente' && (
                  <button className="w-full py-4 text-gray-500 font-black text-xs uppercase tracking-widest hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors">
                    Marcar como Inválido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}