import { SupabaseClient } from '@supabase/supabase-js';

export interface AvaliacaoIndividual {
  id?: string;
  empresa_id?: string;
  colaborador_id: string;
  formulario_id?: string;
  gestor_avaliador_id?: string;
  tipo: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  data_limite: string;
  created_at?: string;
}

export class AvaliacaoIndividualService {
  private supabase: SupabaseClient;
  private empresaId: string;

  constructor(supabaseClient: SupabaseClient, empresaId: string) {
    this.supabase = supabaseClient;
    this.empresaId = empresaId;
  }

  async getAvaliacoes(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('avaliacoes_individuais')
      .select(`
        *,
        colaboradores_base ( nome, cargo )
      `)
      .eq('empresa_id', this.empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar avaliações individuais:", error);
      return [];
    }

    return data || [];
  }

  async agendarAvaliacao(avaliacao: AvaliacaoIndividual): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil) return false;

    const novaAvaliacao = {
      ...avaliacao,
      empresa_id: perfil.empresa_id,
      gestor_avaliador_id: user.id
    };

    const { error } = await this.supabase
      .from('avaliacoes_individuais')
      .insert([novaAvaliacao]);

    if (error) {
      console.error("Erro ao agendar avaliação:", error);
      return false;
    }

    return true;
  }
}
