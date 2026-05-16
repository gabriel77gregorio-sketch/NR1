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
  responsavel_id?: string;
  pendente_com_id?: string;
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
  async criarPlanoDeAcao(planoData: Partial<PlanoAcao>, historico?: any) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data: perfil } = await this.supabase
      .from('perfis_usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single();

    if (!perfil) throw new Error("Perfil de empresa não encontrado");

    // Parse responsavel_id para remover USER_ se existir
    let responsavelPlanoUUID = planoData.responsavel_id;
    let isUserSystem = false;

    if (responsavelPlanoUUID && responsavelPlanoUUID.startsWith('USER_')) {
      responsavelPlanoUUID = responsavelPlanoUUID.replace('USER_', '');
      isUserSystem = true;
    }

    const { data, error } = await this.supabase
      .from('planos_de_acao_pgr')
      .insert([{
        ...planoData,
        responsavel_id: responsavelPlanoUUID,
        empresa_id: perfil.empresa_id
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Notificar o responsável pelo PLANO (WHO)
    if (responsavelPlanoUUID) {
      await this.supabase.from('notificacoes').insert([{
        empresa_id: perfil.empresa_id,
        usuario_id: isUserSystem ? responsavelPlanoUUID : null,
        colaborador_id: !isUserSystem ? responsavelPlanoUUID : null,
        titulo: 'Novo Plano de Ação Atribuído',
        mensagem: `Você foi designado como responsável pelo plano: ${planoData.what_title}. Prazo: ${new Date(planoData.when_end || '').toLocaleDateString('pt-BR')}`,
        link_acao: isUserSystem ? '/rh/planos-de-acao' : '/colaborador/meus-planos'
      }]);
    }

    // Se vier um histórico inicial configurado, adiciona ao tracker
    if (historico && data && (historico.descricao || historico.responsavel_id)) {
      let gargaloUUID = historico.responsavel_id;
      let isGargaloSystem = false;

      if (gargaloUUID && gargaloUUID.startsWith('USER_')) {
        gargaloUUID = gargaloUUID.replace('USER_', '');
        isGargaloSystem = true;
      }

      await this.supabase.from('historico_planos_acao').insert([{
        plano_id: data.id,
        responsavel_id: gargaloUUID || null,
        descricao: historico.descricao || 'Início do acompanhamento.',
        data_prevista_checkpoint: historico.data_prevista_checkpoint || null
      }]);

      // Atualiza o plano principal com o gargalo
      if (gargaloUUID) {
        await this.supabase.from('planos_de_acao_pgr')
          .update({ pendente_com_id: gargaloUUID })
          .eq('id', data.id);
      }

      // Notifica o responsável pelo GARGALO/PENDÊNCIA
      if (gargaloUUID) {
        await this.supabase.from('notificacoes').insert([{
          empresa_id: perfil.empresa_id,
          usuario_id: isGargaloSystem ? gargaloUUID : null,
          colaborador_id: !isGargaloSystem ? gargaloUUID : null,
          titulo: 'Pendência em Plano de Ação',
          mensagem: `O plano '${planoData.what_title}' está travado aguardando sua ação.`,
          link_acao: isGargaloSystem ? '/rh/planos-de-acao' : '/colaborador/pendencias'
        }]);
      }
    }

    return data;
  }
  /**
   * Atualiza o progresso de um plano de ação (Gerenciar Pendência/Gargalo)
   */
  async atualizarProgresso(planoId: string, dados: { 
    acao: 'encaminhar' | 'encerrar', 
    proximo_responsavel_id?: string, 
    descricao: string 
  }) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // 1. Buscar dados do plano atual
    const { data: plano } = await this.supabase
      .from('planos_de_acao_pgr')
      .select('what_title, empresa_id')
      .eq('id', planoId)
      .single();

    if (!plano) throw new Error("Plano não encontrado");

    // 2. Preparar dados do histórico
    let responsavelUUID = dados.proximo_responsavel_id;
    let isUserSystem = false;

    if (responsavelUUID && responsavelUUID.startsWith('USER_')) {
      responsavelUUID = responsavelUUID.replace('USER_', '');
      isUserSystem = true;
    }

    // 3. Inserir no histórico
    const { error: histError } = await this.supabase.from('historico_planos_acao').insert([{
      plano_id: planoId,
      responsavel_id: responsavelUUID || user.id,
      descricao: dados.acao === 'encerrar' ? `PLANO CONCLUÍDO: ${dados.descricao}` : dados.descricao,
      status: dados.acao === 'encerrar' ? 'Concluído' : 'Em Andamento'
    }]);

    if (histError) throw histError;

    // 4. Atualizar o plano principal
    const updateData: any = {
      status: dados.acao === 'encerrar' ? 'Concluído' : 'Em Andamento',
      pendente_com_id: dados.acao === 'encerrar' ? null : responsavelUUID
    };

    const { error: updateError } = await this.supabase
      .from('planos_de_acao_pgr')
      .update(updateData)
      .eq('id', planoId);

    if (updateError) throw updateError;

    // 5. Notificar se houver encaminhamento
    if (dados.acao === 'encaminhar' && responsavelUUID) {
      await this.supabase.from('notificacoes').insert([{
        empresa_id: plano.empresa_id,
        usuario_id: isUserSystem ? responsavelUUID : null,
        colaborador_id: !isUserSystem ? responsavelUUID : null,
        titulo: 'Nova Pendência Atribuída',
        mensagem: `O plano '${plano.what_title}' foi encaminhado para sua ação.`,
        link_acao: isUserSystem ? '/rh/planos-de-acao' : '/colaborador/pendencias'
      }]);
    }

    return { success: true };
  }
}
