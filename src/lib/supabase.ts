import { createServerClient, parseCookieHeader } from '@supabase/ssr';

export const supabase = (context: any) => {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              context.cookies.set(name, value, options);
            } catch (error) {
              // Ignorar erro se a resposta já tiver sido enviada
            }
          });
        },
      },
    }
  );
};
