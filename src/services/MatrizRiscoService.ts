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

export interface IndicadorEixo {
  nome: string;
  score: number;
  label: string;
  color: string;
  descricao: string;
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

  /**
   * Consolida a pontuação média por eixo de todos os respondentes para o "Mapa de Calor" do Dashboard
   */
  async getIndicadoresCopsoqConsolidado(setorId?: string): Promise<IndicadorEixo[]> {
    let query = this.supabase
      .from('respostas_avaliacoes')
      .select('respostas');

    const { data: respostasReais, error: errorResp } = await query;

    if (errorResp || !respostasReais || respostasReais.length === 0) {
      console.log("Sem respostas reais, usando mock de indicadores.");
      return this.gerarMockIndicadores();
    }

    const eixos = [
      { id: 'Eixo 1', nome: 'Exigências no Trabalho (Demandas)', desc: 'Avalia ritmo de trabalho, carga quantitativa e exigências emocionais do cargo.' },
      { id: 'Eixo 2', nome: 'Organização e Conteúdo do Trabalho', desc: 'Mede a influência, clareza de papel e o sentido que o colaborador vê nas tarefas.' },
      { id: 'Eixo 3', nome: 'Relações Interpessoais e Liderança', desc: 'Foca na qualidade da liderança, apoio social dos colegas e justiça organizacional.' },
      { id: 'Eixo 4', nome: 'Interface Trabalho-Indivíduo', desc: 'Mapeia o equilíbrio entre vida profissional e pessoal (família) e satisfação geral.' },
      { id: 'Eixo 5', nome: 'Saúde e Bem-Estar', desc: 'Indicadores de estresse, burnout, vitalidade e sintomas psicossomáticos.' },
      { id: 'Eixo 6', nome: 'Comportamentos Ofensivos', desc: 'Frequência de relatos de assédio, bullying, violência ou discriminação.' }
    ];

    const somaEixos: Record<string, { total: number, count: number }> = {};
    eixos.forEach(e => somaEixos[e.id] = { total: 0, count: 0 });

    respostasReais.forEach((row: any) => {
      const resp = row.respostas;
      // Aplicar filtro de setor se fornecido
      if (setorId && resp.setor_id !== setorId) return;

      const detalhes = resp?.detalhes || [];
      detalhes.forEach((d: any) => {
        // Busca a chave correspondente (ex: "Eixo 1" em "Eixo 1: Exigências...")
        const eixoChave = Object.keys(somaEixos).find(key => d.eixo?.startsWith(key));
        
        if (eixoChave) {
          somaEixos[eixoChave].total += (d.pontos || 0);
          somaEixos[eixoChave].count += 1;
        }
      });
    });

    return eixos.map(e => {
      const stats = somaEixos[e.id];
      const media = stats.count > 0 ? stats.total / stats.count : 0;
      
      let label = 'Baixo';
      let color = '#10b981';

      if (media > 66) {
        label = 'Alto';
        color = '#ef4444';
      } else if (media > 33) {
        label = 'Médio';
        color = '#f59e0b';
      }

      return {
        nome: e.nome,
        score: parseFloat(media.toFixed(2)),
        label,
        color,
        descricao: e.desc
      };
    });
  }

  private gerarMockIndicadores(): IndicadorEixo[] {
    return [
      { nome: 'Exigências no Trabalho (Demandas)', score: 72.5, label: 'Alto', color: '#ef4444', descricao: 'Avalia ritmo de trabalho, carga quantitativa e exigências emocionais do cargo.' },
      { nome: 'Organização e Conteúdo do Trabalho', score: 45.2, label: 'Médio', color: '#f59e0b', descricao: 'Mede a influência, clareza de papel e o sentido que o colaborador vê nas tarefas.' },
      { nome: 'Relações Interpessoais e Liderança', score: 28.9, label: 'Baixo', color: '#10b981', descricao: 'Foca na qualidade da liderança, apoio social dos colegas e justiça organizacional.' },
      { nome: 'Interface Trabalho-Indivíduo', score: 55.0, label: 'Médio', color: '#f59e0b', descricao: 'Mapeia o equilíbrio entre vida profissional e pessoal (família) e satisfação geral.' },
      { nome: 'Saúde e Bem-Estar', score: 68.4, label: 'Alto', color: '#ef4444', descricao: 'Indicadores de estresse, burnout, vitalidade e sintomas psicossomáticos.' },
      { nome: 'Comportamentos Ofensivos', score: 12.0, label: 'Baixo', color: '#10b981', descricao: 'Frequência de relatos de assédio, bullying, violência ou discriminação.' }
    ];
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
