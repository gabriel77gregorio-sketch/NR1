-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Empresas
-- Tabela principal de tenants do SaaS
-- ==========================================
CREATE TABLE public.empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    configuracoes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. Perfis Usuários
-- Vincula Supabase Auth à nossa estrutura (Role e Empresa)
-- ==========================================
CREATE TABLE public.perfis_usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SuperAdmin', 'Admin_RH', 'Colaborador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;

-- Security Definer Function: Get user's current empresa_id safely
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.perfis_usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

-- RLS: Empresas - SuperAdmin vê todas, ou usuário vê a própria
CREATE POLICY "Visualização restrita da própria empresa" 
ON public.empresas FOR SELECT 
TO authenticated 
USING (id = public.get_user_empresa_id());

-- RLS: Perfis de Usuários
CREATE POLICY "Usuários veem perfis da própria empresa"
ON public.perfis_usuarios FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- ==========================================
-- 3. Formulários Templates (NR-1)
-- ==========================================
CREATE TABLE public.formularios_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    questoes JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.formularios_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento Form Templates"
ON public.formularios_templates FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- ==========================================
-- 4. Respostas Avaliações
-- ==========================================
CREATE TABLE public.respostas_avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    formulario_id UUID NOT NULL REFERENCES public.formularios_templates(id),
    respostas JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.respostas_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento Respostas Avaliacao"
ON public.respostas_avaliacoes FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- ==========================================
-- 5. Denúncias Anônimas
-- ==========================================
CREATE TABLE public.denuncias_anonimas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    protocolo VARCHAR(20) UNIQUE NOT NULL,
    texto TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.denuncias_anonimas ENABLE ROW LEVEL SECURITY;

-- API Anônima só pode INSERIR através da Edge Function via Service Role.
-- O front não faz insert por aqui.
CREATE POLICY "Leitura de denúncias restrita ao RH da empresa"
ON public.denuncias_anonimas FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- ==========================================
-- 6. Campanhas Email
-- ==========================================
CREATE TABLE public.campanhas_email (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    assunto VARCHAR(255) NOT NULL,
    template_html TEXT NOT NULL,
    agendamento TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Agendado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.campanhas_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolamento Campanhas de Email"
ON public.campanhas_email FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id());
