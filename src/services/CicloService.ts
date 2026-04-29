import type { SupabaseClient } from '@supabase/supabase-js';

export class CicloService {
  constructor(private supabase: SupabaseClient) {}

  async getCiclos(empresaId: string) {
    const { data, error } = await this.supabase
      .from('ciclos_avaliacao')
      .select(`
        *,
        campanhas_pesquisa (
          id,
          titulo,
          data_programada,
          status,
          participantes_total:campanhas_participantes(count),
          participantes_respondidos:campanhas_participantes(count).filter(respondido_em.not.is.null)
        )
      `)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createCiclo(empresaId: string, nome: string, descricao?: string) {
    const { data, error } = await this.supabase
      .from('ciclos_avaliacao')
      .insert({
        empresa_id: empresaId,
        nome,
        descricao,
        status: 'Ativo'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async closeCiclo(cicloId: string) {
    const { error } = await this.supabase
      .from('ciclos_avaliacao')
      .update({ status: 'Concluído', data_fim: new Date().toISOString() })
      .eq('id', cicloId);

    if (error) throw error;
  }

  async deleteCiclo(cicloId: string) {
    const { error } = await this.supabase
      .from('ciclos_avaliacao')
      .delete()
      .eq('id', cicloId);

    if (error) throw error;
  }
}
