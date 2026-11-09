console.log("TEST 1 : le fichier set-password.js est exécuté.");

document.addEventListener("DOMContentLoaded", () => {
    console.log("TEST 2 : DOMContentLoaded est exécuté.");
});
document.addEventListener("DOMContentLoaded", async () => {

    const form = document.getElementById("password-form");
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirm-password");
    const button = document.getElementById("password-button");
    const message = document.getElementById("password-message");

    // Vérifier les éléments HTML
    if (!form || !passwordInput || !confirmInput || !button || !message) {
        console.error("Un ou plusieurs éléments HTML sont introuvables.");
        return;
    }
    //Remplacement temporaire
    const config = window.AIESEC_CONFIG || {};

console.log("DIAGNOSTIC SUPABASE");
console.log("Bibliothèque Supabase :", window.supabase);
console.log("Configuration :", window.AIESEC_CONFIG);
console.log("URL :", config.SUPABASE_URL);
console.log("Clé publique présente :", !!config.SUPABASE_ANON_KEY);

if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    message.style.color = "#dc2626";
    message.textContent = "Configuration Supabase introuvable. Consultez la console.";
    form.style.display = "none";
    return;
} //remplacement temporaire

    const client = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    window.aiesecClient = client;
    console.log("TEST : client Supabase initialisé", client);

    // Vérifier la session d'invitation
    try {

        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            message.style.color = "#dc2626";
            message.textContent =
                "Lien d'invitation invalide ou expiré. Demandez une nouvelle invitation.";

            form.style.display = "none";
            return;
        }

        message.style.color = "#168344";
        message.textContent =
            "Invitation vérifiée. Vous pouvez définir votre mot de passe.";

    } catch (error) {

        console.error("Erreur de vérification :", error);

        message.style.color = "#dc2626";
        message.textContent =
            error.message || "Impossible de vérifier votre invitation.";

        form.style.display = "none";
        return;
    }

    // Soumission du formulaire
    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const password = passwordInput.value;
        const confirmation = confirmInput.value;

        if (password.length < 8) {
            message.style.color = "#dc2626";
            message.textContent =
                "Le mot de passe doit contenir au moins 8 caractères.";
            return;
        }

        if (password !== confirmation) {
            message.style.color = "#dc2626";
            message.textContent =
                "Les deux mots de passe ne correspondent pas.";
            return;
        }

        button.disabled = true;
        button.textContent = "Activation en cours...";

        message.textContent = "";

        try {

            const { data, error } = await client.auth.updateUser({
                password: password
            });

            if (error) throw error;

            console.log("Compte activé :", data.user?.id);

            message.style.color = "#168344";
            message.textContent =
                "Votre mot de passe a été enregistré avec succès ! Redirection vers la connexion...";

            form.reset();

            setTimeout(async () => {

                await client.auth.signOut();

                window.location.href = "connexion.html";

            }, 3000);

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