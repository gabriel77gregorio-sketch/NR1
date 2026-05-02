import { SupabaseClient } from '@supabase/supabase-js';

export interface Advertencia {
  id?: string;
  empresa_id?: string;
  colaborador_id: string;
  gestor_id?: string;
  tipo: string;
  descricao: string;
  data_ocorrencia: string;
  status_assinatura: 'Pendente' | 'Assinado' | 'Recusado';
  created_at?: string;
}

export class AdvertenciaService {
  private empresaId: string;

  constructor(supabaseClient: SupabaseClient, empresaId: string) {
    this.supabase = supabaseClient;
    this.empresaId = empresaId;
  }

  async getAdvertencias(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('advertencias_comportamentais')
      .select(`
        *,
        colaboradores_base ( nome, cargo ),
        perfis_usuarios ( nome )
      `)
      .eq('empresa_id', this.empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar advertências:", error);
      return [];
    }

    return data || [];
  }

  async criarAdvertencia(advertencia: Advertencia): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil) return false;

    const novaAdvertencia = {
      ...advertencia,
      empresa_id: perfil.empresa_id,
      gestor_id: user.id
    };

    const { error } = await this.supabase
      .from('advertencias_comportamentais')
      .insert([novaAdvertencia]);

    if (error) {
      console.error("Erro ao criar advertência:", error);
      return false;
    }

    return true;
  }

  async atualizarStatus(id: string, status_assinatura: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('advertencias_comportamentais')
      .update({ status_assinatura })
      .eq('id', id);

    if (error) {
      console.error("Erro ao atualizar status da advertência:", error);
      return false;
    }
    return true;
  }
}
