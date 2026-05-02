CREATE TABLE IF NOT EXISTS configuracoes_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_plataforma TEXT DEFAULT 'NR1 Compliance',
    email_suporte TEXT DEFAULT 'suporte@nr1.com.br',
    modo_manutencao BOOLEAN DEFAULT false,
    limite_usuarios_trial INTEGER DEFAULT 10,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir registro inicial se não houver
INSERT INTO configuracoes_sistema (nome_plataforma, email_suporte)
SELECT 'NR1 Compliance', 'suporte@nr1.com.br'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_sistema);

-- Habilitar RLS
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Política para SuperAdmin (apenas Master pode ver e editar)
-- Assumindo que a role no perfil é 'SuperAdmin'
CREATE POLICY "SuperAdmins can do everything on system config"
ON configuracoes_sistema
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM perfis_usuarios
    WHERE perfis_usuarios.id = auth.uid()
    AND perfis_usuarios.role = 'SuperAdmin'
  )
);
