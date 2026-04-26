-- Remover a constraint de foreign key estrita que vinculava responsavel_id APENAS a perfis_usuarios
-- Isso permite que o plano de ação seja atribuído a um usuario do sistema OU a um colaborador da base.

ALTER TABLE public.planos_de_acao_pgr DROP CONSTRAINT IF EXISTS planos_de_acao_pgr_responsavel_id_fkey;
ALTER TABLE public.planos_de_acao_pgr DROP CONSTRAINT IF EXISTS planos_de_acao_pgr_pendente_com_id_fkey;
