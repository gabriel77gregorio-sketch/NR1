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

  async addColaborador(nome: string, email: string, cargo: string, departamento_id: string | null, telefone: string | null = null, data_admissao: string | null = null) {
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
      telefone,
      ativo: true
    };
    if (departamento_id) {
      inputData.departamento_id = departamento_id;
    }
    if (data_admissao) {
      inputData.data_admissao = data_admissao;
    }

    const { data, error } = await this.supabase
      .from('colaboradores_base')
      .insert([inputData])
      .select()
      .single();

    if (error) throw error;

    if (data && data_admissao) {
      const admissaoDate = new Date(data_admissao);
      const hoje = new Date();
      const diffTime = hoje.getTime() - admissaoDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Só agendar se a admissão for recente (menos de 100 dias atrás)
      // Isso evita encher o dashboard com avaliações retroativas de funcionários antigos
      if (diffDays <= 100) {
        await this.agendarAvaliacoesExperiencia(data.id, data_admissao, perfil.empresa_id, user.id);
      }
    }

    return data;
  }

  private async agendarAvaliacoesExperiencia(colaboradorId: string, dataAdmissao: string, empresaId: string, gestorId: string) {
    const admissao = new Date(dataAdmissao);
    
    // 45 Dias
    const data45 = new Date(admissao);
    data45.setDate(admissao.getDate() + 45);
    
    // 90 Dias
    const data90 = new Date(admissao);
    data90.setDate(admissao.getDate() + 90);

    const avaliacoes = [
      {
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
        gestor_avaliador_id: gestorId,
        tipo: 'Experiência_45_Dias',
        status: 'Pendente',
        data_limite: data45.toISOString().split('T')[0]
      },
      {
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
        gestor_avaliador_id: gestorId,
        tipo: 'Experiência_90_Dias',
        status: 'Pendente',
        data_limite: data90.toISOString().split('T')[0]
      }
    ];

    await this.supabase.from('avaliacoes_individuais').insert(avaliacoes);
  }

  async deleteColaborador(id: string) {
    const { error } = await this.supabase
      .from('colaboradores_base')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
