import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const isProtectedPath = 
    context.url.pathname.startsWith('/dashboard') || 
    context.url.pathname.startsWith('/rh') || 
    context.url.pathname.startsWith('/adm') || 
    context.url.pathname.startsWith('/cliente');
  
  if (isProtectedPath) {
    const supabaseClient = supabase(context);
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      return context.redirect('/login');
    }
  }

  // Configuração básica de segurança de CSP e Headers para mitigar XSS/Clickjacking
  const response = await next();
  
  if (response.headers) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
    );
  }

  return response;
});
