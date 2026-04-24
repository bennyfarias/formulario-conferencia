'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, UploadCloud, CheckCircle2, Loader2, AlertCircle, Copy } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_FILE_SIZE = 1000000; // 1MB

// Adicionado 'sexo' na validação do titular e dos participantes
c// Substitua o schema antigo por este:
const formSchema = z.object({
  nomeTitular: z.string().min(3, 'O nome deve ter pelo menos 3 letras.'),
  sexo: z.enum(['Masculino', 'Feminino'], { 
    required_error: 'Selecione o sexo do titular.',
    invalid_type_error: 'Selecione o sexo do titular.'
  }),
  email: z.string().email('Digite um email válido.'),
  telefone: z.string().min(10, 'Digite um telefone com DDD.'),
  igreja: z.enum(['PIPR', '2IPBV', '3IPBV', '4IPBV', '5IPBV', '6IPBV', 'IPRO', 'Outras']),
  outra_igreja: z.string().optional(),
  participantes: z.array(z.object({ 
    nome: z.string().min(3, 'Nome obrigatório.'),
    sexo: z.enum(['Masculino', 'Feminino'], { 
      required_error: 'Selecione o sexo.',
      invalid_type_error: 'Selecione o sexo.'
    })
  })),
  formaPagamento: z.enum(['pix', 'cartao']),
  comprovante: z.any().optional(),
}).refine((data) => {
  if (data.igreja === 'Outras' && (!data.outra_igreja || data.outra_igreja.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Por favor, informe o nome da sua congregação.',
  path: ['outra_igreja'],
});

type FormData = z.infer<typeof formSchema>;
const VALOR_UNITARIO = 70.00;

export default function Formulario() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { igreja: 'PIPR', participantes: [], formaPagamento: 'pix' },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'participantes' });
  
  const formaPagamento = watch('formaPagamento');
  const participantesAtuais = watch('participantes') || [];
  const igrejaSelecionada = watch('igreja');
  
  const valorTotal = (1 + participantesAtuais.length) * VALOR_UNITARIO;

  const copiarChavePix = () => {
    navigator.clipboard.writeText('10964697000174');
    alert('Chave PIX copiada com sucesso!');
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      let comprovanteUrl = null;

      // 1. Upload do Comprovante (Apenas PIX)
      if (data.formaPagamento === 'pix') {
        const file = data.comprovante?.[0];
        if (!file) {
          alert("Por favor, anexe o comprovante (Foto ou PDF) do PIX.");
          setIsSubmitting(false);
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          alert("O arquivo é muito grande. O limite máximo é 1MB.");
          setIsSubmitting(false);
          return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `comprovantes/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('comprovantes')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        comprovanteUrl = filePath;
      }

      // 2. Inserir Titular no banco de dados
      const { data: inscricao, error: inscricaoError } = await supabase
        .from('inscricoes')
        .insert([{
          nome_titular: data.nomeTitular,
          sexo: data.sexo, // <- Novo campo enviado ao Supabase
          email: data.email,
          telefone: data.telefone,
          igreja: data.igreja,
          outra_igreja: data.igreja === 'Outras' ? data.outra_igreja : null,
          forma_pagamento: data.formaPagamento,
          valor_total: valorTotal,
          comprovante_url: comprovanteUrl,
          status_pagamento: 'pendente'
        }])
        .select()
        .single();

      if (inscricaoError) throw inscricaoError;

      // 3. Inserir Participantes no banco de dados
      if (data.participantes.length > 0) {
        const pData = data.participantes.map(p => ({
          inscricao_id: inscricao.id,
          nome_completo: p.nome,
          sexo: p.sexo // <- Novo campo enviado ao Supabase
        }));
        const { error: pError } = await supabase.from('participantes').insert(pData);
        if (pError) throw pError;
      }

      setIsSuccess(true);
    } catch (error: any) {
      alert(`Ocorreu um erro: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-900 text-center animate-in fade-in duration-500">
        <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Pré-reserva Realizada!</h2>
        <p className="text-gray-500 text-lg">
          Seus dados foram recebidos. Sua inscrição será confirmada oficialmente no sistema após a validação do pagamento.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-gray-100">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Garantir Vaga</h2>
        <p className="text-gray-500 mt-2">Preencha os dados abaixo com atenção.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
        
        {/* BLOCO 1: DADOS PESSOAIS */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 border-b-2 border-gray-100 pb-3 mb-6">1. Dados do Titular</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Nome Completo</label>
              <input 
                {...register('nomeTitular')} 
                className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all" 
              />
              {errors.nomeTitular && <p className="text-red-500 text-sm mt-1.5 font-medium">{errors.nomeTitular.message}</p>}
            </div>

            {/* NOVO CAMPO: Sexo do Titular */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Sexo</label>
              <select 
                defaultValue=""
                {...register('sexo')} 
                className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white transition-all"
              >
                <option value="" disabled className="text-gray-400">Selecione...</option>
                <option value="Masculino" className="text-gray-900">Masculino</option>
                <option value="Feminino" className="text-gray-900">Feminino</option>
              </select>
              {errors.sexo && <p className="text-red-500 text-sm mt-1.5 font-medium">{errors.sexo.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Telefone (WhatsApp)</label>
              <input 
                {...register('telefone')} 
                className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all" 
              />
              {errors.telefone && <p className="text-red-500 text-sm mt-1.5 font-medium">{errors.telefone.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Email</label>
              <input 
                type="email" 
                {...register('email')} 
                className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all" 
              />
              {errors.email && <p className="text-red-500 text-sm mt-1.5 font-medium">{errors.email.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Congregação</label>
              <select 
                {...register('igreja')} 
                className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white transition-all"
              >
                {['PIPR', '2IPBV', '3IPBV', '4IPBV', '5IPBV', '6IPBV', 'IPRO', 'Outras'].map(i => (
                  <option key={i} value={i} className="text-gray-900 bg-white">{i}</option>
                ))}
              </select>
            </div>
            
            {igrejaSelecionada === 'Outras' && (
              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-bold text-blue-800 mb-1.5">Qual é a sua igreja?</label>
                <input 
                  {...register('outra_igreja')} 
                  placeholder="Digite o nome da sua congregação"
                  className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all" 
                />
                {errors.outra_igreja && <p className="text-red-500 text-sm mt-1.5 font-medium">{errors.outra_igreja.message}</p>}
              </div>
            )}
          </div>
        </section>

        {/* BLOCO 2: ACOMPANHANTES */}
        <section>
          <div className="flex justify-between items-center border-b-2 border-gray-100 pb-3 mb-6">
            <h3 className="text-lg font-semibold text-gray-900">2. Inscrições Adicionais</h3>
            <button 
              type="button" 
              // Garante que o novo participante comece com o campo sexo vazio para forçar validação
              onClick={() => append({ nome: '', sexo: undefined as any })} 
              className="flex items-center gap-2 text-sm text-blue-600 font-bold hover:text-blue-800 transition-colors"
            >
              <Plus size={18}/> Adicionar
            </button>
          </div>
          
          {fields.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              Apenas o titular será inscrito. Clique em adicionar se quiser levar mais pessoas.
            </p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                
                <div className="w-full sm:flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Nome</label>
                  <input 
                    {...register(`participantes.${index}.nome` as const)} 
                    className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all" 
                    placeholder={`Nome completo do acompanhante ${index + 1}`} 
                  />
                  {errors.participantes?.[index]?.nome && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.participantes[index]?.nome?.message}</p>}
                </div>

                {/* NOVO CAMPO: Sexo do Participante */}
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wider">Sexo</label>
                  <select 
                    defaultValue=""
                    {...register(`participantes.${index}.sexo` as const)} 
                    className="w-full px-4 py-3 text-gray-900 rounded-xl border-2 border-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white transition-all"
                  >
                    <option value="" disabled className="text-gray-400">Selecione...</option>
                    <option value="Masculino" className="text-gray-900">Masculino</option>
                    <option value="Feminino" className="text-gray-900">Feminino</option>
                  </select>
                  {errors.participantes?.[index]?.sexo && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.participantes[index]?.sexo?.message}</p>}
                </div>

                <button 
                  type="button" 
                  onClick={() => remove(index)} 
                  className="p-3 text-red-500 border-2 border-red-200 hover:bg-red-50 hover:border-red-500 rounded-xl transition-all self-end sm:mb-[2px] mt-2 sm:mt-0"
                >
                  <Trash2 size={20}/>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCO 3: PAGAMENTO (INALTERADO) */}
        <section className="bg-slate-50 p-6 md:p-8 rounded-2xl border-2 border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">3. Pagamento</h3>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white p-5 rounded-xl border-2 border-gray-900 shadow-sm">
            <div>
              <p className="text-sm text-gray-600 font-bold mb-1">Total de Ingressos</p>
              <p className="text-xl font-black text-gray-900">{1 + participantesAtuais.length}x</p>
            </div>
            <div className="mt-4 md:mt-0 md:text-right">
              <p className="text-sm text-gray-600 font-bold mb-1">Valor Final</p>
              <p className="text-3xl font-black text-green-700">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <label className="block text-sm font-bold text-gray-900">Forma de Pagamento</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formaPagamento === 'pix' ? 'border-blue-600 bg-blue-50' : 'border-gray-900 bg-white hover:bg-gray-50'}`}>
                <input type="radio" value="pix" {...register('formaPagamento')} className="w-5 h-5 text-blue-600 border-gray-900" />
                <span className="font-bold text-gray-900">Pix (Manual)</span>
              </label>
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formaPagamento === 'cartao' ? 'border-blue-600 bg-blue-50' : 'border-gray-900 bg-white hover:bg-gray-50'}`}>
                <input type="radio" value="cartao" {...register('formaPagamento')} className="w-5 h-5 text-blue-600 border-gray-900" />
                <span className="font-bold text-gray-900">Cartão de Crédito</span>
              </label>
            </div>
          </div>

          {/* ÁREA CONDICIONAL: PIX (DADOS, QR CODE E UPLOAD) */}
          {formaPagamento === 'pix' && (
            <div className="mt-6 space-y-6 animate-in fade-in duration-300">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
                <div className="shrink-0 bg-white p-3 rounded-2xl shadow-sm border-2 border-blue-200 flex flex-col items-center">
                  <img src="/qrcode.jpg" alt="QR Code PIX" className="w-36 h-36 object-contain mb-2" />
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Escaneie Aqui</p>
                </div>
                <div className="flex-1 w-full">
                  <h4 className="font-black text-blue-900 mb-4 text-lg text-center md:text-left">Dados para Transferência</h4>
                  <div className="space-y-3 text-sm text-blue-800">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-3.5 rounded-xl border-2 border-blue-200 gap-3">
                      <div>
                        <p className="text-[10px] uppercase font-black text-blue-500 mb-0.5">Chave PIX (CNPJ)</p>
                        <p className="font-black text-lg text-blue-900 tracking-wide">10.964.697/0001-74</p>
                      </div>
                      <button type="button" onClick={copiarChavePix} className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                        <Copy size={14} /> Copiar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-3.5 rounded-xl border-2 border-blue-200">
                        <p className="text-[10px] uppercase font-black text-blue-500 mb-0.5">Titular da Conta</p>
                        <p className="font-bold text-blue-900">Presbitério do Estado de Roraima</p>
                      </div>
                      <div className="bg-white p-3.5 rounded-xl border-2 border-blue-200">
                        <p className="text-[10px] uppercase font-black text-blue-500 mb-0.5">Agência e Conta</p>
                        <p className="font-bold text-blue-900">Ag: <span className="text-blue-700">0250</span> | CC: <span className="text-blue-700">137081-2</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-2 border-dashed border-gray-900 rounded-2xl p-8 text-center bg-white hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer">
                <UploadCloud className="w-12 h-12 text-gray-900 mx-auto mb-3" />
                <p className="text-sm text-gray-900 font-black mb-1">Passo 2: Anexe o comprovante do PIX</p>
                <p className="text-xs text-gray-500 mb-4 font-medium">Arquivos aceitos: Foto ou arquivo PDF (Máx 1MB)</p>
                <input type="file" id="comp" accept="image/*,application/pdf" className="hidden" {...register('comprovante')} />
                <label htmlFor="comp" className="inline-block px-6 py-3 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl cursor-pointer transition-colors shadow-sm">
                  Escolher Arquivo
                </label>
                {errors.comprovante && <p className="text-red-500 text-sm mt-3 font-bold">{errors.comprovante.message as string}</p>}
              </div>
            </div>
          )}

          {formaPagamento === 'cartao' && (
            <div className="mt-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-start gap-4 animate-in fade-in duration-300">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={24} />
              <div>
                <h4 className="font-black text-blue-900 mb-1">Pagamento Presencial</h4>
                <p className="text-sm text-blue-800 leading-relaxed font-medium">
                  Para pagamentos no cartão, por favor dirija-se à <strong>Segunda IPBV</strong>. 
                  Ao clicar em finalizar abaixo, sua vaga será pré-reservada. A inscrição só será oficializada no sistema após a confirmação do pagamento presencial.
                </p>
              </div>
            </div>
          )}
        </section>

        <button type="submit" disabled={isSubmitting} className="w-full py-4 px-6 bg-blue-700 hover:bg-blue-800 text-white text-lg font-black rounded-2xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-3">
          {isSubmitting ? <><Loader2 className="animate-spin"/> Registrando...</> : 'Finalizar Inscrição (Pré-Reserva)'}
        </button>
      </form>
    </div>
  );
}