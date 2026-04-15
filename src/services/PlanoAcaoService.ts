import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlanoAcao {
  id: string;
  empresa_id: string;
  departamento_id?: string;
  what_title: string;
  why_reason: string;
  where_location: string;
  when_start: string;
  when_end: string;
  who_responsible: string;
  how_method: string;
  how_much_cost: number;
  status: string;
  created_at: string;
}

export class PlanoAcaoService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Busca todos os planos de ação (PGR) da empresa autenticada.
   * O RLS do banco de dados bloqueará o acesso a planos de outras empresas automaticamente.
   */
  async getPlanosDeAcao(): Promise<PlanoAcao[]> {
    const { data, error } = await this.supabase
      .from('planos_de_acao_pgr')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar planos de ação:', error.message);
      return [];
    }

    return data as PlanoAcao[];
  }

  /**
   * Cria um novo registro do 5W2H
   */
  async criarPlanoDeAcao(planoData: Partial<PlanoAcao>) {
    // Note que empresa_id será definido automaticamente num trigger SQL ou pela inserção segura RLS.
    // Mas para garantir compatibilidade inicial, podemos forçar o fetch do tenant ID se necessário.
    
    // Obter o usuário atual
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Buscar empresa vinculada ao admin
    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil) throw new Error("Perfil de empresa não encontrado");

    const { data, error } = await this.supabase
      .from('planos_de_acao_pgr')
      .insert([{
        ...planoData,
        empresa_id: perfil.empresa_id 
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    return data;
  }
}
