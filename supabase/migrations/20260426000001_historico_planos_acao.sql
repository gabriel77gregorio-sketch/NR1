-- Criação da tabela de histórico de ações (Gargalo Operacional)
CREATE TABLE IF NOT EXISTS public.historico_planos_acao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id UUID REFERENCES public.planos_de_acao_pgr(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES public.colaboradores_base(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  data_prevista_checkpoint DATE,
  status VARCHAR DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.historico_planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RLS Historico Planos" 
ON public.historico_planos_acao FOR ALL 
TO authenticated 
USING (
  plano_id IN (
    SELECT id FROM public.planos_de_acao_pgr WHERE empresa_id = public.get_user_empresa_id()
  )
);
