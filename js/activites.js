// ============================================
// JOURNAL DES ACTIVITÉS - AIESEC GALA 2027
// ============================================

// Initialisation Supabase
const supabaseClient = window.supabase.createClient(
    window.AIESEC_CONFIG.SUPABASE_URL,
    window.AIESEC_CONFIG.SUPABASE_ANON_KEY
);

const EVENT_ID = "62bbf5e1-4c28-4c30-82ff-998470a1744c";

// Éléments HTML
const activitiesBody = document.getElementById("activities-body");
const searchInput = document.getElementById("search-input");
const actionFilter = document.getElementById("action-filter");
const dateFrom = document.getElementById("date-from");
const dateTo = document.getElementById("date-to");
const refreshButton = document.getElementById("refresh-button");
const resetFiltersButton = document.getElementById("reset-filters");
const exportButton = document.getElementById("export-excel-button");
const resultsCount = document.getElementById("results-count");
const pageMessage = document.getElementById("page-message");

let allActivities = [];
let filteredActivities = [];
let organizerNames = {};

// Libellés des opérations
const actionLabels = {
    accepted: "Entrée autorisée",
    invalid: "Invitation invalide",
    already_used: "Déjà utilisée",
    revoked: "Invitation révoquée"
};

// Icônes et couleurs
const actionStyles = {
    accepted: {
        icon: "✓",
        className: "activity-success",
        result: "Autorisé"
    },
    invalid: {
        icon: "✕",
        className: "activity-danger",
        result: "Refusé"
    },
    already_used: {
        icon: "↻",
        className: "activity-warning",
        result: "Refusé"
    },
    revoked: {
        icon: "⊘",
        className: "activity-revoked",
        result: "Révoqué"
    }
};

// Protection HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Messages
function showMessage(message, type = "info") {
    pageMessage.textContent = message;
    pageMessage.className = `notice activity-notice ${type}`;
}

// Date et heure
function formatDate(dateValue) {
    if (!dateValue) return "—";

    return new Date(dateValue).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Date locale pour les filtres
function getLocalDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Participant
function getParticipant(activity) {
    const guest = activity.invitation?.guest;

    if (!guest) return "Participant inconnu";

    return `${guest.last_name || ""} ${guest.first_names || ""}`.trim()
        || "Participant inconnu";
}

// Organisateur
function getOrganizer(activity) {
    if (!activity.organizer_id) {
        return "Organisateur non identifié";
    }

    return organizerNames[activity.organizer_id]
        || "Organisateur non identifié";
}

// Charger les activités
async function loadActivities() {

    activitiesBody.innerHTML = `
        <tr>
            <td colspan="7">Chargement des activités...</td>
        </tr>
    `;

    refreshButton.disabled = true;

    showMessage("Chargement du journal des activités...");

    try {

        // 1. Récupérer les invités de l'événement
        const { data: guests, error: guestsError } =
            await supabaseClient
                .from("guests")
                .select("id")
                .eq("event_id", EVENT_ID);

        if (guestsError) throw guestsError;

        const guestIds = (guests || []).map(guest => guest.id);

        let invitationIds = [];

        if (guestIds.length > 0) {

            // 2. Récupérer les invitations
            const { data: invitations, error: invitationsError } =
                await supabaseClient
                    .from("invitations")
                    .select("id")
                    .in("guest_id", guestIds);

            if (invitationsError) throw invitationsError;

            invitationIds = (invitations || []).map(item => item.id);
        }

        // 3. Récupérer les journaux
        let query = supabaseClient
            .from("entry_logs")
            .select(`
                id,
                invitation_id,
                organizer_id,
                action,
                scanned_at,
                note,
                invitation:invitations (
                    invitation_number,
                    guest:guests (
                        last_name,
                        first_names,
                        organization
                    )
                )
            `);

        // Inclure les tentatives invalides sans invitation
        if (invitationIds.length > 0) {

            query = query.or(
                `invitation_id.in.(${invitationIds.join(",")}),and(invitation_id.is.null,action.eq.invalid)`
            );

        } else {

            query = query.is("invitation_id", null)
                .eq("action", "invalid");
        }

        const { data, error } = await query
            .order("scanned_at", { ascending: false });

        if (error) throw error;

        allActivities = data || [];

        // 4. Récupérer les organisateurs
        const organizerIds = [
            ...new Set(
                allActivities
                    .map(activity => activity.organizer_id)
                    .filter(Boolean)
            )
        ];

        organizerNames = {};

        if (organizerIds.length > 0) {

            const { data: profiles, error: profilesError } =
                await supabaseClient
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", organizerIds);

            if (profilesError) throw profilesError;

            (profiles || []).forEach(profile => {
                organizerNames[profile.id] =
                    profile.full_name || "Nom non renseigné";
            });
        }

        applyFilters();

        showMessage(
            `${allActivities.length} opération(s) récupérée(s).`,
            "success"
        );

    } catch (error) {

        console.error("Erreur de chargement :", error);

        activitiesBody.innerHTML = `
            <tr>
                <td colspan="7">
                    Impossible de charger les activités.
                </td>
            </tr>
        `;

        showMessage(
            "Erreur lors du chargement : " + error.message,
            "error"
        );

    } finally {
        refreshButton.disabled = false;
    }
}

// Appliquer les filtres
function applyFilters() {

    const search = searchInput.value.trim().toLowerCase();
    const selectedAction = actionFilter.value;

    const from = dateFrom.value;
    const to = dateTo.value;

    filteredActivities = allActivities.filter(activity => {

        const participant = getParticipant(activity).toLowerCase();

        const number = (
            activity.invitation?.invitation_number || ""
        ).toLowerCase();

        const organizer = getOrganizer(activity).toLowerCase();

        const organization = (
            activity.invitation?.guest?.organization || ""
        ).toLowerCase();

        const note = (activity.note || "").toLowerCase();

        const matchesSearch =
            participant.includes(search) ||
            number.includes(search) ||
            organizer.includes(search) ||
            organization.includes(search) ||
            note.includes(search);

        const matchesAction =
            selectedAction === "all" ||
            activity.action === selectedAction;

        const activityDate = getLocalDate(activity.scanned_at);

        const matchesFrom = !from || activityDate >= from;
        const matchesTo = !to || activityDate <= to;

        return (
            matchesSearch &&
            matchesAction &&
            matchesFrom &&
            matchesTo
        );
    });

    renderActivities();
}

// Afficher les activités
function renderActivities() {

    resultsCount.textContent =
        `${filteredActivities.length} opération(s) affichée(s) sur ${allActivities.length}`;

    if (filteredActivities.length === 0) {

        activitiesBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-activities">
                    <span>◷</span>
                    <strong>Aucune activité trouvée</strong>
                    <small>Essayez de modifier vos critères de recherche.</small>
                </td>
            </tr>
        `;

        return;
    }

    activitiesBody.innerHTML = filteredActivities.map(activity => {

        const style = actionStyles[activity.action] || {
            icon: "•",
            className: "activity-neutral",
            result: "Information"
        };

        const action =
            actionLabels[activity.action] || activity.action;

        const participant = getParticipant(activity);

        const number =
            activity.invitation?.invitation_number || "—";

        const organization =
            activity.invitation?.guest?.organization || "";

        const organizer = getOrganizer(activity);

        return `
            <tr class="activity-row">

                <td class="activity-date">
                    <strong>
                        ${escapeHTML(formatDate(activity.scanned_at))}
                    </strong>
                </td>

                <td>
                    <span class="invitation-reference">
                        ${escapeHTML(number)}
                    </span>
                </td>

                <td>
                    <div class="activity-person">
                        <strong>${escapeHTML(participant)}</strong>
                        <small>${escapeHTML(organization)}</small>
                    </div>
                </td>

                <td>
                    <div class="activity-organizer">
                        <span class="organizer-icon">♙</span>
                        <span>${escapeHTML(organizer)}</span>
                    </div>
                </td>

                <td>
                    <span class="operation-label">
                        ${escapeHTML(action)}
                    </span>
                </td>

                <td>
                    <span class="activity-badge ${style.className}">
                        ${style.icon} ${escapeHTML(style.result)}
                    </span>
                </td>

                <td class="activity-note">
                    ${escapeHTML(activity.note || "—")}
                </td>

            </tr>
        `;

    }).join("");
}

// Réinitialiser les filtres
function resetFilters() {

    searchInput.value = "";
    actionFilter.value = "all";
    dateFrom.value = "";
    dateTo.value = "";

    applyFilters();
}

// Export Excel
function exportActivities() {

    if (filteredActivities.length === 0) {
        alert("Aucune activité à exporter.");
        return;
    }

    if (typeof XLSX === "undefined") {
        alert("La bibliothèque Excel n'est pas chargée.");
        return;
    }

    const rows = filteredActivities.map(activity => ({

        "Date et heure": formatDate(activity.scanned_at),

        "Numéro d'invitation":
            activity.invitation?.invitation_number || "",

        "Participant": getParticipant(activity),

        "Organisation":
            activity.invitation?.guest?.organization || "",

        "Organisateur": getOrganizer(activity),

        "Opération":
            actionLabels[activity.action] || activity.action,

        "Résultat":
            actionStyles[activity.action]?.result || "Information",

        "Informations": activity.note || ""

    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
        { wch: 23 },
        { wch: 22 },
        { wch: 30 },
        { wch: 25 },
        { wch: 28 },
        { wch: 20 },
        { wch: 18 },
        { wch: 40 }
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Journal des activités"
    );

    XLSX.writeFile(
        workbook,
        "Journal_activites_AIESEC_2027.xlsx"
    );
}

// Événements
searchInput.addEventListener("input", applyFilters);
actionFilter.addEventListener("change", applyFilters);
dateFrom.addEventListener("change", applyFilters);
dateTo.addEventListener("change", applyFilters);

refreshButton.addEventListener("click", loadActivities);
resetFiltersButton.addEventListener("click", resetFilters);
exportButton.addEventListener("click", exportActivities);

// Chargement initial
loadActivities();