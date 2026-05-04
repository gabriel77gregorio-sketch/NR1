import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { supabase } from '../../../lib/supabase';

// Inicializa Resend
const resend = new Resend(import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { metodologia, dataDisparo, mensagem, cicloId, setorId, canal } = body;

    // 1. Validar sessão usando a lib centralizada
    const supabaseClient = supabase({ request, cookies });
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401 });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: perfil } = await supabaseAdmin.from('perfis_usuarios').select('empresa_id, nome').eq('id', user.id).single();

    if (!perfil) return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), { status: 403 });

    // 2. Garantir que a metodologia existe para poder criar a campanha
    let { data: met } = await supabaseAdmin.from('metodologias_pesquisa').select('id').eq('nome', metodologia).single();
    if (!met) {
      const { data: newMet } = await supabaseAdmin.from('metodologias_pesquisa').insert({
        nome: metodologia,
        descricao: `Metodologia ${metodologia} auto-criada no primeiro disparo.`
      }).select('id').single();
      met = newMet;
    }

    // 3. Criar a campanha principal (Disparo)
    const { data: campanha, error: campErr } = await supabaseAdmin.from('campanhas_pesquisa').insert({
      empresa_id: perfil.empresa_id,
      metodologia_id: met!.id,
      ciclo_id: cicloId,
      titulo: `Avaliação Psicossocial (${metodologia}) - ${new Date().toLocaleDateString('pt-BR')}`,
      conteudo_email: mensagem || 'Participe da nossa avaliação.',
      data_programada: dataDisparo || new Date().toISOString(),
      status: 'Em Andamento'
    }).select().single();

    if (campErr) throw new Error('Erro ao criar campanha: ' + campErr.message);

    // 4. Buscar colaboradores aptos para receber os e-mails (Filtrar por setor se solicitado)
    let queryColab = supabaseAdmin.from('colaboradores_base').select('id, nome, email').eq('empresa_id', perfil.empresa_id);
    
    if (setorId) {
      queryColab = queryColab.eq('departamento_id', setorId);
    }
    
    const { data: colaboradores } = await queryColab;
    
    if (!colaboradores || colaboradores.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum funcionário encontrado no setor selecionado!' }), { status: 400 });
    }

    // 5. Associar participantes gerando Tokens (A própria tabela gera o UUID default=uuid_generate_v4())
    const insertPayload = colaboradores.map(c => ({
      campanha_id: campanha.id,
      colaborador_id: c.id,
      status_resposta: 'Pendente'
    }));

    const { data: participantes, error: partErr } = await supabaseAdmin.from('campanhas_participantes')
      .insert(insertPayload).select('id, token_acesso, colaborador_id');

    if (partErr) throw new Error('Falha ao associar colaboradores: ' + partErr.message);

    if (canal === 'whatsapp') {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Tokens gerados com sucesso! Os links individuais estão prontos para envio via WhatsApp.',
        count: participantes.length
      }));
    }

    // 6. Preparar disparos de e-mail (Iterar e acionar a API Resend com BATCH ou FOR)
    // Cruzando e-mail do colaborador com o token gerado:
    const emailsToSend = colaboradores.map(c => {
      const part = participantes.find(p => p.colaborador_id === c.id);
      // Detecção dinâmica da URL base (Vercel ou Local)
      let hostUrl = new URL(request.url).origin;
      if (hostUrl.includes('localhost') && process.env.VERCEL_URL) {
        hostUrl = `https://${process.env.VERCEL_URL}`;
      }
      
      const urlPesquisa = `${hostUrl}/responder/${part?.token_acesso || ''}`;
      
      return {
        from: 'NR1 Saúde e Segurança <onboarding@resend.dev>', // Modifique para o domínio autenticado no Resend da Empresa posteriormente
        to: c.email,
        subject: `[Confidencial] ${campanha.titulo}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #2e6bb8;">Olá, ${c.nome}!</h2>
            <p>${mensagem.replace(/\n/g, '<br>')}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <div style="text-align: center; margin-top: 30px;">
              <a href="${urlPesquisa}" style="background-color: #2e6bb8; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Iniciar Avaliação Confidencial</a>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">
               O link fornecido é único, intransferível e expirará assim que for respondido. Suas respostas são anônimas para a diretoria, garantindo privacidade e segurança.
            </p>
          </div>
        `
      };
    });

    // Enviar via resend.batch (Resend permite até 100 emails por requisição na API BATCH)
    const { data: resendData, error: resendError } = await resend.batch.send(emailsToSend);

    if (resendError) {
      console.error('Erro detalhado do Resend:', resendError);
      throw new Error(`Falha no provedor de e-mail: ${resendError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Campanha e Tokens gerados! Disparo em lote via E-mail executado com sucesso.',
      resendData: resendData,
      count: participantes.length
    }));

  } catch (err: any) {
    console.error('Erro no disparo:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
