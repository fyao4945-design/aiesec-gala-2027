document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("password-form");
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirm-password");
    const button = document.getElementById("password-button");
    const message = document.getElementById("password-message");

    const config = window.AIESEC_CONFIG || {};

    if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
        message.textContent = "Configuration Supabase introuvable.";
        return;
    }

    const client = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    window.aiesecClient = client;

    // Vérifier la présence d'une session issue de l'invitation
    try {
        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            message.textContent =
                "Lien d'invitation invalide ou expiré. Demandez une nouvelle invitation à l'administrateur.";
            form.style.display = "none";
            return;
        }
    } catch (error) {
        console.error("Erreur de vérification :", error);
        message.textContent = "Impossible de vérifier votre invitation.";
        form.style.display = "none";
        return;
    }

    // Enregistrer le nouveau mot de passe
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const password = passwordInput.value;
        const confirmation = confirmInput.value;

        if (password.length < 8) {
            message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
            return;
        }

        if (password !== confirmation) {
            message.textContent = "Les deux mots de passe ne correspondent pas.";
            return;
        }

        button.disabled = true;
        button.textContent = "Activation en cours...";
        message.textContent = "";

        try {
            const { error } = await client.auth.updateUser({
                password: password
            });

            if (error) throw error;

            message.style.color = "#168344";
            message.textContent =
                "Votre compte est activé ! Vous allez être redirigé vers la connexion.";

            form.reset();

            setTimeout(async () => {
                await client.auth.signOut();
                window.location.href = "connexion.html";
            }, 2500);

        } catch (error) {
            console.error("Erreur d'activation :", error);

            message.style.color = "#dc2626";
            message.textContent =
                error.message || "Une erreur est survenue pendant l'activation.";

            button.disabled = false;
            button.textContent = "Activer mon compte";
        }
    });
});