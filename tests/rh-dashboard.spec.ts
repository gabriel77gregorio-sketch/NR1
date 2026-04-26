import { test, expect } from '@playwright/test';

test.describe('Navegação e Interface do RH', () => {
  
  test('deve acessar o dashboard do RH', async ({ page }) => {
    // 1. Acessa a raiz do dashboard
    await page.goto('/rh/dashboard');
    
    // 2. Verifica se o título da página está correto
    await expect(page).toHaveTitle(/Dashboard /i);
    
    // 3. Verifica se a SidebarRH está visível (procurando um dos links do menu modular)
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();
    
    // 4. Garante que os links de navegação da Sidebar estão renderizados
    const linkAdvertencias = page.locator('a[href="/rh/advertencias"]');
    const linkAvaliacoes = page.locator('a[href="/rh/avaliacoes-individuais"]');
    const linkPlanos = page.locator('a[href="/rh/planos-de-acao"]');
    
    await expect(linkAdvertencias).toBeVisible();
    await expect(linkAvaliacoes).toBeVisible();
    await expect(linkPlanos).toBeVisible();
  });

  test('deve navegar para Planos de Ação e abrir o Modal', async ({ page }) => {
    await page.goto('/rh/planos-de-acao');
    
    // Verifica se carregou sem erros de timeout (Supabase bypass)
    await expect(page.locator('h2').filter({ hasText: 'Planos de Ação' })).toBeVisible();
    
    // Testa interação: clicar no botão "NOVO PLANO 5W2H"
    const btnNovo = page.locator('button', { hasText: 'NOVO PLANO' });
    await expect(btnNovo).toBeVisible();
    await btnNovo.click();
    
    // Verifica se o modal abriu
    const modal = page.locator('#modal5w2h');
    await expect(modal).toBeVisible();
    
    // Testa interação: fechar o modal
    const btnCancelar = page.locator('#btnCancelarModal5w2h');
    await btnCancelar.click();
    await expect(modal).toBeHidden();
  });

  test('deve navegar para Configurações sem travamento de rede', async ({ page }) => {
    // Esse teste valida se o bypass do Supabase foi feito corretamente e a página não fica carregando infinito.
    await page.goto('/rh/configuracoes');
    
    // Garante que o header da página de configurações renderizou
    await expect(page.locator('h2').filter({ hasText: 'Organograma e Colaboradores' })).toBeVisible();
    
    // Verifica se os cartões de gerenciamento apareceram
    await expect(page.locator('text=Setores / GHE')).toBeVisible();
    await expect(page.locator('text=Quadro de Colaboradores')).toBeVisible();
  });
});
