// =============================================================================
// config.js: configuração PÚBLICA do portal. Pode ir para o GitHub Pages.
// NUNCA coloque aqui a chave service_role nem nenhum token.
// A chave "anon" é pública por natureza: quem protege os dados é o RLS do banco.
// =============================================================================
window.PORTAL_CONFIG = {
  // Supabase > Project Settings > API
  supabaseUrl: "https://xqsaddtvhrzxjvjasgfz.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2FkZHR2aHJ6eGp2amFzZ2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDA1NzksImV4cCI6MjEwOTkxNjU3OX0.OqMBHBfIDbCx2EXeosgQZ5DrCd0u7W0Tyw9UjuZ-vSU",

  // App do Meta (só usado pelo botão opcional "Conectar Instagram")
  metaAppId: "SEU_META_APP_ID",

  // Botão opcional de login do Instagram. Padrão: false (o caminho principal é o
  // cadastro direto da conta com o token do usuário do sistema).
  loginInstagramAtivo: false
};
