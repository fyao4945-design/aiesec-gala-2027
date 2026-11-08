document.addEventListener("DOMContentLoaded", () => {

    const form = document.querySelector("#login-form");

    if (!form) return;

    const message = document.querySelector("#login-message");
    const button = document.querySelector("#login-button");

    // Éléments de récupération du mot de passe
    const forgotLink = document.querySelector("#forgot-password-link");
    const recoverySection = document.querySelector("#recovery-section");
    const recoveryEmail = document.querySelector("#recovery-email");
    const recoveryButton = document.querySelector("#recovery-button");
    const recoveryMessage = document.querySelector("#recovery-message");

    const config = window.AIESEC_CONFIG || {};

    // Vérification de la configuration
    if (
        !window.supabase ||
        !config.SUPABASE_URL ||
        !config.SUPABASE_ANON_KEY
    ) {
        console.error("Configuration Supabase incomplète.");
        return;
    }

    // Création du client Supabase
    const client = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY
    );

    window.aiesecClient = client;

    // CONNEXION
    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        button.disabled = true;
        message.textContent = "Connexion en cours…";

        try {

            const { data, error } = await client.auth.signInWithPassword({
                email: document.querySelector("#email").value.trim(),
                password: document.querySelector("#password").value
            });

            if (error) throw error;

            const { data: profile, error: profileError } = await client
                .from("profiles")
                .select("role,is_active")
                .eq("id", data.user.id)
                .maybeSingle();

            if (
                profileError ||
                !profile ||
                profile.is_active !== true ||
                !["admin", "organizer"].includes(profile.role)
            ) {

                await client.auth.signOut();

                message.textContent =
                    "Connexion refusée : aucun profil administrateur/organisateur actif n’est associé à ce compte.";

                return;
            }

            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Erreur de connexion Supabase :", error);

            message.textContent =
                "Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.";

        } finally {

            button.disabled = false;

        }

    });

    // AFFICHER LA SECTION DE RÉCUPÉRATION
    if (forgotLink && recoverySection) {

        forgotLink.addEventListener("click", (event) => {

            event.preventDefault();

            recoverySection.style.display =
                recoverySection.style.display === "none"
                    ? "block"
                    : "none";

            recoveryEmail.value =
                document.querySelector("#email").value.trim();

        });

    }

    // ENVOI DU MAIL DE RÉINITIALISATION
    if (recoveryButton) {

        recoveryButton.addEventListener("click", async () => {

            const email = recoveryEmail.value.trim();

            if (!email) {

                recoveryMessage.textContent =
                    "Veuillez saisir votre adresse e-mail.";

                return;
            }

            recoveryButton.disabled = true;
            recoveryButton.textContent = "Envoi en cours...";

            recoveryMessage.textContent = "";

            try {

                const { error } =
                    await client.auth.resetPasswordForEmail(email, {

                        redirectTo:
                            "https://fyao4945-design.github.io/aiesec-gala-2027/change-password.html?type=recovery"

                    });

                if (error) throw error;

                recoveryMessage.style.color = "#168344";

                recoveryMessage.textContent =
                    "Si cette adresse correspond à un compte, un e-mail de réinitialisation va être envoyé. Consultez votre boîte de réception.";

            } catch (error) {

                console.error(
                    "Erreur de réinitialisation :",
                    error
                );

                recoveryMessage.style.color = "#dc2626";

                recoveryMessage.textContent =
                    error.message || "Impossible d'envoyer le mail.";

            } finally {

                recoveryButton.disabled = false;

                recoveryButton.textContent =
                    "Envoyer le lien de réinitialisation";

            }

        });

    }

});