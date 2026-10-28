document.addEventListener("DOMContentLoaded", async () => {
  const message = document.querySelector("#dashboard-message");
  const config = window.AIESEC_CONFIG || {};
  if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY ||
      config.SUPABASE_URL.includes("VOTRE-PROJET") ||
      config.SUPABASE_ANON_KEY.includes("COLLE_TA_CLE")) {
    message.textContent = "Configurez js/config.js avant d’ouvrir le tableau de bord."; return;
  }
  const client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  try {
    const { data: userData, error } = await client.auth.getUser();
    if (error || !userData.user) { location.href = "connexion.html"; return; }
    const { data: profile, error: profileError } = await client.from("profiles")
      .select("role,is_active").eq("id", userData.user.id).maybeSingle();
    if (profileError || !profile || profile.is_active !== true ||
        !["admin", "organizer"].includes(profile.role)) {
      await client.auth.signOut(); location.href = "connexion.html"; return;
    }
    message.textContent = "Connecté en tant que " + (profile.role === "admin" ? "administrateur" : "organisateur") +
      ". Les statistiques seront activées à l’étape suivante.";
    document.querySelector("#logout-button").addEventListener("click", async () => {
      await client.auth.signOut(); location.href = "connexion.html";
    });
  } catch (error) {
    message.textContent = "Impossible de vérifier la session. Vérifiez la connexion et les politiques RLS de profiles.";
    console.error(error);
  }
});