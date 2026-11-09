'use client';

export default function AssinaturaPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Plano e Assinatura</h1>
      <p className="text-gray-600 mb-6">Gerencie o seu plano profissional e acesse os recursos do Impetus.</p>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-100 flex justify-between items-center">
        <div>
          <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
            Plano Ativo
          </span>
          <h2 className="text-xl font-semibold text-gray-800 mt-2">Personal Pro + Pack Visual</h2>
          <p className="text-sm text-gray-500 mt-1">Acesso ilimitado a alunos, fichas e acervo de GIFs.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          Gerir no Stripe
        </button>
      </div>
    </div>
  );
}
