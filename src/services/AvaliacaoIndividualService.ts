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

  async concluirAvaliacao(avaliacaoId: string, dadosResposta: any): Promise<boolean> {
    const { error } = await this.supabase
      .from('avaliacoes_individuais')
      .update({ 
        status: 'Concluído',
        dados_resposta: dadosResposta
      })
      .eq('id', avaliacaoId);

    if (error) {
      console.error("Erro ao concluir avaliação:", error);
      return false;
    }

    return true;
  }

  async excluirAvaliacao(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('avaliacoes_individuais')
      .delete()
      .eq('id', id)
      .eq('empresa_id', this.empresaId);

    if (error) {
      console.error("Erro ao excluir avaliação:", error);
      return false;
    }
    return true;
  }

  async getStats(): Promise<{ media45: number, media90: number, desligamentos: number }> {
    const avaliacoes = await this.getAvaliacoes();
    
    const calcularMedia = (tipo: string) => {
      const filtradas = avaliacoes.filter(a => a.tipo === tipo && a.status === 'Concluído' && a.dados_resposta);
      if (filtradas.length === 0) return 0;
      
      const pesos: any = { 'Excelente': 100, 'Boa': 75, 'Regular': 50, 'Insatisfatória': 25 };
      const soma = filtradas.reduce((acc, a) => acc + (pesos[a.dados_resposta.adaptacao] || 0), 0);
      return Math.round(soma / filtradas.length);
    };

    return {
      media45: calcularMedia('Experiência_45_Dias'),
      media90: calcularMedia('Experiência_90_Dias'),
      desligamentos: avaliacoes.filter(a => a.tipo === 'Desligamento' && a.status === 'Concluído').length
    };
  }
}
