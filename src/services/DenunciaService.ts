import { createClient } from '@supabase/supabase-js';

export interface NovaDenuncia {
  empresa_id: string; // The token or identified company UUID
  texto: string;
  identificacao?: string; // If 'Relato Identificado'
  tipo_violacao: string;
  data_ocorrido: string;
}

export class DenunciaService {
  // Inicializamos um cliente com a chave de administrador (Service Role)
  // pois o funcionário fazendo a denúncia do portal público NÃO TEM SESSÃO (é anônimo).
  // Apenas o servidor Next/Astro pode inserir a denúncia burlando o RLS com essa chave privada.
  private getSupabaseAdmin() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceKey = import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!serviceKey) {
      console.warn("ATENÇÃO: SUPABASE_SERVICE_KEY não configurada no lado do servidor (.env). Usando chave anon como fallback, o que vai falhar devido ao RLS de segurança.");
    }
    
    return createClient(url, serviceKey || import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
  }

  /**
   * Gera um protocolo de 8 caracteres alfanuméricos únicos.
   */
  private gerarProtocolo(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PROT-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Registra a denúncia na base de dados de maneira confidencial
   */
  async registrarDenuncia(dados: NovaDenuncia) {
    const db = this.getSupabaseAdmin();
    const protocolo = this.gerarProtocolo();

    // Formata o relato detalhado compilando as informações do formulário
    const relatoCompleto = `
[TIPO DE VIOLAÇÃO]: ${dados.tipo_violacao}
[QUANDO OCORREU]: ${dados.data_ocorrido}
[IDENTIFICAÇÃO]: ${dados.identificacao ? dados.identificacao : 'Anônima / Sigilo Total'}

[RELATO]:
${dados.texto}
======================
IP Removido. Metadata Limpo.
    `.trim();

    // Encontra o empresa_id baseando-se num nome ou slug 
    // (Na vida real, a URL já teria o ID, ex: /denuncia?c=UUID)
    let empresaAlvo = dados.empresa_id;
    
    // Se a empresa passada não for um UUID, busca no banco pelo nome
    if (empresaAlvo.length < 30) {
       const { data: empData } = await db.from('empresas').select('id').ilike('nome', `%${empresaAlvo}%`).limit(1).single();
       if (empData) {
         empresaAlvo = empData.id;
       } else {
         throw new Error("Empresa não encontrada no banco de dados.");
       }
    }

    const { data: denunciaSalva, error } = await db
      .from('denuncias_anonimas')
      .insert([{
        empresa_id: empresaAlvo,
        texto: relatoCompleto,
        protocolo: protocolo,
        status: 'Pendente'
      }])
      .select('protocolo')
      .single();

    if (error) {
      console.error("Erro na inserção confidencial:", error.message);
      throw new Error("Falha ao registrar denúncia nos servidores seguros.");
    }

    // Retorna o protocolo para ser exibido APENAS NESTA TELA para o funcionário anotar.
    return denunciaSalva.protocolo;
  }

  /**
   * Busca uma denúncia e seus andamentos pelo número de protocolo
   */
  async buscarDenunciaPorProtocolo(protocolo: string) {
    const db = this.getSupabaseAdmin();
    
    const { data: denuncia, error } = await db
      .from('denuncias_anonimas')
      .select('*, denuncias_andamentos(*)')
      .eq('protocolo', protocolo.trim().toUpperCase())
      .order('created_at', { foreignTable: 'denuncias_andamentos', ascending: true })
      .single();

    if (error) {
      if (error.code === 'PGRST116') throw new Error("Protocolo não encontrado. Verifique se digitou corretamente.");
      throw new Error("Erro ao buscar protocolo: " + error.message);
    }

    return denuncia;
  }

  /**
   * Pesquisa empresas pelo nome para facilitar o vínculo no canal de denúncia
   */
  async pesquisarEmpresas(termo: string) {
    if (!termo || termo.length < 3) return [];
    
    const db = this.getSupabaseAdmin();
    const { data, error } = await db
      .from('empresas')
      .select('id, nome')
      .ilike('nome', `%${termo}%`)
      .limit(10);
      
    if (error) throw error;
    return data;
  }
}
