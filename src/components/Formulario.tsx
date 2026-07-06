'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, UploadCloud, CheckCircle2, Loader2, AlertCircle, Copy, FileCheck, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE = 1000000; // 1MB

// ==========================================
// CONFIGURAÇÃO DO LOTE EXTRA (20 VAGAS)
// ==========================================
const VAGAS_MAXIMAS_EXTRA = 20;
const VALOR_EXTRA = 80.00;
// Linha de corte: Conta APENAS as inscrições feitas a partir de hoje (05/07/2026)
const DATA_CORTE_LOTE_EXTRA = '2026-07-05T00:00:00.000Z'; 

const formSchema = z.object({
  nomeTitular: z.string().min(3, 'O nome deve ter pelo menos 3 letras.'),
  sexo: z.enum(['Masculino', 'Feminino'], { error: 'Selecione o sexo do titular.' }),
  email: z.string().email('Digite um email válido.'),
  telefone: z.string().min(10, 'Digite um telefone com DDD.'),
  igreja: z.enum(['PIPR', '2IPBV', '3IPBV', '4IPBV', '5IPBV', '6IPBV', 'IPRO', 'Outras']),
  outra_igreja: z.string().optional(),
  participantes: z.array(z.object({ 
    nome: z.string().min(3, 'Nome obrigatório.'),
    sexo: z.enum(['Masculino', 'Feminino'], { error: 'Selecione o sexo do acompanhante.' })
  })),
  formaPagamento: z.literal('pix'), // TRAVADO APENAS PARA PIX
  comprovante: z.any().optional(),
  
  aceite_lgpd: z.boolean().refine((val) => val === true, { message: 'Você precisa concordar com os termos.' }),
  aceite_imagem: z.boolean().refine((val) => val === true, { message: 'Você precisa concordar com o uso de imagem.' }),
}).refine((data) => {
  if (data.igreja === 'Outras' && (!data.outra_igreja || data.outra_igreja.trim() === '')) return false;
  return true;
}, { message: 'Por favor, informe o nome da sua igreja.', path: ['outra_igreja'] });

type FormData = z.infer<typeof formSchema>;

export default function Formulario() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [carregandoLote, setCarregandoLote] = useState(true);
  const [vagasEsgotadas, setVagasEsgotadas] = useState(false);

  useEffect(() => {
    async function verificarLoteExtra() {
      try {
        const { data, error } = await supabase.from('inscricoes')
          .select('participantes(id)')
          .gte('criado_em', DATA_CORTE_LOTE_EXTRA); // CONTA SÓ OS NOVOS

        if (error) throw error;

        let ocupadas = 0;
        data?.forEach(i => { ocupadas += 1 + (i.participantes?.length || 0); });

        // Se bater 20 ou mais, bloqueia a tela de todo mundo que tentar entrar
        if (ocupadas >= VAGAS_MAXIMAS_EXTRA) {
          setVagasEsgotadas(true);
        }
      } catch (error) {
        console.error("Erro ao verificar vagas extras:", error);
      } finally {
        setCarregandoLote(false);
      }
    }
    verificarLoteExtra();
  }, []);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { igreja: 'PIPR', participantes: [], formaPagamento: 'pix', aceite_lgpd: false, aceite_imagem: false },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participantes' });
  
  const participantesAtuais = watch('participantes') || [];
  const igrejaSelecionada = watch('igreja');
  const comprovanteFile = watch('comprovante');
  const arquivoAnexado = comprovanteFile && comprovanteFile.length > 0 ? comprovanteFile[0] : null;
  const arquivoExcedeuLimite = arquivoAnexado && arquivoAnexado.size > MAX_FILE_SIZE;

  const valorTotal = (1 + participantesAtuais.length) * VALOR_EXTRA;

  const copiarChavePix = () => {
    navigator.clipboard.writeText('95981188644');
    alert('Chave PIX copiada com sucesso!');
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // ==========================================
      // TRAVA ANTI-OVERBOOKING NO CLIQUE (INQUEBRÁVEL)
      // ==========================================
      const { data: vagasData, error: countError } = await supabase.from('inscricoes')
        .select('participantes(id)').gte('criado_em', DATA_CORTE_LOTE_EXTRA);
      
      if (countError) throw new Error("Erro ao verificar vagas disponíveis.");
      
      let ocupadas = 0;
      vagasData?.forEach(i => { ocupadas += 1 + (i.participantes?.length || 0); });
      const vagasSolicitadas = 1 + data.participantes.length;

      // Se a soma do que já tem + o que a pessoa está tentando comprar passar de 20, barra na hora!
      if (ocupadas + vagasSolicitadas > VAGAS_MAXIMAS_EXTRA) {
        alert("⚠️ VAGAS ESGOTADAS! \n\nAs últimas vagas extras acabaram de ser preenchidas por outros usuários neste exato segundo.");
        window.location.reload(); 
        return;
      }

      const file = data.comprovante?.[0];
      if (!file) { alert("Por favor, anexe o comprovante (Foto ou PDF) do PIX."); setIsSubmitting(false); return; }
      if (file.size > MAX_FILE_SIZE) { alert("O arquivo é muito grande (Máx 1MB)."); setIsSubmitting(false); return; }

      const fileExt = file.name.split('.').pop();
      const filePath = `comprovantes/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('comprovantes').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: inscricao, error: inscricaoError } = await supabase.from('inscricoes').insert([{
        nome_titular: data.nomeTitular, sexo: data.sexo, email: data.email, telefone: data.telefone,
        igreja: data.igreja, outra_igreja: data.igreja === 'Outras' ? data.outra_igreja : null,
        forma_pagamento: 'pix', valor_total: valorTotal, comprovante_url: filePath, status_pagamento: 'pendente'
      }]).select().single();

      if (inscricaoError) throw inscricaoError;

      if (data.participantes.length > 0) {
        const pData = data.participantes.map(p => ({ inscricao_id: inscricao.id, nome_completo: p.nome, sexo: p.sexo }));
        const { error: pError } = await supabase.from('participantes').insert(pData);
        if (pError) throw pError;
      }

      setIsSuccess(true);
    } catch (error: any) { alert(`Ocorreu um erro: ${error.message}`); } finally { setIsSubmitting(false); }
  };

  if (carregandoLote) return <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-3xl shadow-sm border border-black text-center flex justify-center"><Loader2 className="w-16 h-16 text-black animate-spin" /></div>;
  if (vagasEsgotadas) return <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-3xl shadow-sm border border-black text-center"><Clock className="w-24 h-24 text-black mx-auto mb-6" /><h2 className="text-3xl font-black text-black">Vagas Esgotadas!</h2><p className="text-black font-bold mt-2">As 20 vagas do lote extra já foram preenchidas e as inscrições estão oficialmente encerradas.</p></div>;
  if (isSuccess) return <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-3xl shadow-sm border border-black text-center"><CheckCircle2 className="w-24 h-24 text-black mx-auto mb-6" /><h2 className="text-3xl font-black text-black">Inscrição Recebida!</h2><p className="text-black font-bold mt-2">Sua vaga extra foi pré-reservada e será confirmada após análise do PIX.</p></div>;

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border-2 border-black">
      <div className="mb-10 text-center">
        <span className="bg-gray-200 text-black font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest mb-3 inline-block">Lote Extra  (20 Vagas)</span>
        <h2 className="text-3xl font-black text-black tracking-tight">Garantir Vaga</h2>
        <p className="text-black font-bold mt-2">Preencha os dados abaixo com atenção.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
        
        <section>
          <h3 className="text-lg font-black text-black border-b-2 border-black pb-3 mb-6">1. Dados do Titular</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-black mb-1.5">Nome Completo</label>
              <input {...register('nomeTitular')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none" />
              {errors.nomeTitular && <p className="text-red-600 text-sm mt-1 font-bold">{errors.nomeTitular.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-black text-black mb-1.5">Sexo</label>
              <select defaultValue="" {...register('sexo')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none">
                <option value="" disabled>Selecione...</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
              {errors.sexo && <p className="text-red-600 text-sm mt-1 font-bold">{errors.sexo.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-black text-black mb-1.5">WhatsApp</label>
              <input {...register('telefone')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none" />
              {errors.telefone && <p className="text-red-600 text-sm mt-1 font-bold">{errors.telefone.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-black mb-1.5">Email</label>
              <input type="email" {...register('email')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none" />
              {errors.email && <p className="text-red-600 text-sm mt-1 font-bold">{errors.email.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-black mb-1.5">Igreja</label>
              <select {...register('igreja')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none">
                {['PIPR', '2IPBV', '3IPBV', '4IPBV', '5IPBV', '6IPBV', 'IPRO', 'Outras'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            {igrejaSelecionada === 'Outras' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-black text-black mb-1.5">Qual igreja?</label>
                <input {...register('outra_igreja')} className="w-full px-4 py-3 bg-gray-50 rounded-xl border-2 border-black text-black font-bold focus:border-black focus:ring-2 focus:ring-black outline-none" />
                {errors.outra_igreja && <p className="text-red-600 text-sm mt-1 font-bold">{errors.outra_igreja.message}</p>}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-6">
            <h3 className="text-lg font-black text-black">2. Acompanhantes</h3>
            <button type="button" onClick={() => append({ nome: '', sexo: undefined as any })} className="flex gap-2 text-sm text-black font-black hover:text-gray-700 bg-gray-200 px-3 py-1.5 rounded-lg border border-black"><Plus size={18}/> Adicionar</button>
          </div>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 border-2 border-black rounded-xl">
                <div className="w-full sm:flex-1">
                  <label className="block text-xs font-black text-black mb-1">NOME</label>
                  <input {...register(`participantes.${index}.nome` as const)} className="w-full px-4 py-2 border-2 border-black rounded-lg text-black font-bold" />
                  {errors.participantes?.[index]?.nome && <p className="text-red-600 text-xs mt-1 font-bold">{errors.participantes[index]?.nome?.message}</p>}
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-black text-black mb-1">SEXO</label>
                  <select defaultValue="" {...register(`participantes.${index}.sexo` as const)} className="w-full px-4 py-2 border-2 border-black rounded-lg text-black font-bold">
                    <option value="" disabled>Selecione</option>
                    <option value="Masculino">Masc</option>
                    <option value="Feminino">Fem</option>
                  </select>
                  {errors.participantes?.[index]?.sexo && <p className="text-red-600 text-xs mt-1 font-bold">{errors.participantes[index]?.sexo?.message}</p>}
                </div>
                <button type="button" onClick={() => remove(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg self-end mb-1 border-2 border-red-200"><Trash2 size={20}/></button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gray-100 p-6 rounded-2xl border-2 border-black">
          <h3 className="text-lg font-black text-black mb-6">3. Pagamento (Apenas PIX)</h3>
          
          <div className="flex justify-between items-center mb-6 bg-white p-5 rounded-xl border-2 border-black shadow-sm">
            <div>
              <p className="text-sm text-black font-black">Total Ingressos</p>
              <p className="text-xl font-black text-black">{1 + participantesAtuais.length}x <span className="text-sm font-bold text-black">(R$ {VALOR_EXTRA},00)</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-black font-black mb-1">Valor Final</p>
              <p className="text-3xl font-black text-black">R$ {valorTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-sm mb-6">
            <h4 className="font-black text-black mb-4 text-center md:text-left text-lg">Dados para Transferência</h4>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-100 p-4 rounded-xl border-2 border-black gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase font-black text-black">Chave PIX (Celular)</p>
                <p className="font-black text-xl text-black tracking-wide">95 98118-8644</p>
              </div>
              <button type="button" onClick={copiarChavePix} className="p-3 bg-black hover:bg-gray-800 text-white rounded-lg font-black text-sm flex gap-2"><Copy size={16} /> Copiar</button>
            </div>
            <p className="text-sm text-black font-black text-center">Titular: Segunda Igreja Presbiteriana de Boa Vista</p>
          </div>
          
          <div className={`border-2 border-black border-dashed rounded-2xl p-8 text-center transition-all ${arquivoExcedeuLimite ? 'bg-red-50' : arquivoAnexado ? 'bg-green-50 border-solid border-black' : 'bg-white'}`}>
            <UploadCloud className={`w-12 h-12 mx-auto mb-3 text-black ${arquivoAnexado ? 'hidden' : ''}`} />
            {arquivoAnexado && <FileCheck className="w-12 h-12 text-black mx-auto mb-3" />}
            <p className="text-sm font-black text-black mb-4">{arquivoAnexado ? arquivoAnexado.name : 'Anexe o comprovante do PIX (Máx 1MB)'}</p>
            <input type="file" id="comp" accept="image/*,application/pdf" className="hidden" {...register('comprovante')} />
            <label htmlFor="comp" className="inline-block px-6 py-3 font-black text-sm rounded-xl cursor-pointer bg-black text-white hover:bg-gray-800 border-2 border-black">Escolher Arquivo</label>
            {errors.comprovante && <p className="text-red-600 text-sm mt-3 font-bold">{errors.comprovante.message as string}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <label className="flex items-start gap-3 p-4 bg-gray-50 border-2 border-black rounded-xl cursor-pointer">
            <input type="checkbox" {...register('aceite_lgpd')} className="mt-1 w-5 h-5 text-black border-2 border-black accent-black" />
            <span className="text-sm font-black text-black">Concordo com o uso dos meus dados para a inscrição (LGPD).</span>
          </label>
          <label className="flex items-start gap-3 p-4 bg-gray-50 border-2 border-black rounded-xl cursor-pointer">
            <input type="checkbox" {...register('aceite_imagem')} className="mt-1 w-5 h-5 text-black border-2 border-black accent-black" />
            <span className="text-sm font-black text-black">Concordo com o uso da minha imagem nos registros do evento.</span>
          </label>
        </section>

        <button type="submit" disabled={isSubmitting || arquivoExcedeuLimite} className="w-full py-4 bg-black text-white text-lg font-black rounded-2xl flex justify-center gap-3 disabled:opacity-70">
          {isSubmitting ? <Loader2 className="animate-spin" /> : 'Confirmar Inscrição Extra'}
        </button>
      </form>
    </div>
  );
}