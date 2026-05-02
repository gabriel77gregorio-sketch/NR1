import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { AdvertenciaService } from '../../../../services/AdvertenciaService';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabaseClient = supabase({ request, cookies });
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return new Response(JSON.stringify({ error: 'ID ou Status não fornecido' }), { status: 400 });
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

    const service = new AdvertenciaService(supabaseClient, perfil.empresa_id);
    const success = await service.atualizarStatus(id, status);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Falha ao atualizar advertência' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    console.error('Erro na API de advertências:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
