import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  
  if (!id) {
    return new Response(JSON.stringify({ error: 'ID do plano não fornecido' }), { status: 400 });
  }

  const supabaseClient = supabase(context);

  try {
    // 1. Buscar histórico do plano de ação
    const { data: historico, error: errHist } = await supabaseClient
      .from('historico_planos_acao')
      .select('*')
      .eq('plano_id', id)
      .order('created_at', { ascending: true });

    if (errHist) {
      console.error('Erro ao buscar histórico:', errHist);
      throw errHist;
    }

    if (!historico || historico.length === 0) {
      return new Response(JSON.stringify([]), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Resolver nomes dos responsáveis (pode ser perfil de usuário ou colaborador base)
    const ids = historico.map(h => h.responsavel_id).filter(Boolean);
    
    let namesMap: Record<string, string> = {};
    
    if (ids.length > 0) {
      const [{ data: perfis }, { data: colaboradores }] = await Promise.all([
        supabaseClient.from('perfis_usuarios').select('id, nome').in('id', ids),
        supabaseClient.from('colaboradores_base').select('id, nome').in('id', ids)
      ]);

      perfis?.forEach(p => { namesMap[p.id] = p.nome; });
      colaboradores?.forEach(c => { namesMap[c.id] = c.nome; });
    }

    // 3. Formatar resposta para o front-end
    const result = historico.map(h => ({
      id: h.id,
      created_at: h.created_at,
      responsavel_nome: h.responsavel_id ? (namesMap[h.responsavel_id] || 'Responsável não identificado') : 'Sistema',
      descricao: h.descricao,
      data_prevista_checkpoint: h.data_prevista_checkpoint,
      status: h.status
    }));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Erro na API de histórico:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
