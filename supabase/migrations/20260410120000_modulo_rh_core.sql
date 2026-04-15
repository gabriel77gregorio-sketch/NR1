-- ==========================================
-- Migration: Módulo RH Core (Matrizes, Planos, Denúncias, Treinamentos)
-- ==========================================

-- 1. Departamentos e Unidades (Para segmentação de risco)
CREATE TABLE public.departamentos_unidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'Setor', -- Pode ser 'Unidade' ou 'Setor'
    parent_id UUID REFERENCES public.departamentos_unidades(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.departamentos_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Departamentos" ON public.departamentos_unidades FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- 2. Base de Colaboradores (Destinatários de Pesquisas e Treinamentos)
CREATE TABLE public.colaboradores_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    departamento_id UUID REFERENCES public.departamentos_unidades(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    cargo VARCHAR(255),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(empresa_id, email)
);
ALTER TABLE public.colaboradores_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Colaboradores" ON public.colaboradores_base FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- 3. Metodologias Validadas (ReadOnly para as empresas)
CREATE TABLE public.metodologias_pesquisa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    instrucoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.metodologias_pesquisa ENABLE ROW LEVEL SECURITY;
-- Todos podem ler, mas apenas o banco interno (admin DB) pode popular metodologias cientificas.
CREATE POLICY "Leitura de metodologias global" ON public.metodologias_pesquisa FOR SELECT TO authenticated USING (true);

-- 4. Campanhas (Disparos de Pesquisa)
CREATE TABLE public.campanhas_pesquisa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    metodologia_id UUID NOT NULL REFERENCES public.metodologias_pesquisa(id),
    titulo VARCHAR(255) NOT NULL,
    conteudo_email TEXT NOT NULL,
    data_programada TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Rascunho', -- Rascunho, Agendado, Em Andamento, Concluido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.campanhas_pesquisa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Campanhas Pesquisa" ON public.campanhas_pesquisa FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- Relacionamento N:N: Participantes da Campanha
CREATE TABLE public.campanhas_participantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campanha_id UUID NOT NULL REFERENCES public.campanhas_pesquisa(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_base(id) ON DELETE CASCADE,
    status_resposta VARCHAR(50) DEFAULT 'Pendente',
    token_acesso UUID DEFAULT uuid_generate_v4() UNIQUE, -- Link unico enviado por email
    respondido_em TIMESTAMP WITH TIME ZONE,
    UNIQUE(campanha_id, colaborador_id)
);
ALTER TABLE public.campanhas_participantes ENABLE ROW LEVEL SECURITY;
-- View restrita
CREATE POLICY "RLS Campanhas Participantes" ON public.campanhas_participantes FOR ALL TO authenticated 
USING (campanha_id IN (SELECT id FROM public.campanhas_pesquisa WHERE empresa_id = public.get_user_empresa_id()));

-- 5. Planos de Ação / PGR (Abordagem 5W2H)
CREATE TABLE public.planos_de_acao_pgr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    departamento_id UUID REFERENCES public.departamentos_unidades(id) ON DELETE SET NULL,
    
    -- 5W2H Framework
    what_title VARCHAR(255) NOT NULL,            -- O que será feito
    why_reason TEXT,                             -- Por que será feito
    where_location VARCHAR(255),                 -- Onde
    when_start DATE NOT NULL,                    -- Quando começa
    when_end DATE NOT NULL,                      -- Quando deve terminar
    who_responsible VARCHAR(255) NOT NULL,       -- Quem (Nome ou Cargo)
    how_method TEXT,                             -- Como
    how_much_cost DECIMAL(10,2) DEFAULT 0.00,    -- Quanto custa
    
    status VARCHAR(50) DEFAULT 'Aberto',         -- Aberto, Em Andamento, Concluído, Atrasado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.planos_de_acao_pgr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Planos de Acao" ON public.planos_de_acao_pgr FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- 6. Andamento de Denúncias
CREATE TABLE public.denuncias_andamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    denuncia_id UUID NOT NULL REFERENCES public.denuncias_anonimas(id) ON DELETE CASCADE,
    autor VARCHAR(100) NOT NULL, -- "Comitê de Ética", etc
    relato TEXT NOT NULL,
    status_atualizado VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.denuncias_andamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Denuncias Andamento" ON public.denuncias_andamentos FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

-- 7. Gestão de Treinamentos (NRs e Extras)
CREATE TABLE public.treinamentos_catalogo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    obrigatorio BOOLEAN DEFAULT false,
    periodicidade_meses INTEGER DEFAULT 12, -- Por exemplo, a cada 1 ano
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.treinamentos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Catalogo Treinamento" ON public.treinamentos_catalogo FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());

CREATE TABLE public.treinamentos_historico (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    treinamento_id UUID NOT NULL REFERENCES public.treinamentos_catalogo(id) ON DELETE CASCADE,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores_base(id) ON DELETE CASCADE,
    data_conclusao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.treinamentos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RLS Historico Treinamentos" ON public.treinamentos_historico FOR ALL TO authenticated USING (empresa_id = public.get_user_empresa_id());
