(() => {
    "use strict";

    const accessForm = document.getElementById("access-form");
    const emailInput = document.getElementById("scanner-email");
    const passwordInput = document.getElementById("scanner-password");
    const accessButton = document.getElementById("access-button");

    const accessSection = document.getElementById("access-section");
    const scannerSection = document.getElementById("scanner-section");

    const accessMessage = document.getElementById("access-message");
    const scannerMessage = document.getElementById("scanner-message");
    const scanResult = document.getElementById("scan-result");

    const stopButton = document.getElementById("stop-scanner");
    const logoutButton = document.getElementById("logout-button");

    let scanner = null;
    let client = null;
    let accessToken = "";
    let processing = false;
    let lastToken = "";
    let lastScanTime = 0;

    function getConfig() {
        const config = window.AIESEC_CONFIG;

        if (
            !config ||
            !config.SUPABASE_URL ||
            !config.SUPABASE_ANON_KEY
        ) {
            throw new Error(
                "Configuration Supabase introuvable dans js/config.js."
            );
        }

        return config;
    }

    function initializeSupabase() {
        if (!window.supabase) {
            throw new Error(
                "La bibliothèque Supabase n'a pas été chargée."
            );
        }

        const config = getConfig();

        client = window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
        );

        window.aiesecClient = client;
    }

    function displayResult(status, message, invitation = null) {
        const colors = {
            accepted: "#16803c",
            already_used: "#b42318",
            invalid: "#b42318",
            revoked: "#b42318",
            error: "#8a4b08"
        };

        scanResult.replaceChildren();

        const title = document.createElement("h3");
        title.textContent = message;
        title.style.color = colors[status] || colors.error;

        scanResult.appendChild(title);

        if (invitation) {
            const details = [
                ["Numéro", invitation.invitation_number],
                ["Nom", invitation.last_name],
                ["Prénoms", invitation.first_names],
                ["Organisation", invitation.organization]
            ];

            for (const [label, value] of details) {
                if (!value) continue;

                const paragraph = document.createElement("p");
                paragraph.textContent = `${label} : ${value}`;

                scanResult.appendChild(paragraph);
            }
        }
    }

    async function stopScanner() {
        if (!scanner) return;

        try {
            if (scanner.isScanning) {
                await scanner.stop();
            }

            scanner.clear();
        } catch (error) {
            console.error("Arrêt du scanner :", error);
        }

        scanner = null;
        stopButton.hidden = true;
    }

    async function validateToken(token) {
        if (processing) return;

        processing = true;
        scannerMessage.textContent =
            "Vérification de l'invitation…";

        try {
            const config = getConfig();

            // Récupérer une session valide
            const {
                data: sessionData,
                error: sessionError
            } = await client.auth.getSession();

            if (
                sessionError ||
                !sessionData.session ||
                !sessionData.session.access_token
            ) {
                throw new Error(
                    "Votre session a expiré. Veuillez vous reconnecter."
                );
            }

            accessToken = sessionData.session.access_token;

            const endpoint =
                `${config.SUPABASE_URL}/functions/v1/validate-invitation`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": config.SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    token
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Échec de la vérification."
                );
            }

            displayResult(
                result.status,
                result.message,
                result.invitation
            );

            scannerMessage.textContent =
                result.status === "accepted"
                    ? "Entrée enregistrée."
                    : "Entrée non autorisée.";

        } catch (error) {
            console.error("Erreur de contrôle :", error);

            displayResult(
                "error",
                error.message || "Erreur pendant la vérification."
            );

            scannerMessage.textContent =
                "Vérifiez votre connexion Internet.";
        } finally {
            processing = false;
        }
    }

    async function startScanner() {
        if (!window.Html5Qrcode) {
            throw new Error(
                "Le module de lecture QR n'a pas pu être chargé."
            );
        }

        scanner = new Html5Qrcode("qr-reader");

        await scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },
            async (decodedText) => {
                const contenu = decodedText.trim();
                let token = contenu;

                try {
                    const url = new URL(contenu);

                    token =
                        url.searchParams.get("token") ||
                        url.searchParams.get("t") ||
                        "";

                    if (!token && url.hash) {
                        const fragment = new URLSearchParams(
                            url.hash.slice(1)
                        );

                        token =
                            fragment.get("token") ||
                            fragment.get("t") ||
                            "";
                    }
                } catch {
                    // Le contenu peut être un jeton brut.
                }

                token = token.trim();

                const now = Date.now();

                if (
                    processing ||
                    (
                        token === lastToken &&
                        now - lastScanTime < 3000
                    )
                ) {
                    return;
                }

                lastToken = token;
                lastScanTime = now;

                if (!/^[a-fA-F0-9]{64}$/.test(token)) {
                    displayResult(
                        "invalid",
                        "QR code non reconnu : jeton absent ou format incorrect."
                    );
                    return;
                }

                await validateToken(token);
            },
            () => {
                // Les erreurs ponctuelles de lecture sont normales.
            }
        );

        stopButton.hidden = false;
        scannerMessage.textContent =
            "Caméra active. Présentez un QR code.";
    }

    async function openScanner() {
        accessSection.hidden = true;
        scannerSection.hidden = false;

        accessMessage.textContent = "";

        try {
            await startScanner();
        } catch (error) {
            console.error("Démarrage du scanner :", error);

            scannerMessage.textContent =
                error.message || "Impossible de démarrer la caméra.";

            scannerSection.hidden = true;
            accessSection.hidden = false;
        }
    }

    // Connexion organisateur
    accessForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        accessButton.disabled = true;
        accessMessage.textContent = "Connexion en cours…";

        try {
            initializeSupabase();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            const {
                data,
                error
            } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Vérifier le profil de l'organisateur
            const {
                data: profile,
                error: profileError
            } = await client
                .from("profiles")
                .select("id, role, is_active")
                .eq("id", data.user.id)
                .maybeSingle();

            if (
                profileError ||
                !profile ||
                profile.is_active !== true ||
                !["admin", "organizer"].includes(profile.role)
            ) {
                await client.auth.signOut();

                throw new Error(
                    "Connexion refusée : aucun profil administrateur ou organisateur actif n'est associé à ce compte."
                );
            }

            const {
                data: sessionData,
                error: sessionError
            } = await client.auth.getSession();

            if (
                sessionError ||
                !sessionData.session
            ) {
                throw new Error(
                    "Impossible de récupérer votre session."
                );
            }

            accessToken = sessionData.session.access_token;

            passwordInput.value = "";

            await openScanner();

        } catch (error) {
            console.error("Connexion scanner :", error);

            accessMessage.textContent =
                error.message ||
                "Connexion impossible. Vérifiez vos identifiants.";

        } finally {
            accessButton.disabled = false;
        }
    });

    stopButton.addEventListener("click", stopScanner);

    // Déconnexion
    logoutButton.addEventListener("click", async () => {
        await stopScanner();

        if (client) {
            await client.auth.signOut();
        }

        accessToken = "";
        emailInput.value = "";
        passwordInput.value = "";
        scanResult.replaceChildren();

        scannerSection.hidden = true;
    accessSection.hidden = false;

    accessMessage.textContent =
        "Session fermée. Connectez-vous pour recommencer.";
});

})();