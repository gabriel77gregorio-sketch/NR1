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
          campanhas_participantes (
            id,
            respondido_em
          )
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
    // 1. Buscar IDs das campanhas vinculadas a este ciclo
    const { data: campanhas } = await this.supabase
      .from('campanhas_pesquisa')
      .select('id')
      .eq('ciclo_id', cicloId);

    const campanhaIds = campanhas?.map(c => c.id) || [];

    // 2. Apagar Respostas Anônimas do Ciclo
    await this.supabase
      .from('respostas_avaliacoes')
      .delete()
      .eq('ciclo_id', cicloId);

    if (campanhaIds.length > 0) {
      // 3. Apagar Participantes das Campanhas
      await this.supabase
        .from('campanhas_participantes')
        .delete()
        .in('campanha_id', campanhaIds);

      // 4. Apagar as Campanhas
      await this.supabase
        .from('campanhas_pesquisa')
        .delete()
        .eq('ciclo_id', cicloId);
    }

    // 5. Finalmente, apagar o Ciclo
    const { error } = await this.supabase
      .from('ciclos_avaliacao')
      .delete()
      .eq('id', cicloId);

    if (error) throw error;
  }
}
