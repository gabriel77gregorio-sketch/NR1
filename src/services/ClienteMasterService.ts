import { createClient } from '@supabase/supabase-js';

export interface NovoClienteDTO {
  nome_empresa: string;
  cnpj: string;
  email_admin: string;
  senha_provisoria: string;
  nome_admin: string;
}

export class ClienteMasterService {
  // Apenas quem tem a chave de SERVIÇO pode rodar isso
  // Isso permite criar Contas de Auth sem precisar estar logado e sem disparar emails imediatamente
  private getSupabaseAdmin() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
    const serviceKey = import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY nula. Criação de novos Tenants bloqueada.");
    
    return createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  constructor() {}

  /**
   * Pipeline de Criação de Novo Cliente/Tenant (Assessoria criando acesso para o RH local)
   */
  async provisionarNovoCliente(dto: NovoClienteDTO) {
    const adminSupabase = this.getSupabaseAdmin();

    try {
      // 1. Criar Empresa no Banco
      const { data: empresa, error: empresaErr } = await adminSupabase
        .from('empresas')
        .insert([{
          nome: dto.nome_empresa,
          cnpj: dto.cnpj.replace(/\D/g, '') // Guarda so numeros
        }])
        .select()
        .single();
      
      if (empresaErr || !empresa) throw new Error("Erro ao criar empresa: " + (empresaErr?.message || ''));

      // 2. Criar a identidade Auth (Admin de RH para a empresa cliente)
      const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: dto.email_admin,
        password: dto.senha_provisoria,
        email_confirm: true, // Já aprovado pela assessoria
        user_metadata: { name: dto.nome_admin }
      });

      if (authErr || !authData.user) {
        // Se falhar o auth, faz rollback (na vida real usa RPC trasanction, mas aqui apagamos)
        await adminSupabase.from('empresas').delete().eq('id', empresa.id);
        throw new Error("Erro ao criar login Auth: " + (authErr?.message || ''));
      }

      // 3. Vincular Auth Identity ao Perfil e Empresa (Role base)
      const { error: perfilErr } = await adminSupabase
        .from('perfis_usuarios')
        .insert([{
          id: authData.user.id,
          empresa_id: empresa.id,
          nome: dto.nome_admin,
          role: 'Admin_RH'
        }]);

      if (perfilErr) {
         // Cleanups em caso de falha severa
         await adminSupabase.auth.admin.deleteUser(authData.user.id);
         await adminSupabase.from('empresas').delete().eq('id', empresa.id);
         throw new Error("Erro ao criar Perfil: " + perfilErr.message);
      }

      return { sucesso: true, empresa };

    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "Erro crasso no provisionamento do tenant.");
    }
  }

  /**
   * Retorna a lista de todos os clientes da plataforma e suas estatísticas vitais
   */
  async listarClientes() {
     const adminSupabase = this.getSupabaseAdmin();
     // Puxa as empresas e faz um Count Aggregation inteligente via FK relationships
     const { data, error } = await adminSupabase
       .from('empresas')
       .select('*, planos_de_acao_pgr(count), denuncias_anonimas(count), campanhas_pesquisa(count), colaboradores_base(count)')
       .order('created_at', { ascending: false });

     if (error) throw new Error(error.message);
     return data;
  }

  /**
   * Métodos para Configurações Globais do Sistema
   */
  async getConfiguracoes() {
    const adminSupabase = this.getSupabaseAdmin();
    const { data, error } = await adminSupabase
      .from('configuracoes_sistema')
      .select('*')
      .single();
    
    // Se não existir, retorna um default para não quebrar a UI
    if (error) {
      return {
        nome_plataforma: 'NR1 Compliance',
        email_suporte: 'suporte@nr1.com.br',
        modo_manutencao: false,
        limite_usuarios_trial: 10
      };
    }
    return data;
  }

  async salvarConfiguracoes(config: any) {
    const adminSupabase = this.getSupabaseAdmin();
    const { error } = await adminSupabase
      .from('configuracoes_sistema')
      .upsert([config]);
    
    if (error) throw new Error("Erro ao salvar configurações: " + error.message);
    return { sucesso: true };
  }

  /**
   * Remove completamente uma empresa e todos os dados associados
   */
  async deletarCliente(empresaId: string) {
    const adminSupabase = this.getSupabaseAdmin();

    try {
      // 1. Buscar todos os IDs de usuários vinculados a esta empresa
      const { data: perfis } = await adminSupabase
        .from('perfis_usuarios')
        .select('id')
        .eq('empresa_id', empresaId);

      const userIds = perfis?.map(p => p.id) || [];

      // 2. Apagar os usuários do Supabase Auth (Admin API)
      for (const id of userIds) {
        await adminSupabase.auth.admin.deleteUser(id);
      }

      // 3. Apagar dados operacionais (Cascata manual preventiva)
      // Nota: Algumas tabelas podem ter cascata no banco, mas fazemos aqui para garantir
      await adminSupabase.from('respostas_avaliacoes').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('denuncias_anonimas').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('planos_de_acao_pgr').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('campanhas_pesquisa').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('ciclos_avaliacao').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('colaboradores_base').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('departamentos_unidades').delete().eq('empresa_id', empresaId);
      await adminSupabase.from('perfis_usuarios').delete().eq('empresa_id', empresaId);

      // 4. Por fim, apagar a empresa
      const { error: empresaErr } = await adminSupabase
        .from('empresas')
        .delete()
        .eq('id', empresaId);

      if (empresaErr) throw empresaErr;

      return { sucesso: true };
    } catch (e: any) {
      console.error("Erro ao deletar cliente:", e);
      throw new Error("Falha ao remover cliente: " + e.message);
    }
  }
}
