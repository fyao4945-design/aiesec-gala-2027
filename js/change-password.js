document.addEventListener("DOMContentLoaded", async () => {

    const supabaseClient = window.supabase.createClient(
        window.AIESEC_CONFIG.SUPABASE_URL,
        window.AIESEC_CONFIG.SUPABASE_ANON_KEY
    );

    const form = document.getElementById("password-form");
    const message = document.getElementById("password-message");
    const button = document.getElementById("change-password-button");
    const logoutButton = document.getElementById("logout-button");

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = "form-message" + (type ? ` ${type}` : "");
    }

    // Vérification de la session
    try {

        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            window.location.href = "connexion.html";
            return;
        }

    } catch (error) {

        console.error(error);

        showMessage(
            "Impossible de vérifier votre session.",
            "error"
        );

        return;
    }

    // Déconnexion
    logoutButton.addEventListener("click", async () => {

        await supabaseClient.auth.signOut();

        window.location.href = "connexion.html";

    });

    // Changement du mot de passe
    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const currentPassword =
            document.getElementById("current-password").value;

        const newPassword =
            document.getElementById("new-password").value;

        const confirmPassword =
            document.getElementById("confirm-password").value;

        if (newPassword.length < 8) {

            showMessage(
                "Le nouveau mot de passe doit contenir au moins 8 caractères.",
                "error"
            );

            return;
        }

        if (newPassword !== confirmPassword) {

            showMessage(
                "Les deux nouveaux mots de passe ne correspondent pas.",
                "error"
            );

            return;
        }

        if (currentPassword === newPassword) {

            showMessage(
                "Le nouveau mot de passe doit être différent de l'ancien.",
                "error"
            );

            return;
        }

        button.disabled = true;
        button.textContent = "Modification en cours...";

        try {

            // Récupération de l'utilisateur connecté
            const { data: userData, error: userError } =
                await supabaseClient.auth.getUser();

            if (userError) throw userError;

            const email = userData.user.email;

            if (!email) {
                throw new Error("Adresse e-mail introuvable.");
            }

            // Vérification de l'ancien mot de passe
            const { error: loginError } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: currentPassword
                });

            if (loginError) {

                throw new Error(
                    "L'ancien mot de passe est incorrect."
                );

            }

            // Enregistrement du nouveau mot de passe
            const { error: updateError } =
                await supabaseClient.auth.updateUser({
                    password: newPassword
                });

            if (updateError) throw updateError;

            showMessage(
                "Votre mot de passe a été modifié avec succès !",
                "success"
            );

            form.reset();

        } catch (error) {

            console.error("Erreur :", error);

            showMessage(
                error.message || "Une erreur est survenue.",
                "error"
            );

        } finally {

            button.disabled = false;
            button.textContent = "Modifier le mot de passe";

        }

    });

});