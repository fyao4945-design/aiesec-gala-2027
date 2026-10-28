(() => {
    "use strict";

    const accessForm = document.getElementById("access-form");
    const scannerCodeInput = document.getElementById("scanner-code");
    const accessButton = document.getElementById("access-button");

    const accessSection = document.getElementById("access-section");
    const scannerSection = document.getElementById("scanner-section");

    const accessMessage = document.getElementById("access-message");
    const scannerMessage = document.getElementById("scanner-message");
    const scanResult = document.getElementById("scan-result");

    const stopButton = document.getElementById("stop-scanner");
    const logoutButton = document.getElementById("logout-button");

    let scanner = null;
    let scannerCode = "";
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
        scannerMessage.textContent = "Vérification de l'invitation…";

        try {
            const config = getConfig();

            const endpoint =
                `${config.SUPABASE_URL}/functions/v1/validate-invitation`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": config.SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    scannerCode,
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

    // Si le QR code contient une URL, extraire son paramètre token.
    try {
        const url = new URL(contenu);

        token =
            url.searchParams.get("token") ||
            url.searchParams.get("t") ||
            "";

        // Prendre également en charge un jeton placé dans le fragment.
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
        // Le contenu n'est pas une URL : il peut s'agir du jeton brut.
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

    // Le jeton doit contenir exactement 64 caractères hexadécimaux.
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
                // Les erreurs de lecture ponctuelles sont normales.
            }
        );

        stopButton.hidden = false;
        scannerMessage.textContent =
            "Caméra active. Présentez un QR code.";
    }

    accessForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        scannerCode = scannerCodeInput.value.trim();

        if (!scannerCode) {
            accessMessage.textContent =
                "Veuillez saisir le code organisateur.";
            return;
        }

        accessButton.disabled = true;
        accessMessage.textContent = "Vérification du code…";

        try {
            // Le serveur vérifiera réellement le code lors du premier scan.
            // Nous effectuons un contrôle préalable en envoyant un jeton invalide.
            const config = getConfig();

            const response = await fetch(
                `${config.SUPABASE_URL}/functions/v1/validate-invitation`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": config.SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        scannerCode,
                        token: "0".repeat(64)
                    })
                }
            );

            const result = await response.json();

            if (
                response.status === 401 ||
                result.message === "Code organisateur incorrect."
            ) {
                throw new Error("Code organisateur incorrect.");
            }

            if (!response.ok) {
                throw new Error(
                    result.message || "Impossible de contacter le serveur."
                );
            }

            accessSection.hidden = true;
            scannerSection.hidden = false;

            accessMessage.textContent = "";

            await startScanner();

        } catch (error) {
            accessMessage.textContent =
                error.message || "Impossible d'ouvrir le scanner.";

            scannerCode = "";
        } finally {
            accessButton.disabled = false;
        }
    });

    stopButton.addEventListener("click", stopScanner);

    logoutButton.addEventListener("click", async () => {
        await stopScanner();

        scannerCode = "";
        scannerCodeInput.value = "";
        scanResult.replaceChildren();

        scannerSection.hidden = true;
        accessSection.hidden = false;

        accessMessage.textContent =
            "Session fermée. Saisissez le code pour recommencer.";
    });
})();
