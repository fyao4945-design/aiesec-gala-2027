document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form");
  if (!form) return;
  const message = document.querySelector("#login-message");
  const button = document.querySelector("#login-button");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = window.AIESEC_CONFIG || {};
    if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY ||
        config.SUPABASE_URL.includes("VOTRE-PROJET") ||
        config.SUPABASE_ANON_KEY.includes("COLLE_TA_CLE")) {
      message.textContent = "La configuration Supabase est incomplète. Vérifiez js/config.js.";
      return;
    }
    button.disabled = true; message.textContent = "Connexion en cours…";
    try {
      const client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      const { data, error } = await client.auth.signInWithPassword({
        email: document.querySelector("#email").value.trim(),
        password: document.querySelector("#password").value
      });
      if (error) throw error;
      const { data: profile, error: profileError } = await client
        .from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
      if (profileError || !profile || profile.is_active !== true ||
          !["admin", "organizer"].includes(profile.role)) {
        await client.auth.signOut();
        message.textContent = "Connexion refusée : aucun profil administrateur/organisateur actif n’est associé à ce compte.";
        return;
      }
      location.href = "dashboard.html";
    } catch (error) {
      message.textContent = "Connexion impossible. Vérifiez l’e-mail, le mot de passe et les paramètres Supabase.";
      console.error("Erreur de connexion Supabase:", error.message);
    } finally { button.disabled = false; }
  });
});