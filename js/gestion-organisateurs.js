document.addEventListener("DOMContentLoaded", async () => {
// =====================================
// INITIALISATION
// =====================================

const config = window.AIESEC_CONFIG;

const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
);

window.aiesecClient = client;

const tableBody = document.getElementById("organizers-table-body");
const totalElement = document.getElementById("total-organizers");
const activeElement = document.getElementById("active-organizers");
const suspendedElement = document.getElementById("suspended-organizers");

const searchInput = document.getElementById("organizer-search");
const statusFilter = document.getElementById("organizer-status-filter");
const refreshButton = document.getElementById("refresh-organizers");

const formMessage = document.getElementById("organizer-form-message");
const organizersMessage = document.getElementById("organizers-message");

let organizers = [];

// =====================================
// VERIFICATION DE LA SESSION
// =====================================

const {
    data: { session },
    error: sessionError
} = await client.auth.getSession();

if (sessionError || !session) {
    window.location.href = "connexion.html";
    return;
}

// Vérifier le profil administrateur
const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.user.id)
    .single();

if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    profile.is_active !== true
) {
    alert("Accès réservé à l'administrateur.");
    window.location.href = "dashboard.html";
    return;
}

// =====================================
// APPEL DE L'EDGE FUNCTION
// =====================================

async function callOrganizerFunction(action, payload = {}) {

    const { data, error } = await client.functions.invoke(
        "manage-organizers",
        {
            body: {
                action,
                ...payload
            }
        }
    );

    if (error) {
        throw new Error(error.message || "Erreur de communication avec le serveur.");
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}

// =====================================
// CHARGEMENT DES ORGANISATEURS
// =====================================

async function loadOrganizers() {

    tableBody.innerHTML = `
        <tr>
            <td colspan="5">Chargement des organisateurs...</td>
        </tr>
    `;

    organizersMessage.textContent = "";

    try {

        const result = await callOrganizerFunction("list");

        organizers = result.organizers || [];

        updateStatistics();
        displayOrganizers();

    } catch (error) {

        console.error("Erreur chargement organisateurs :", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">Impossible de charger les organisateurs.</td>
            </tr>
        `;

        organizersMessage.textContent = error.message;
    }
}

// =====================================
// STATISTIQUES
// =====================================

function updateStatistics() {

    const total = organizers.length;

    const active = organizers.filter(
        organizer => organizer.is_active === true
    ).length;

    const suspended = organizers.filter(
        organizer => organizer.is_active === false
    ).length;

    totalElement.textContent = total;
    activeElement.textContent = active;
    suspendedElement.textContent = suspended;
}

// =====================================
// AFFICHAGE DU TABLEAU
// =====================================

function displayOrganizers() {

    const search = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;

    const filtered = organizers.filter(organizer => {

        const matchesSearch =
            (organizer.full_name || "").toLowerCase().includes(search) ||
            (organizer.email || "").toLowerCase().includes(search);

        const matchesStatus =
            status === "all" ||
            (status === "active" && organizer.is_active === true) ||
            (status === "suspended" && organizer.is_active === false);

        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">Aucun organisateur trouvé.</td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = filtered.map(organizer => {

        const date = organizer.created_at
            ? new Date(organizer.created_at).toLocaleDateString("fr-FR")
            : "Non disponible";

        const statusBadge = organizer.is_active
            ? '<span class="organizer-badge active">Actif</span>'
            : '<span class="organizer-badge suspended">Suspendu</span>';

        return `
            <tr>
                <td>${escapeHTML(organizer.full_name || "Sans nom")}</td>
                <td>${escapeHTML(organizer.email || "E-mail indisponible")}</td>
                <td>${date}</td>
                <td>${statusBadge}</td>
                <td>
                    <button
                        type="button"
                        class="organizer-view-button"
                        data-id="${escapeHTML(organizer.id)}"
                        title="Voir les informations"
                    >
                        Voir
                    </button>
                </td>
            </tr>
        `;

    }).join("");

}

// =====================================
// PROTECTION DES DONNEES HTML
// =====================================

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);

}

// =====================================
// RECHERCHE ET FILTRES
// =====================================

searchInput.addEventListener("input", displayOrganizers);
statusFilter.addEventListener("change", displayOrganizers);

refreshButton.addEventListener("click", loadOrganizers);

// =====================================
// BOUTON VOIR
// =====================================

tableBody.addEventListener("click", event => {

    const button = event.target.closest(".organizer-view-button");

    if (!button) return;

    const organizer = organizers.find(
        item => item.id === button.dataset.id
    );

    if (!organizer) return;

    alert(
        "Nom : " + (organizer.full_name || "Non renseigné") +
        "\nE-mail : " + (organizer.email || "Non disponible") +
        "\nStatut : " + (organizer.is_active ? "Actif" : "Suspendu") +
        "\nDate de création : " +
        (organizer.created_at
            ? new Date(organizer.created_at).toLocaleDateString("fr-FR")
            : "Non disponible")
    );

});

// =====================================
// CREATION D'UN ORGANISATEUR
// =====================================

const organizerForm = document.getElementById("organizer-form");
const addButton = document.getElementById("add-organizer-button");

organizerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const fullName = document
        .getElementById("organizer-name")
        .value.trim();

    const email = document
        .getElementById("organizer-email")
        .value.trim();

    if (!fullName || !email) {
        formMessage.textContent = "Veuillez remplir tous les champs.";
        return;
    }

    const confirmed = confirm(
        `Envoyer une invitation à ${fullName} (${email}) ?`
    );

    if (!confirmed) return;

    addButton.disabled = true;
    addButton.textContent = "Envoi en cours...";

    formMessage.textContent = "";

    try {

        const result = await callOrganizerFunction("create", {
            full_name: fullName,
            email: email
        });

        formMessage.textContent =
            result.message || "Invitation envoyée avec succès.";

        formMessage.style.color = "#168344";

        organizerForm.reset();

        await loadOrganizers();

    } catch (error) {

        console.error("Erreur création organisateur :", error);

        formMessage.textContent = error.message;
        formMessage.style.color = "#c62828";

    } finally {

        addButton.disabled = false;
        addButton.textContent = "Envoyer l'invitation";

    }

});

// =====================================
// DECONNEXION
// =====================================

const logoutButton = document.getElementById("logout-button");

logoutButton?.addEventListener("click", async () => {

    const confirmed = confirm("Voulez-vous vraiment vous déconnecter ?");

    if (!confirmed) return;

    const { error } = await client.auth.signOut();

    if (error) {
        alert("Erreur lors de la déconnexion.");
        return;
    }

    window.location.href = "connexion.html";

});

// Chargement initial
await loadOrganizers();

});
