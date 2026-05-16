import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async (context) => {
  const supabaseClient = supabase(context);
  
  // Realiza o sign out no Supabase
  await supabaseClient.auth.signOut();
  
  // Remove explicitamente os cookies de sessão
  context.cookies.delete("sb-access-token", { path: "/" });
  context.cookies.delete("sb-refresh-token", { path: "/" });

  // Redireciona para o login
  return context.redirect("/login", 302);
};

// Também suporta POST para maior segurança se necessário
export const POST: APIRoute = async (context) => {
    return GET(context);
};
