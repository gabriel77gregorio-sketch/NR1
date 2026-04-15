import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { token, respostas } = body;

    if (!token || !respostas) {
      return new Response(JSON.stringify({ error: 'Token ou respostas ausentes.' }), { status: 400 });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    // Service Role: Isola a permissão publica global e insere no backend seguro.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Validar Token Existente e Não Consumido
    const { data: participante, error: partErr } = await supabaseAdmin.from('campanhas_participantes')
      .select('id, campanha_id, status_resposta, campanha:campanha_id(empresa_id, metodologia_id)')
      .eq('token_acesso', token)
      .single();

    if (partErr || !participante) {
      return new Response(JSON.stringify({ error: 'Link de pesquisa inválido ou não encontrado.' }), { status: 404 });
    }

    if (participante.status_resposta === 'Concluido' || participante.status_resposta === 'Concluído') {
      return new Response(JSON.stringify({ error: 'Esta pesquisa já foi respondida e o link foi bloqueado por segurança.' }), { status: 403 });
    }

    // 2. Inserir Respostas (Em uma tabela de Avaliações - vinculando a metodologia ou formulário se tiver)
    // Devido ao schema atual, vamos colocar em respostas_avaliacoes (Simulando um formulario virtual pela metodologia_id)
    const { error: insertErr } = await supabaseAdmin.from('respostas_avaliacoes').insert({
      empresa_id: participante.campanha.empresa_id,
      formulario_id: participante.campanha.metodologia_id, // Usamos metodologia como formulario por compatibilidade
      respostas: respostas
    });

    if (insertErr) {
      console.error(insertErr);
      throw new Error('Falha ao processar as respotas. Detalhes salvos em log.');
    }

    // 3. Invalidar o acesso futuro deste Token.
    const { error: uptErr } = await supabaseAdmin.from('campanhas_participantes')
      .update({ status_resposta: 'Concluído', respondido_em: new Date().toISOString() })
      .eq('token_acesso', token);

    if (uptErr) throw new Error('Não foi possível inativar o token. Repasse aos sysadmins!');

    return new Response(JSON.stringify({ success: true, message: 'Suas respostas foram enviadas com segurança.' }));

  } catch (err: any) {
    console.error('Erro submissão de pesquisa Server-Side:', err);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor de Segurança' }), { status: 500 });
  }
}
