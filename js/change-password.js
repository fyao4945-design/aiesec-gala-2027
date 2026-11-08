document.addEventListener("DOMContentLoaded", async () => {

    const supabaseClient = window.supabase.createClient(
        window.AIESEC_CONFIG.SUPABASE_URL,
        window.AIESEC_CONFIG.SUPABASE_ANON_KEY
    );

    const form = document.getElementById("password-form");
    const message = document.getElementById("password-message");
    const button = document.getElementById("change-password-button");
    const logoutButton = document.getElementById("logout-button");

    const currentPasswordInput = document.getElementById("current-password");
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");

    const currentPasswordLabel = document.querySelector(
        'label[for="current-password"]'
    );

    let recoveryMode = new URLSearchParams(window.location.search)
        .get("type") === "recovery";

    let recoveryEventReceived = false;

    function showMessage(text, type = "") {
        message.textContent = text;
        message.className = "form-message" + (type ? ` ${type}` : "");
    }

    function activateRecoveryMode() {

        recoveryMode = true;

        currentPasswordInput.required = false;
        currentPasswordInput.style.display = "none";
        currentPasswordLabel.style.display = "none";

        button.textContent = "Réinitialiser mon mot de passe";

        document.querySelector("h1").textContent =
            "Réinitialiser mon mot de passe";

        showMessage(
            "Vérification réussie. Vous pouvez définir votre nouveau mot de passe.",
            "success"
        );
    }

    // Écouter les événements d'authentification Supabase
    supabaseClient.auth.onAuthStateChange((event, session) => {

        if (event === "PASSWORD_RECOVERY") {

            recoveryEventReceived = true;
            activateRecoveryMode();

        }

    });

    // Vérification de la session
    try {

        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) {

            showMessage(
                "Session absente ou expirée. Veuillez demander un nouveau lien de réinitialisation.",
                "error"
            );

            form.style.display = "none";
            return;
        }

        if (recoveryMode || recoveryEventReceived) {

            activateRecoveryMode();

        } else {

            showMessage(
                "Session vérifiée. Vous pouvez modifier votre mot de passe.",
                "success"
            );

        }

    } catch (error) {

        console.error("Erreur de session :", error);

        showMessage(
            "Impossible de vérifier votre session.",
            "error"
        );

        form.style.display = "none";
        return;
    }

    // Déconnexion
    if (logoutButton) {

        logoutButton.addEventListener("click", async () => {

            await supabaseClient.auth.signOut();

            window.location.href = "connexion.html";

        });

    }

    // Soumission du formulaire
    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

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

        if (!recoveryMode && currentPassword === newPassword) {

            showMessage(
                "Le nouveau mot de passe doit être différent de l'ancien.",
                "error"
            );

            return;
        }

        button.disabled = true;
        button.textContent = "Enregistrement en cours...";

        try {

            // Vérifier l'utilisateur connecté
            const { data: userData, error: userError } =
                await supabaseClient.auth.getUser();

            if (userError) throw userError;

            if (!userData.user) {
                throw new Error("Utilisateur non authentifié.");
            }

            // Vérification de l'ancien mot de passe
            // Uniquement pour un changement classique
            if (!recoveryMode) {

                const email = userData.user.email;

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

            }

            // Enregistrement du nouveau mot de passe
            const { error: updateError } =
                await supabaseClient.auth.updateUser({
                    password: newPassword
                });

            if (updateError) throw updateError;

            showMessage(
                "Votre mot de passe a été enregistré avec succès !",
                "success"
            );

            form.reset();

            button.textContent = "Mot de passe enregistré";

            // Redirection après une réinitialisation
            if (recoveryMode) {

                setTimeout(async () => {

                    await supabaseClient.auth.signOut();

                    window.location.href = "connexion.html";

                }, 3000);

            }

        } catch (error) {

            console.error("Erreur :", error);

            showMessage(
                error.message || "Une erreur est survenue.",
                "error"
            );

            button.disabled = false;
            button.textContent = recoveryMode
                ? "Réinitialiser mon mot de passe"
                : "Modifier le mot de passe";

        }

    });

});