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
    let departamentos = null;
    let error = null;

    try {
      const result = await this.supabase
        .from('departamentos_unidades')
        .select('id, nome, tipo');
      departamentos = result.data;
      error = result.error;
    } catch (e) {
      console.warn("MatrizRiscoService: Falha de rede ao buscar departamentos, usando mock.");
      error = e;
    }

    if (error || !departamentos || departamentos.length === 0) {
      // Se a rede falhar ou a empresa ainda não tiver cadastrado nada, retorna mock educacional
      return this.gerarMockEducacional();
    }

    // 2. Buscar Respostas Reais do Banco
    const { data: respostasReais } = await this.supabase
      .from('respostas_avaliacoes')
      .select('respostas');

    // 3. Processar médias por Setor
    const setoresMap: Record<string, { totalPontos: number, totalRedFlags: number, count: number }> = {};
    
    respostasReais?.forEach((row: any) => {
      const resp = row.respostas;
      const sid = resp.setor_id;
      if (!sid) return;

      if (!setoresMap[sid]) {
        setoresMap[sid] = { totalPontos: 0, totalRedFlags: 0, count: 0 };
      }
      
      // Calcular média de pontos dessa resposta específica
      const detalhes = resp.detalhes || [];
      const somaLocal = detalhes.reduce((acc: number, curr: any) => acc + (curr.pontos || 0), 0);
      const mediaLocal = detalhes.length > 0 ? somaLocal / detalhes.length : 0;

      setoresMap[sid].totalPontos += mediaLocal;
      setoresMap[sid].totalRedFlags += (resp.red_flags || 0);
      setoresMap[sid].count += 1;
    });

    // 4. Mapear departamentos para o formato da Matriz
    return departamentos.map(dept => {
      const stats = setoresMap[dept.id];
      
      if (!stats) {
        // Se não houver dados para este setor, mantemos um score neutro/baixo para não poluir
        return this.calcularCategorizacao({
          id: dept.id,
          setor: dept.nome,
          funcao: 'Aguardando Respostas',
          severity: 1,
          probability: 1,
        });
      }

      const mediaGeralSetor = stats.totalPontos / stats.count;
      const mediaRedFlags = stats.totalRedFlags / stats.count;

      // Conversão 0-100 para escala 1-4
      // Severidade: Média de pontos (Impacto Psicológico)
      let s = 1;
      if (mediaGeralSetor > 75) s = 4;
      else if (mediaGeralSetor > 50) s = 3;
      else if (mediaGeralSetor > 25) s = 2;

      // Probabilidade: Presença de Comportamentos Ofensivos (Red Flags)
      let p = 1;
      if (mediaRedFlags > 2) p = 4; // Muitos comportamentos ofensivos recorrentes
      else if (mediaRedFlags > 1) p = 3;
      else if (mediaRedFlags > 0) p = 2;

      return this.calcularCategorizacao({
        id: dept.id,
        setor: dept.nome,
        funcao: 'Empregados Multidisciplinares',
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

  public gerarMockEducacional(): GrupoRisco[] {
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
