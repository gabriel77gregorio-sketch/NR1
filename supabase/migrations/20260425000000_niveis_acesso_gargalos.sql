-- ==========================================
-- Migration: Níveis de Acesso, Foco Operacional e Gargalos
-- ==========================================

-- 1. Atualização das Roles em perfis_usuarios
-- A constraint atual é: role IN ('SuperAdmin', 'Admin_RH', 'Colaborador')
-- Precisamos alterar para: ('SuperAdmin', 'Master', 'Diretoria', 'Segurança_Trabalho', 'RH', 'Operacional')

-- Remove a constraint antiga. Supabase normalmente nomeia como perfis_usuarios_role_check
ALTER TABLE public.perfis_usuarios DROP CONSTRAINT IF EXISTS perfis_usuarios_role_check;

-- Mapeia os dados legados para os novos padrões antes de aplicar a nova constraint
UPDATE public.perfis_usuarios SET role = 'RH' WHERE role = 'Admin_RH';
UPDATE public.perfis_usuarios SET role = 'Operacional' WHERE role = 'Colaborador';

-- Aplica a nova constraint
ALTER TABLE public.perfis_usuarios 
  ADD CONSTRAINT perfis_usuarios_role_check 
  CHECK (role IN ('SuperAdmin', 'Master', 'Diretoria', 'Segurança_Trabalho', 'RH', 'Operacional'));

-- 2. Função Utilitária para RLS: Obter Role do Usuário Atual
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS VARCHAR AS $$
  SELECT role FROM public.perfis_usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- 3. Adição de Colunas em planos_de_acao_pgr para Foco Operacional e Gargalos
ALTER TABLE public.planos_de_acao_pgr
  ADD COLUMN responsavel_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  ADD COLUMN pendente_com_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL;

-- 4. Atualização das Políticas RLS de planos_de_acao_pgr
-- Removemos a política antiga que permitia visualização de todos da mesma empresa
DROP POLICY IF EXISTS "RLS Planos de Acao" ON public.planos_de_acao_pgr;

-- Nova política: 
-- 1. Pertencer à mesma empresa (regra base).
-- 2. Se for Operacional, só pode ver se for o responsavel_id ou pendente_com_id.
-- 3. Outras roles (Master, Diretoria, Seg_Trabalho, RH) veem todos da empresa.
CREATE POLICY "RLS Planos de Acao Restrito por Nivel" 
ON public.planos_de_acao_pgr FOR ALL 
TO authenticated 
USING (
  empresa_id = public.get_user_empresa_id() 
  AND (
    public.get_user_role() != 'Operacional'
    OR responsavel_id = auth.uid()
    OR pendente_com_id = auth.uid()
  )
);
