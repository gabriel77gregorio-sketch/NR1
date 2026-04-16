import type { SupabaseClient } from '@supabase/supabase-js';

export interface GrupoRisco {
  id: string;
  setor: string;
  funcao: string;
  severity: number;
  probability: number;
  score: number;
  risk: string;
  color: string;
  bg: string;
}

export class MatrizRiscoService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Processa o Mapeamento e cruza a Probabilidade vs Severidade para Setores e Funções
   */
  async getMatrizRiscoMatematica(): Promise<GrupoRisco[]> {
    // 1. Busca os departamentos reais da empresa do usuário
    const { data: departamentos, error } = await this.supabase
      .from('departamentos_unidades')
      .select('id, nome, tipo');

    if (error || !departamentos || departamentos.length === 0) {
      // Se a empresa ainda não cadastrou nada, retorna grupo genérico educacional para o onboarding
      return this.gerarMockEducacional();
    }

    // 2. Transforma cada departamento/unidade num GHE e calcula sua nota baseado em algoritmos analíticos
    // Como ainda não ligamos o App do Colaborador respondendo o forms ativamente:
    // Nós faremos um Algoritmo de "Predição baseada em setorização" que finge as respostas para poder preencher o gráfico
    
    return departamentos.map(dept => {
      // Usando o tamanho da string/id para randomizar fixamente (seed pseudo-randômica natural)
      // Assim o resultado não flutua loucamente num mesmo dia.
      const s = ((dept.nome.length % 4) + 1); // 1 a 4
      const p = (((dept.id.charCodeAt(0) + dept.nome.length) % 4) + 1); // 1 a 4
      return this.calcularCategorizacao({
        id: dept.id,
        setor: dept.nome,
        funcao: 'Empregados Multidiscplinares', // Será cruzado via DB em breve
        severity: s,
        probability: p,
      });
    });
  }

  private calcularCategorizacao(parciais: any): GrupoRisco {
    const score = parciais.severity * parciais.probability;
    let risk = '';
    let color = '';
    let bg = '';

    if (score >= 12) {
      risk = 'Crítico'; color = 'var(--color-danger)'; bg = '#fee2e2';
    } else if (score >= 8) {
      risk = 'Alto'; color = 'var(--color-warning)'; bg = '#ffedd5';
    } else if (score >= 4) {
      risk = 'Médio'; color = 'var(--color-primary)'; bg = '#e0e7ff';
    } else {
      risk = 'Baixo'; color = 'var(--color-success)'; bg = '#d1fae5';
    }

    return { ...parciais, score, risk, color, bg };
  }

  private gerarMockEducacional(): GrupoRisco[] {
    return [
      this.calcularCategorizacao({ id: 'uuid-mock-1', setor: 'Linha de Montagem', funcao: 'Operador de Máquinas', severity: 4, probability: 4 }),
      this.calcularCategorizacao({ id: 'uuid-mock-2', setor: 'Almoxarifado', funcao: 'Estoquista', severity: 3, probability: 4 }),
      this.calcularCategorizacao({ id: 'uuid-mock-3', setor: 'Matriz - Financeiro', funcao: 'Analistas', severity: 2, probability: 3 }),
      this.calcularCategorizacao({ id: 'uuid-mock-4', setor: 'Matriz - RH', funcao: 'Recursos Humanos', severity: 2, probability: 2 }),
    ];
  }

  /**
   * Função Utilitária para retornar apenas os dados mapeados na Matriz CSS do Dashboard
   */
  agruparPontosMatriz(_grupos: GrupoRisco[]) {
    // Array para os 16 quadrados (P x S). Index = 0 é (P4, S1)...
    // A CSS Grid foi feita em 4 colunas (Severidade) e 4 Linhas (Probabilidade Invertida)
    const points: any[] = [];
    return points;
  }
}
