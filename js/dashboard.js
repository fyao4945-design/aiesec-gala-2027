document.addEventListener("DOMContentLoaded", async () => {

    const message = document.getElementById("dashboard-message");
    const logoutButton = document.getElementById("logout-button");
    const chartMessage = document.getElementById("chart-message");
    const pendingEmailSection = document.getElementById(
    "pending-email-section"
);

const pendingEmailMessage = document.getElementById(
    "pending-email-message"
);

const confirmEmailChangeButton = document.getElementById(
    "confirm-email-change-button"
);

const pendingEmailFeedback = document.getElementById(
    "pending-email-feedback"
);
    let invitationsChart = null;

    function showMessage(text, type = "") {
        if (!message) return;

        message.textContent = text;
        message.className = "notice" + (type ? ` ${type}` : "");
    }

    // Mettre à jour une statistique
    function showStat(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    // Créer le graphique
    function createChart(valid, used, revoked) {

        const canvas = document.getElementById("invitations-chart");

        if (!canvas || !window.Chart) {
            chartMessage.textContent =
                "Le graphique n'a pas pu être chargé.";

            return;
        }

        if (invitationsChart) {
            invitationsChart.destroy();
        }

        invitationsChart = new Chart(canvas, {

            type: "doughnut",

            data: {
                labels: [
                    "Valides",
                    "Utilisées",
                    "Révoquées"
                ],

                datasets: [{
                    data: [valid, used, revoked],

                    backgroundColor: [
                        "#0b8f55",
                        "#2463eb",
                        "#dc3545"
                    ],

                    borderWidth: 2,
                    borderColor: "#ffffff",
                    hoverOffset: 8
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom",

                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label} : ${context.raw}`;
                            }
                        }
                    }
                }
            }

        });

        chartMessage.textContent =
            "Répartition des invitations enregistrées pour le gala.";
    }

    try {

        // Vérification de la configuration
        if (!window.supabase || !window.AIESEC_CONFIG) {
            throw new Error("Configuration Supabase introuvable.");
        }

        const {
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        } = window.AIESEC_CONFIG;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Configuration Supabase incomplète.");
        }

        const client = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );
        window.aiesecClient = client;

        // Vérification de la session
        const { data: sessionData, error: sessionError } =
            await client.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
            window.location.href = "connexion.html";
            return;
        }

        // Vérification du profil
        const { data: profile, error: profileError } = await client
            .from("profiles")
            .select("full_name, role, is_active, pending_email")
            .eq("id", session.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (
            !profile ||
            !profile.is_active ||
            !["admin", "organizer"].includes(profile.role)
        ) {
            await client.auth.signOut();
            window.location.href = "connexion.html";
            return;
        }

        // Afficher la gestion des organisateurs uniquement pour l'administrateur
        const organizersMenuLink = document.getElementById(
            "organizers-menu-link"
        );

        if (organizersMenuLink && profile.role === "admin") {
            organizersMenuLink.style.display = "flex";
        }

        // Afficher le changement d'e-mail en attente
        if (profile.pending_email) {
            pendingEmailSection.style.display = "block";

            pendingEmailMessage.textContent =
            `Une modification de votre adresse e-mail est en attente. ` +
            `Nouvelle adresse : ${profile.pending_email}`;
        }

                    // Demander la confirmation du changement d'e-mail
confirmEmailChangeButton.addEventListener("click", async () => {

    const pendingEmail = profile.pending_email;

    if (!pendingEmail) {
        pendingEmailFeedback.textContent =
            "Aucun changement d'adresse e-mail en attente.";

        return;
    }

    confirmEmailChangeButton.disabled = true;

    confirmEmailChangeButton.textContent =
        "Envoi en cours...";

    pendingEmailFeedback.style.color = "#374151";

    try {

        const { data, error } = await client.auth.updateUser({
            email: pendingEmail
        });

        if (error) throw error;

        pendingEmailFeedback.style.color = "#168344";

        pendingEmailFeedback.textContent =
            "La demande a été envoyée. Consultez votre boîte e-mail " +
            "pour confirmer le changement d'adresse.";

    } catch (error) {

        console.error(
            "Erreur de changement d'e-mail :",
            error
        );

        pendingEmailFeedback.style.color = "#c62828";

        pendingEmailFeedback.textContent =
            error.message ||
            "Impossible d'envoyer le lien de confirmation.";

    } finally {

        confirmEmailChangeButton.disabled = false;

        confirmEmailChangeButton.textContent =
            "Renvoyer le lien de confirmation";
    }
    });

        showMessage(
            `Connecté en tant que ${profile.role === "admin"
                ? "administrateur"
                : "organisateur"}.`
        );

        // Déconnexion
        logoutButton.addEventListener("click", async () => {
            await client.auth.signOut();
            window.location.href = "connexion.html";
        });

        // Recherche de l'événement actif
        const { data: event, error: eventError } = await client
            .from("events")
            .select("id, name")
            .eq("is_active", true)
            .eq("name", "Dîner de Gala AIESEC 2027")
            .maybeSingle();

        if (eventError) throw eventError;

        if (!event) {

            showMessage(
                "Aucun événement actif correspondant au gala n'a été trouvé."
            );

            showStat("total-invitations", 0);
            showStat("total-entries", 0);
            showStat("total-valid", 0);
            showStat("total-revoked", 0);

            chartMessage.textContent =
                "Aucune donnée disponible pour le moment.";

            return;
        }

        // Récupération des invitations
        const { data: invitations, error: invitationsError } =
            await client
                .from("invitations")
                .select(`
                    status,
                    guests!inner (
                        event_id
                    )
                `)
                .eq("guests.event_id", event.id);

        if (invitationsError) throw invitationsError;

        const allInvitations = invitations || [];

        // Calcul des statistiques
        const totalInvitations = allInvitations.length;

        const validCount = allInvitations.filter(
            invitation => invitation.status === "valid"
        ).length;

        const usedCount = allInvitations.filter(
            invitation => invitation.status === "used"
        ).length;

        const revokedCount = allInvitations.filter(
            invitation => invitation.status === "revoked"
        ).length;

        // Récupération des entrées acceptées
        const { count: entryCount, error: entryError } =
            await client
                .from("entry_logs")
                .select(
                    "id, invitations!inner(guest_id, guests!inner(event_id))",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq("action", "accepted")
                .eq("invitations.guests.event_id", event.id);

        if (entryError) throw entryError;

        // Affichage des statistiques
        showStat("total-used", usedCount);

const usageRate = totalInvitations > 0
    ? ((usedCount / totalInvitations) * 100).toFixed(1)
    : "0.0";

showStat("usage-rate", `${usageRate} %`);
        showStat("total-invitations", totalInvitations);
        showStat("total-entries", entryCount ?? 0);
        showStat("total-valid", validCount);
        showStat("total-revoked", revokedCount);

        // Affichage du graphique
        createChart(
            validCount,
            usedCount,
            revokedCount
        );

    } catch (error) {

        console.error("Erreur du tableau de bord :", error);

        showMessage(
            "Impossible de charger les statistiques. Vérifie la console du navigateur et les autorisations Supabase."
        );

        chartMessage.textContent =
            "Impossible de charger les données du graphique.";

    }

});