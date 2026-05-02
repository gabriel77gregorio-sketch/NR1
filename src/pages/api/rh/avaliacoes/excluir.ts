import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { AvaliacaoIndividualService } from '../../../../services/AvaliacaoIndividualService';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabaseClient = supabase({ request, cookies });
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID da avaliação não fornecido' }), { status: 400 });
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401 });
    }

    const { data: perfil } = await supabaseClient
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil) {
      return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), { status: 403 });
    }

    const service = new AvaliacaoIndividualService(supabaseClient, perfil.empresa_id);
    const success = await service.excluirAvaliacao(id);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Falha ao excluir avaliação' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Erro na API de exclusão de avaliação:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
