-- Tabela para gerenciar notificações no sistema
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE CASCADE,
  colaborador_id UUID REFERENCES public.colaboradores_base(id) ON DELETE CASCADE,
  titulo VARCHAR NOT NULL,
  mensagem TEXT NOT NULL,
  link_acao VARCHAR,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver Notificacoes da Empresa" 
ON public.notificacoes FOR ALL 
TO authenticated 
USING (
  empresa_id = public.get_user_empresa_id()
);
