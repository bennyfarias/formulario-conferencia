import Formulario from '../components/Formulario';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          Inscrição da Fé Reformada
        </h1>
        <p className="mt-4 text-lg text-gray-500">
          Preencha os dados abaixo e garanta sua vaga.
        </p>
      </div>
      <Formulario />
    </main>
  );
}