import type { APIRoute } from 'astro';
import { DenunciaService } from '../../services/DenunciaService';

export const GET: APIRoute = async ({ url }) => {
  const termo = url.searchParams.get('q');
  
  if (!termo || termo.length < 3) {
    return new Response(JSON.stringify([]), { status: 200 });
  }

  try {
    const service = new DenunciaService();
    const empresas = await service.pesquisarEmpresas(termo);
    
    return new Response(JSON.stringify(empresas), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
