(function () {
    "use strict";

    const config = window.AIESEC_CONFIG;

    const form = document.getElementById("invitation-form");
    const message = document.getElementById("form-message");
    const createButton = document.getElementById("create-button");
    const downloadButton = document.getElementById("download-button");

    const previewName = document.getElementById("preview-name");
    const previewCategory = document.getElementById("preview-category");
    const previewNumber = document.getElementById("preview-number");
    const previewQR = document.getElementById("preview-qr");

    let supabaseClient = null;
    let generatedInvitation = null;
    let activeEvent = null;

    function showMessage(text, success = false) {
        message.textContent = text;
        message.className = "message-box " +
            (success ? "message-success" : "message-error");
    }

    function hideMessage() {
        message.textContent = "";
        message.className = "message-box";
    }

    function setBusy(busy) {
        createButton.disabled = busy;
        createButton.textContent = busy
            ? "Création en cours..."
            : "Créer l'invitation";
    }

    function normalizeText(value) {
        return String(value || "").trim();
    }

    function makeInvitationNumber() {
        const date = new Date();
        const year = date.getFullYear();

        const randomPart = Array.from(
            crypto.getRandomValues(new Uint8Array(6))
        )
        .map(value => value.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

        return `AIESEC-${year}-${randomPart}`;
    }

    function createToken() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));

        return Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    async function hashToken(token) {
        const data = new TextEncoder().encode(token);

        const hash = await crypto.subtle.digest("SHA-256", data);

        return Array.from(new Uint8Array(hash))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    async function requireStaff() {
        const {
            data: { session },
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session) {
            window.location.href = "connexion.html";
            throw new Error("Connexion requise.");
        }

        const { data: role, error } = await supabaseClient.rpc(
            "current_user_role"
        );

        if (error) {
            throw error;
        }

        if (!["admin", "organizer"].includes(role)) {
            throw new Error(
                "Accès refusé : un compte administrateur ou organisateur actif est nécessaire."
            );
        }

        return session;
    }

    async function loadEvent() {
        const { data, error } = await supabaseClient
            .from("events")
            .select(
                "id, name, organization, event_date, start_time, venue, address, is_active"
            )
            .eq("name", "Dîner de Gala AIESEC 2027")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "Aucun événement actif n'a été trouvé dans Supabase."
            );
        }

        activeEvent = data;
    }

    function updatePreview() {
        const lastName = normalizeText(
            document.getElementById("last_name").value
        );

        const firstNames = normalizeText(
            document.getElementById("first_names").value
        );

        const category = normalizeText(
            document.getElementById("guest_type").value
        );

        previewName.textContent =
            [firstNames, lastName].filter(Boolean).join(" ") ||
            "Nom de l'invité";

        previewCategory.textContent =
            category || "Catégorie de l'invité";
    }

    function drawQR(url) {
        previewQR.replaceChildren();

        new QRCode(previewQR, {
            text: url,
            width: 150,
            height: 150,
            colorDark: "#10243e",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    function getVerificationURL(token) {
        const url = new URL("verify.html", window.location.href);

        url.searchParams.set("token", token);

        return url.toString();
    }

    async function createInvitation(event) {
        event.preventDefault();
        hideMessage();

        if (!supabaseClient) {
            showMessage("La configuration Supabase est indisponible.");
            return;
        }

        if (!window.crypto || !window.crypto.subtle) {
            showMessage(
                "La génération sécurisée nécessite HTTPS ou localhost."
            );
            return;
        }

        setBusy(true);

        let guestId = null;

        try {
            const session = await requireStaff();

            if (!activeEvent) {
                await loadEvent();
            }

            const lastName = normalizeText(
                document.getElementById("last_name").value
            );

            const firstNames = normalizeText(
                document.getElementById("first_names").value
            );

            const category = normalizeText(
                document.getElementById("guest_type").value
            );

            const organization = normalizeText(
                document.getElementById("organization").value
            );

            const jobTitle = normalizeText(
                document.getElementById("job_title").value
            );

            const phone = normalizeText(
                document.getElementById("phone").value
            );

            const email = normalizeText(
                document.getElementById("email").value
            );

            if (!lastName || !firstNames || !category) {
                throw new Error(
                    "Remplis le nom, les prénoms et la catégorie."
                );
            }

            /*
             * Étape 1 : enregistrer l'invité.
             *
             * La table guests actuelle ne contient pas de colonne
             * guest_type. Nous stockons donc la catégorie dans
             * organization, en attendant une modification du schéma.
             *
             * La catégorie et l'organisation seront séparées dans
             * une prochaine amélioration du modèle de données.
             */

            const guestOrganization = [
                category,
                organization
            ].filter(Boolean).join(" — ");

            const { data: guest, error: guestError } =
                await supabaseClient
                    .from("guests")
                    .insert({
                        event_id: activeEvent.id,
                        last_name: lastName,
                        first_names: firstNames,
                        organization: guestOrganization || null,
                        job_title: jobTitle || null,
                        phone: phone || null,
                        email: email || null,
                        created_by: session.user.id
                    })
                    .select("id")
                    .single();

            if (guestError) {
                throw guestError;
            }

            guestId = guest.id;

            /*
             * Étape 2 : créer le numéro et le jeton.
             */

            const invitationNumber = makeInvitationNumber();
            const token = createToken();
            const tokenHash = await hashToken(token);

            /*
             * Étape 3 : enregistrer l'invitation.
             */

            const { error: invitationError } =
                await supabaseClient
                    .from("invitations")
                    .insert({
                        guest_id: guestId,
                        invitation_number: invitationNumber,
                        token_hash: tokenHash,
                        status: "valid"
                    });

            if (invitationError) {
                throw invitationError;
            }

            /*
             * Étape 4 : préparer la carte.
             */

            const verificationURL = getVerificationURL(token);

            generatedInvitation = {
                guestId,
                invitationNumber,
                token,
                verificationURL,
                lastName,
                firstNames,
                category
            };

            previewNumber.textContent =
                "N° " + invitationNumber;

            drawQR(verificationURL);

            downloadButton.disabled = false;

            showMessage(
                "Invitation enregistrée avec succès. Tu peux maintenant télécharger la carte.",
                true
            );

            /*
             * Empêcher de créer involontairement plusieurs
             * invitations en soumettant à nouveau le formulaire.
             */

            form.reset();

            document.getElementById("last_name").value = lastName;
            document.getElementById("first_names").value = firstNames;
            document.getElementById("guest_type").value = category;
            document.getElementById("organization").value =
                organization;
            document.getElementById("job_title").value = jobTitle;
            document.getElementById("phone").value = phone;
            document.getElementById("email").value = email;

            updatePreview();

        } catch (error) {
            console.error("Création invitation :", error);

            /*
             * Si la création de l'invitation échoue après
             * l'enregistrement de l'invité, on ne supprime pas
             * automatiquement les données : il faut éviter
             * de masquer un éventuel problème de base de données.
             */

            showMessage(
                error.message ||
                "Une erreur est survenue pendant la création."
            );

        } finally {
            setBusy(false);
        }
    }

    async function downloadPNG() {
        if (!generatedInvitation) {
            showMessage("Crée d'abord une invitation.");
            return;
        }

        if (!window.html2canvas) {
            showMessage("Le module de génération PNG est indisponible.");
            return;
        }

        downloadButton.disabled = true;

        try {
            const card = document.getElementById("invitation-card");

            const canvas = await html2canvas(card, {
                scale: 3,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false
            });

            const link = document.createElement("a");

            link.download =
                generatedInvitation.invitationNumber + ".png";

            link.href = canvas.toDataURL("image/png");

            link.click();

            showMessage(
                "La carte PNG a été téléchargée.",
                true
            );

        } catch (error) {
            console.error("Téléchargement PNG :", error);

            showMessage(
                "Impossible de générer le PNG. Vérifie le chargement du logo et des bibliothèques."
            );

        } finally {
            downloadButton.disabled = false;
        }
    }

    async function initialize() {
        if (
            !config ||
            !config.SUPABASE_URL ||
            !config.SUPABASE_ANON_KEY
        ) {
            showMessage(
                "La configuration Supabase est incomplète."
            );
            createButton.disabled = true;
            return;
        }

        if (!window.supabase || !window.supabase.createClient) {
            showMessage(
                "La bibliothèque Supabase n'a pas pu être chargée."
            );
            createButton.disabled = true;
            return;
        }

        supabaseClient = window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
        );

        form.addEventListener("submit", createInvitation);

        downloadButton.addEventListener("click", downloadPNG);

        [
            "last_name",
            "first_names",
            "guest_type"
        ].forEach(id => {
            document.getElementById(id)
                .addEventListener("input", updatePreview);

            document.getElementById(id)
                .addEventListener("change", updatePreview);
        });

        try {
            await requireStaff();
            await loadEvent();

            showMessage(
                "Connecté. Tu peux créer une invitation.",
                true
            );

        } catch (error) {
            console.error("Initialisation :", error);

            if (
                !window.location.href.includes("connexion.html")
            ) {
                showMessage(
                    error.message ||
                    "Impossible de vérifier les autorisations."
                );
            }

            createButton.disabled = true;
        }
    }

    initialize();
})();
