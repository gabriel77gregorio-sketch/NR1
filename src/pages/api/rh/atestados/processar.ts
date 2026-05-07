import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseClient = supabase({ request } as any);
    
    // Autenticação básica
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), { status: 401 });
    }
    
    const user = authData.user;
    
    // Obter dados do Form
    const formData = await request.formData();
    const arquivo = formData.get('arquivo') as File;
    
    if (!arquivo) {
      return new Response(JSON.stringify({ success: false, error: 'Nenhum arquivo enviado.' }), { status: 400 });
    }

    // 1. Pegar o empresa_id do RH
    const { data: perfil } = await supabaseClient
       .from('perfis_usuarios')
       .select('empresa_id')
       .eq('id', user.id)
       .single();
       
    if (!perfil) {
       return new Response(JSON.stringify({ success: false, error: 'Perfil não encontrado.' }), { status: 400 });
    }

    // 2. Fazer Upload para o Supabase Storage (Bucket "atestados")
    const fileExt = arquivo.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${perfil.empresa_id}/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
       .from('atestados')
       .upload(filePath, arquivo);

    if (uploadError) {
        console.error('Erro no upload Storage:', uploadError);
        return new Response(JSON.stringify({ success: false, error: 'Falha ao salvar arquivo no servidor.' }), { status: 500 });
    }

    // Gerar URL pública para visualização
    const { data: publicUrlData } = supabaseClient.storage
        .from('atestados')
        .getPublicUrl(filePath);

    // 3. Chamar a API do Gemini
    const arrayBuffer = await arquivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    
    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analise este atestado médico e extraia as seguintes informações em formato JSON estrito:
{
  "nome_paciente": "nome do paciente extraído",
  "data_emissao": "data no formato YYYY-MM-DD",
  "dias_afastamento": numero inteiro de dias de afastamento (se houver periodo, calcule o total. se nao houver ou não estiver claro, coloque 1),
  "cid_codigo": "codigo do CID (ex: J11), deixe vazio se nao tiver",
  "cid_descricao": "pesquise na sua base de conhecimento do CID-10 o nome oficial da doença para o código extraído e preencha obrigatoriamente (mesmo que o médico não tenha escrito no papel). Se não tiver CID, deixe vazio",
  "crm_medico": "CRM do medico com a UF (ex: CRM 12345/SP), deixe vazio se nao encontrar"
}
Retorne APENAS o JSON válido, sem formatação markdown ou crases.`;

    const imageParts = [
      {
        inlineData: {
          data: base64Data,
          mimeType: arquivo.type
        }
      }
    ];

    let dadosExtraidosIA: any = {};
    
    try {
      const result = await model.generateContent([prompt, ...imageParts]);
      const responseText = result.response.text();
      
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      dadosExtraidosIA = JSON.parse(jsonStr);
    } catch (iaError) {
      console.error('Erro na IA do Gemini:', iaError);
      return new Response(JSON.stringify({ success: false, error: 'Falha ao processar atestado com IA.' }), { status: 500 });
    }

    // 4. Buscar um colaborador pelo nome (Fuzzy Search simplificado ou exact match)
    // Se não encontrar, vincula a null (ficará como Desconhecido ou a revisar)
    let colaborador_id = null;
    if (dadosExtraidosIA.nome_paciente) {
      const { data: colabs } = await supabaseClient
         .from('colaboradores_base')
         .select('id, nome')
         .eq('empresa_id', perfil.empresa_id)
         .ilike('nome', `%${dadosExtraidosIA.nome_paciente}%`)
         .limit(1);

      if (colabs && colabs.length > 0) {
          colaborador_id = colabs[0].id;
      }
    }

    // O servidor agora não insere diretamente no banco. 
    // Apenas retorna os dados extraídos para o front-end exibir na tela de revisão.
    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Atestado processado pela IA. Aguardando revisão.',
        data: {
          ...dadosExtraidosIA,
          colaborador_id,
          arquivo_url: publicUrlData.publicUrl
        }
    }), { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno no servidor.' }), { status: 500 });
  }
}
