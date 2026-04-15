# SaaS NR1 - Gestão e Compliance Ocupacional 🛡️

Bem-vindo ao repositório do **SaaS NR1**, uma plataforma B2B multi-tenant focada no gerenciamento prático, seguro e auditável do PGR (Programa de Gerenciamento de Riscos) e adequações inerentes à Norma Regulamentadora 01 (NR 01).

## 🎯 O Que Este Sistema Faz?

O SaaS NR1 é um ecossistema projetado para que consultorias de Saúde e Segurança do Trabalho (SST) ou Departamentos de RH centralizem o atendimento e o compliance de múltiplos clientes (empresas).

As principais funcionalidades incluem:
- **Dashboard SuperAdmin:** Gestão centralizada para provisionamento instantâneo de novos bancos de dados (Tenants) para novos clientes.
- **Avaliações Psicossociais:** Disparo em massa, monitoramento e consolidação de pesquisas internacionalmente validadas (HSE Management Standards, COPSOQ II e JCQ Karasek). 
- **Canal de Denúncias Anônimo:** Sistema de triagem assíncrona protegido para recebimento de queixas éticas ou desvios de conduta, sem vincular PII (Personally Identifiable Information) ao denunciante.
- **Gestão de Planos de Ação (5W2H):** Módulo para execução prática das mitigações do PGR.

---

## 🔒 Segurança em Primeiro Lugar

O fluxo de disparo de pesquisas lida com dados sensíveis de trabalhadores. Para garantir aderência técnica à conformidade forense:
- Respostas a pesquisas ou denúncias **nunca trafegam o banco de dados pro lado do cliente (browser)**.
- O link de preenchimento (ex: `/responder/[token]`) aponta para rotas **SSR (Server-Side Rendenders)** blindadas.
- Tokens gerados são usando chaves Criptográficas **UUID v4 únicas e de uso exclusivo (One-time-use)**.
- Políticas RLS (Row Level Security) garantem que nenhum cliente X tenha acesso aos dados do cliente Y.

---

## 🛠️ Tecnologias e Ferramentas

O projeto segue um padrão tecnológico voltado à extrema performance Web e simplicidade de deploys:

| Categoria | Tecnologia | Justificativa |
| :--- | :--- | :--- |
| **Linguagem Base** | `TypeScript` | Garantia de forte tipagem no front e back-end. |
| **Framework Full-Stack**| `Astro` | Escolhido pelo modelo *Islands Architecture* (zero JS não utilizado) e SSR, gerando extrema performance e blindagem em rotas sensíveis (como as APIs de token). |
| **Banco de Dados** | `PostgreSQL (Supabase)` | Banco relacional robusto para mapear a complexidade do *Multi-Tenant Software*, utilizando o componente nativo de Row Level Security. |
| **Autenticação** | `Supabase Auth` | Responsável pelos tokens JWT transientes, gerenciando SuperAdmins, Admins de Filial e Convidados sem overhead. |
| **Infra de E-mails**| `Resend (API)` | Facilita a alta entregabilidade dos convites transacionais das avaliações sem cair no SPAM. |
| **Estilizações** | `CSS Modules / Vanilla` | Variáveis CSS controladas dentro do escopo dos componentes. |

---

## 🚀 Como Rodar o Projeto (Dev)

Para rodar o projeto localmente:

1. Clone o repositório.
2. Crie as cópias das variáveis de ambiente na raiz como `.env` e defina as chaves do Supabase e do Resend:
   ```env
   PUBLIC_SUPABASE_URL="sua-url"
   PUBLIC_SUPABASE_ANON_KEY="sua-anon-key"
   SUPABASE_SERVICE_KEY="seu-service-role-key"
   RESEND_API_KEY="seu-resend"
   ```
3. Instale as dependências com `npm install`.
4. Inicie o servidor local em Node.js usando `npm run dev`.

<br>

> *Desenvolvido e atualizado continuamente para conformidade em Saúde e Segurança Ocupacional preventiva.*
