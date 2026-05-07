import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseClient = supabase({ request } as any);
    
    // Autenticação
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), { status: 401 });
    }
    
    const user = authData.user;
    const body = await request.json();
    
    if (!body.id) {
       return new Response(JSON.stringify({ success: false, error: 'ID não fornecido.' }), { status: 400 });
    }

    const { data: perfil } = await supabaseClient
       .from('perfis_usuarios')
       .select('empresa_id')
       .eq('id', user.id)
       .single();

    if (!perfil) {
       return new Response(JSON.stringify({ success: false, error: 'Perfil não encontrado.' }), { status: 400 });
    }

    // Deletar o atestado (garantindo que seja da empresa do usuário)
    const { error: deleteError } = await supabaseClient
       .from('atestados_medicos')
       .delete()
       .eq('id', body.id)
       .eq('empresa_id', perfil.empresa_id);

    if (deleteError) {
        console.error('Erro ao excluir atestado:', deleteError);
        return new Response(JSON.stringify({ success: false, error: 'Falha ao excluir.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno no servidor.' }), { status: 500 });
  }
}
