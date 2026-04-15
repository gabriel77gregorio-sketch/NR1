import type { SupabaseClient } from '@supabase/supabase-js';

export class ColaboradoresService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  // --- SETORES / DEPARTAMENTOS ---

  async getSetores() {
    const { data, error } = await this.supabase
      .from('departamentos_unidades')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.error("Erro ao buscar setores", error);
      return [];
    }
    return data;
  }

  async addSetor(nome: string) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil || !perfil.empresa_id) throw new Error("Usuário sem empresa vinculada");

    const { data, error } = await this.supabase
      .from('departamentos_unidades')
      .insert([{
        empresa_id: perfil.empresa_id,
        nome,
        tipo: 'Setor'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSetor(id: string) {
    const { error } = await this.supabase
      .from('departamentos_unidades')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }


  // --- COLABORADORES ---

  async getColaboradores() {
    const { data, error } = await this.supabase
      .from('colaboradores_base')
      .select('*, departamentos_unidades(nome)')
      .order('nome', { ascending: true });

    if (error) {
      console.error("Erro ao buscar colaboradores", error);
      return [];
    }
    return data;
  }

  async addColaborador(nome: string, email: string, cargo: string, departamento_id: string | null) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil || !perfil.empresa_id) throw new Error("Usuário sem empresa vinculada");

    const inputData: any = {
      empresa_id: perfil.empresa_id,
      nome,
      email,
      cargo,
      ativo: true
    };
    if (departamento_id) {
      inputData.departamento_id = departamento_id;
    }

    const { data, error } = await this.supabase
      .from('colaboradores_base')
      .insert([inputData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteColaborador(id: string) {
    const { error } = await this.supabase
      .from('colaboradores_base')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
