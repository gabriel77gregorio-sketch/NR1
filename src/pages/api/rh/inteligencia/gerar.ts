import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseClient = supabase({ request } as any);
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const body = await request.json();
    const { kpis } = body; // expect { denuncias, atestados, dias, avaliacoes, turnover }

    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Chave da API do Gemini não configurada nas variáveis de ambiente.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Você é um Consultor Sênior de RH e Compliance. Sua missão é analisar de forma rápida, preditiva e superficial os dados combinados da plataforma NR1.
Dados atuais da empresa:
- Denúncias Ativas: ${kpis.denuncias}
- Atestados Médicos (Últimos dias): ${kpis.atestados} atestados somando ${kpis.dias} dias de afastamento.
- Avaliações Psicossociais Respondidas: ${kpis.avaliacoes}
- Taxa de Turnover Estimada: ${kpis.turnover}%

Crie uma análise superficial do atual cenário da empresa e sugira planos de ação diretos e executáveis.
Responda EXATAMENTE E APENAS em formato JSON válido, contendo as seguintes chaves:
{
  "analise_cenario": "texto com a análise (1 parágrafo robusto)",
  "nivel_risco_geral": "Baixo, Médio ou Alto",
  "planos_acao": [
    {
      "titulo": "Título curto",
      "descricao": "O que fazer detalhadamente",
      "prioridade": "Alta, Média ou Baixa"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonResponse = JSON.parse(text);

    return new Response(JSON.stringify(jsonResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Erro ao gerar inteligência:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
