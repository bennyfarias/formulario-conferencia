'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  Search, Eye, CheckCircle, Clock, X, Loader2, Users, DollarSign, Download, LogOut, Mail, Edit, Save, Trash2, Plus, Upload
} from 'lucide-react';

const LIMITE_LOTE_ATUAL = 200; // Limite do 2º lote
const INSCRITOS_LOTE_1 = 302; // Quantidade que já foi preenchida no 1º lote para ser subtraída da barra

export default function AdminDashboard() {
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState<any>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'confirmado'>('todos');
  
  const [modoEdicao, setModoEdicao] = useState(false);
  const [dadosEditados, setDadosEditados] = useState<any>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [novoComprovante, setNovoComprovante] = useState<File | null>(null);
  
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
      "Nome Completo", "Sexo", "Tipo (Titular/Acompanhante)", "Responsável Pelo Pagamento", 
      "Email (Apenas Titular)", "Telefone (Apenas Titular)", "Igreja", "Valor Unitário", "Status do Pagamento", "Forma de Pagamento"
    ];
    
    const rows: any[] = [];
    rows.push(headers);

    inscricoes.forEach(i => {
      rows.push([
        i.nome_titular, i.sexo || 'N/A', "Titular", "-", i.email, i.telefone,
        i.igreja === 'Outras' ? i.outra_igreja : i.igreja,
        i.valor_total / (1 + (i.participantes?.length || 0)), i.status_pagamento, i.forma_pagamento
      ]);

      if (i.participantes && i.participantes.length > 0) {
        i.participantes.forEach((p: any) => {
          rows.push([
            p.nome_completo, p.sexo || 'N/A', "Acompanhante", i.nome_titular, "-", "-",
            i.igreja === 'Outras' ? i.outra_igreja : i.igreja,
            i.valor_total / (1 + i.participantes.length), i.status_pagamento, i.forma_pagamento
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
      alert('ERRO CRÍTICO: O e-mail de confirmação falhou. A inscrição NÃO foi confirmada.');
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
    if (sucesso) alert('E-mail de confirmação reenviado com sucesso!');
    else alert('Erro ao reenviar o e-mail. Verifique o console.');
  };

  const excluirInscricao = async (id: string) => {
    const confirmacao = window.confirm("⚠️ TEM CERTEZA ABSOLUTA?\n\nIsso vai apagar o titular e TODOS os acompanhantes permanentemente. Esta ação não pode ser desfeita.");
    
    if (confirmacao) {
      try {
        setLoading(true);
        await supabase.from('participantes').delete().eq('inscricao_id', id);
        
        const { data, error } = await supabase.from('inscricoes').delete().eq('id', id).select();
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          alert("⚠️ BLOQUEIO DO SUPABASE!\nVocê precisa ir no SQL Editor do Supabase e rodar o comando para liberar a exclusão (RLS).");
        } else {
          alert("Inscrição excluída permanentemente com sucesso!");
          fecharModal();
        }
        await carregarDados();
      } catch (error: any) {
        alert("Erro no banco: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const iniciarEdicao = () => {
    setNovoComprovante(null); 
    setDadosEditados({
      ...analisando,
      participantes: analisando.participantes ? [...analisando.participantes] : []
    });
    setModoEdicao(true);
  };

  const salvarEdicao = async () => {
    setSalvandoEdicao(true);
    try {
      let urlComprovanteFinal = dadosEditados.comprovante_url;

      if (novoComprovante) {
        const fileExt = novoComprovante.name.split('.').pop();
        const fileName = `admin_edit_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(fileName, novoComprovante, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error("Erro no upload do comprovante: " + uploadError.message);
        urlComprovanteFinal = fileName;
      }

      const { error: erroInscricao } = await supabase
        .from('inscricoes')
        .update({
          nome_titular: dadosEditados.nome_titular,
          sexo: dadosEditados.sexo,
          telefone: dadosEditados.telefone,
          email: dadosEditados.email,
          igreja: dadosEditados.igreja,
          outra_igreja: dadosEditados.outra_igreja,
          valor_total: Number(dadosEditados.valor_total),
          forma_pagamento: dadosEditados.forma_pagamento, 
          comprovante_url: urlComprovanteFinal            
        })
        .eq('id', dadosEditados.id);

      if (erroInscricao) throw erroInscricao;

      await supabase.from('participantes').delete().eq('inscricao_id', dadosEditados.id);
      
      if (dadosEditados.participantes.length > 0) {
        const novosParticipantes = dadosEditados.participantes.map((p: any) => ({
          inscricao_id: dadosEditados.id,
          nome_completo: p.nome_completo,
          sexo: p.sexo || 'Masculino'
        }));
        const { error: erroPart } = await supabase.from('participantes').insert(novosParticipantes);
        if (erroPart) throw erroPart;
      }

      alert("Dados atualizados com sucesso!");
      
      const { data } = await supabase.from('inscricoes').select('*, participantes(*)').eq('id', dadosEditados.id).single();
      setAnalisando(data);
      setModoEdicao(false);
      setNovoComprovante(null);
      await carregarDados(); 

    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleParticipanteEdit = (index: number, campo: string, valor: string) => {
    const copia = [...dadosEditados.participantes];
    copia[index][campo] = valor;
    setDadosEditados({ ...dadosEditados, participantes: copia });
  };

  const adicionarParticipante = (e: React.MouseEvent) => {
    e.preventDefault();
    const copiaNova = [...(dadosEditados.participantes || []), { nome_completo: '', sexo: 'Masculino' }];
    setDadosEditados({ ...dadosEditados, participantes: copiaNova });
  };

  const removerParticipante = (e: React.MouseEvent, indexToRemove: number) => {
    e.preventDefault();
    const copiaRemovida = [...dadosEditados.participantes];
    copiaRemovida.splice(indexToRemove, 1); 
    setDadosEditados({ ...dadosEditados, participantes: copiaRemovida });
  };

  const fecharModal = () => {
    setAnalisando(null);
    setModoEdicao(false);
    setNovoComprovante(null);
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

  // --- MATEMÁTICA CORRIGIDA E ADAPTADA PARA O 2º LOTE ---
  const totalPessoasAbsoluto = inscricoes
    .filter(i => i.status_pagamento === 'confirmado')
    .reduce((acc, curr) => acc + 1 + (curr.participantes?.length || 0), 0);
  
  // Zera os 302 do primeiro lote (se por algum motivo tiver menos de 302 confirmados, evita ficar negativo com o Math.max)
  const totalPessoasLote2 = Math.max(0, totalPessoasAbsoluto - INSCRITOS_LOTE_1);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">Gestão Fé Reformada</h1>
            <p className="text-gray-600 font-medium">Painel Administrativo da Conferência.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={exportarXLSX} className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-green-600 rounded-xl text-sm font-black text-green-700 hover:bg-green-50 transition-colors shadow-sm">
              <Download size={18} strokeWidth={3} /> Exportar Excel
            </button>
            <button type="button" onClick={handleLogout} className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-black hover:bg-red-100 transition-all border-2 border-red-100">
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
                <p className="text-sm text-gray-600 font-bold uppercase tracking-wider mb-1">Ocupação (2º Lote)</p>
                <p className="text-3xl font-black text-black">{totalPessoasLote2} / {LIMITE_LOTE_ATUAL}</p>
              </div>
            </div>
            {/* Barra de progresso baseada apenas no 2º Lote */}
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full" style={{ width: `${(totalPessoasLote2 / LIMITE_LOTE_ATUAL) * 100}%` }}></div>
            </div>
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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input 
                  value={filtro} onChange={e => setFiltro(e.target.value)} 
                  placeholder="Pesquisar por nome do titular..." 
                  className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-base font-bold text-black placeholder-gray-500 focus:outline-none focus:border-black focus:ring-4 focus:ring-gray-200 transition-all" 
                />
              </div>
              <div className="flex bg-gray-200 p-1.5 rounded-xl w-full md:w-auto">
                <button type="button" onClick={() => setStatusFiltro('todos')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'todos' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}>Todos</button>
                <button type="button" onClick={() => setStatusFiltro('pendente')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'pendente' ? 'bg-orange-100 text-orange-800 shadow-sm' : 'text-gray-500 hover:text-black'}`}>Pendentes</button>
                <button type="button" onClick={() => setStatusFiltro('confirmado')} className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-black rounded-lg transition-all ${statusFiltro === 'confirmado' ? 'bg-green-100 text-green-800 shadow-sm' : 'text-gray-500 hover:text-black'}`}>Confirmados</button>
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
                  <td className="px-8 py-5 text-right"><button type="button" onClick={() => setAnalisando(i)} className="px-6 py-2.5 bg-black text-white text-sm font-black rounded-xl hover:bg-blue-700 transition-all shadow-md">Analisar</button></td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={4} className="px-8 py-12 text-center text-gray-500 font-bold text-lg">Nenhuma inscrição encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {analisando && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-6xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[90vh]">
            
            <div className="w-full md:w-3/5 bg-gray-100 flex items-center justify-center p-4 border-r-2 overflow-hidden relative">
              {novoComprovante && (
                <div className="absolute top-4 left-4 right-4 bg-green-100 border-2 border-green-500 text-green-800 font-black p-3 rounded-xl shadow-lg z-10 text-center">
                  ✅ Novo comprovante selecionado e pronto para envio. Salve as alterações!
                </div>
              )}
              
              {analisando.comprovante_url ? (
                analisando.comprovante_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprovantes/${analisando.comprovante_url}`} className={`w-full h-full rounded-2xl shadow-lg border-none bg-white ${novoComprovante ? 'opacity-30' : ''}`} title="PDF" />
                ) : (
                  <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprovantes/${analisando.comprovante_url}`} className={`max-h-full max-w-full object-contain rounded-2xl shadow-lg ${novoComprovante ? 'opacity-30' : ''}`} alt="Comprovante" />
                )
              ) : (
                <div className="text-center text-gray-500 p-10"><Eye size={56} className="mx-auto mb-4 opacity-40" /><p className="font-black text-xl text-black">Inscrição via Cartão / Dinheiro</p><p className="text-sm">Não há comprovante digital original.</p></div>
              )}
            </div>

            <div className="w-full md:w-2/5 p-10 overflow-y-auto bg-white flex flex-col">
              
              <div className="flex justify-between items-center mb-8 pb-4 border-b-2">
                <h2 className="text-3xl font-black text-black">
                  {modoEdicao ? 'Editando Dados' : 'Dossiê de Inscrição'}
                </h2>
                <div className="flex gap-2">
                  {!modoEdicao && (
                    <button type="button" onClick={iniciarEdicao} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-all border border-blue-200" title="Editar Ficha">
                      <Edit size={20} strokeWidth={3} />
                    </button>
                  )}
                  <button type="button" onClick={fecharModal} className="p-2 bg-gray-100 rounded-full hover:bg-red-100 hover:text-red-600 transition-all text-gray-600 border border-gray-200">
                    <X size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>

              {modoEdicao ? (
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase">Nome do Titular</label>
                    <input type="text" value={dadosEditados.nome_titular} onChange={e => setDadosEditados({...dadosEditados, nome_titular: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-gray-50 rounded-xl text-lg font-black text-black focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                  </div>
                  
                  <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-xl space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-black text-orange-800 uppercase">Forma Pagamento</label>
                        <select 
                          value={dadosEditados.forma_pagamento || 'PIX'} 
                          onChange={e => setDadosEditados({...dadosEditados, forma_pagamento: e.target.value})} 
                          className="w-full p-3 border-2 border-gray-400 bg-white rounded-xl font-black text-black focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="PIX">PIX</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Dinheiro">Dinheiro Físico</option>
                          <option value="Isento">Isento/Cortesia</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black text-orange-800 uppercase">Valor Total (R$)</label>
                        <input type="number" value={dadosEditados.valor_total} onChange={e => setDadosEditados({...dadosEditados, valor_total: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-white rounded-xl font-black text-green-800 focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-black text-orange-800 uppercase">Anexar Novo Comprovante</label>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={e => {
                          if (e.target.files && e.target.files.length > 0) {
                            setNovoComprovante(e.target.files[0]);
                          }
                        }}
                        className="w-full mt-1 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer text-sm font-bold text-gray-700 border-2 border-gray-400 rounded-xl bg-white p-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black text-gray-500 uppercase">Telefone</label>
                      <input type="text" value={dadosEditados.telefone} onChange={e => setDadosEditados({...dadosEditados, telefone: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-gray-50 rounded-xl font-black text-black focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-black text-gray-500 uppercase">Igreja</label>
                      <input type="text" value={dadosEditados.igreja} onChange={e => setDadosEditados({...dadosEditados, igreja: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-gray-50 rounded-xl font-black text-black focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-500 uppercase">E-mail</label>
                    <input type="email" value={dadosEditados.email} onChange={e => setDadosEditados({...dadosEditados, email: e.target.value})} className="w-full p-3 border-2 border-gray-400 bg-gray-50 rounded-xl font-bold text-black focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                  </div>

                  <div className="mt-6 p-4 border-2 border-blue-300 rounded-xl bg-blue-50">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-black text-blue-900 uppercase">Acompanhantes</p>
                      <button type="button" onClick={adicionarParticipante} className="flex items-center gap-1 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-800 shadow-sm"><Plus size={14}/> Adicionar</button>
                    </div>
                    
                    {dadosEditados.participantes.map((p: any, idx: number) => (
                      <div key={idx} className="flex gap-2 mb-3 bg-white p-2 rounded-xl border-2 border-gray-300 shadow-sm">
                        <input type="text" placeholder="Nome Completo" value={p.nome_completo} onChange={e => handleParticipanteEdit(idx, 'nome_completo', e.target.value)} className="flex-1 p-2 bg-gray-50 border border-gray-400 rounded-lg text-base font-black text-black focus:border-blue-600 focus:outline-none" />
                        <select value={p.sexo} onChange={e => handleParticipanteEdit(idx, 'sexo', e.target.value)} className="p-2 bg-gray-50 border border-gray-400 rounded-lg text-sm font-bold text-black focus:border-blue-600 focus:outline-none">
                          <option value="Masculino">Masc</option>
                          <option value="Feminino">Fem</option>
                        </select>
                        <button type="button" onClick={(e) => removerParticipante(e, idx)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"><Trash2 size={18}/></button>
                      </div>
                    ))}
                    {dadosEditados.participantes.length === 0 && <p className="text-xs text-blue-700 font-bold italic">Nenhum acompanhante adicionado.</p>}
                  </div>

                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => {setModoEdicao(false); setNovoComprovante(null);}} className="flex-1 py-3 bg-gray-300 text-gray-900 font-black rounded-xl hover:bg-gray-400 transition-colors">Cancelar</button>
                    <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao} className="flex-1 py-3 bg-blue-700 text-white font-black rounded-xl hover:bg-blue-800 flex justify-center items-center gap-2 shadow-lg transition-colors">
                      {salvandoEdicao ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Alterações
                    </button>
                  </div>
                </div>
              ) : (
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

                  <div className="mt-8 space-y-3">
                    {analisando.status_pagamento === 'pendente' ? (
                      <button type="button" onClick={() => confirmarInscricao(analisando)} disabled={enviandoEmail} className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {enviandoEmail ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle size={24} strokeWidth={3} />} Aprovar e Disparar E-mail
                      </button>
                    ) : (
                      <button type="button" onClick={() => reenviarEmailApenas(analisando)} disabled={enviandoEmail} className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                        {enviandoEmail ? <Loader2 className="animate-spin" size={24} /> : <Mail size={24} strokeWidth={3} />} Reenviar Confirmação
                      </button>
                    )}
                    
                    <button 
                      type="button"
                      onClick={() => excluirInscricao(analisando.id)} 
                      className="w-full py-4 text-red-500 font-black text-xs uppercase tracking-widest hover:text-red-700 hover:bg-red-50 rounded-2xl transition-colors border border-transparent hover:border-red-100"
                    >
                      Excluir Inscrição Permanentemente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}