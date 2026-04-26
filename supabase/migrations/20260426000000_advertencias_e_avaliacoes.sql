-- ==========================================
-- Migration: Advertências e Avaliações Individuais
-- ==========================================

-- 1. Advertências Comportamentais (Falta de EPI, etc)
CREATE TABLE public.advertencias_comportamentais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_base(id) ON DELETE CASCADE,
    gestor_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(100) NOT NULL, -- Ex: 'Falta de EPI', 'Comportamento Inadequado'
    descricao TEXT NOT NULL,
    data_ocorrencia DATE NOT NULL DEFAULT CURRENT_DATE,
    status_assinatura VARCHAR(50) DEFAULT 'Pendente', -- 'Pendente', 'Assinado', 'Recusado'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.advertencias_comportamentais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Advertencias" ON public.advertencias_comportamentais FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- 2. Avaliações Individuais (Ciclo de Vida)
CREATE TABLE public.avaliacoes_individuais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_base(id) ON DELETE CASCADE,
    formulario_id UUID REFERENCES public.formularios_templates(id) ON DELETE SET NULL,
    gestor_avaliador_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(100) NOT NULL, -- 'Desligamento', 'Experiência_45_Dias', 'Experiência_90_Dias'
    status VARCHAR(50) DEFAULT 'Pendente', -- 'Pendente', 'Em Andamento', 'Concluído'
    data_limite DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.avaliacoes_individuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Avaliacoes Individuais" ON public.avaliacoes_individuais FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());
