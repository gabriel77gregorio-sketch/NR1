import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { PlanoAcaoService } from '../../../../services/PlanoAcaoService';

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID do plano não fornecido' }), { status: 400 });
  }

  const supabaseClient = supabase(context);
  const planoService = new PlanoAcaoService(supabaseClient);

  try {
    const body = await context.request.json();
    const { acao, proximo_responsavel_id, descricao } = body;

    if (!acao || !descricao) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400 });
    }

    const result = await planoService.atualizarProgresso(id, {
      acao,
      proximo_responsavel_id,
      descricao
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Erro ao atualizar plano:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
