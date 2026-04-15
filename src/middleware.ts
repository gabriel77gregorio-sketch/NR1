import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Configuração básica de segurança de CSP e Headers para mitigar XSS/Clickjacking
  const response = await next();
  
  if (response.headers) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Content-Security-Policy muito restritivo (ajustar conforme CDN do Supabase entrar)
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
    );
  }

  // Interceptador de Autenticação SSR (Desativado temporariamente para desenvolvimento da UI livre)
  /*
  const isProtectedPath = context.url.pathname.startsWith('/dashboard') || context.url.pathname.startsWith('/api/protected');
  
  if (isProtectedPath) {
    const accessToken = context.cookies.get('sb-access-token');
    const refreshToken = context.cookies.get('sb-refresh-token');

    if (!accessToken || !refreshToken) {
      return context.redirect('/login');
    }
  }
  */

  return response;
});
