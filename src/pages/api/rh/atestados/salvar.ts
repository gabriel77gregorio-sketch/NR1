import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseClient = supabase({ request } as any);
    
    // Autenticação básica
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), { status: 401 });
    }
    
    const user = authData.user;
    
    const body = await request.json();
    
    const { data: perfil } = await supabaseClient
       .from('perfis_usuarios')
       .select('empresa_id')
       .eq('id', user.id)
       .single();
       
    if (!perfil) {
       return new Response(JSON.stringify({ success: false, error: 'Perfil não encontrado.' }), { status: 400 });
    }

    const { error: insertError } = await supabaseClient
       .from('atestados_medicos')
       .insert({
           empresa_id: perfil.empresa_id,
           colaborador_id: body.colaborador_id || null,
           arquivo_url: body.arquivo_url,
           data_emissao: body.data_emissao || null,
           dias_afastamento: body.dias_afastamento ? parseInt(body.dias_afastamento) : 1,
           cid_codigo: body.cid_codigo || '',
           cid_descricao: body.cid_descricao || '',
           crm_medico: body.crm_medico || '',
           status: 'concluido'
       });

    if (insertError) {
        console.error('Erro ao inserir atestado revisado:', insertError);
        return new Response(JSON.stringify({ success: false, error: 'Falha ao salvar no banco de dados.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno no servidor.' }), { status: 500 });
  }
}
