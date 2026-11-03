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

const organizerForm = document.getElementById("organizer-form");
const addButton = document.getElementById("add-organizer-button");
// Éléments de la fenêtre de modification
const editOrganizerModal = document.getElementById("edit-organizer-modal");
const editOrganizerForm = document.getElementById("edit-organizer-form");
const editOrganizerId = document.getElementById("edit-organizer-id");
const editOrganizerName = document.getElementById("edit-organizer-name");
const editOrganizerEmail = document.getElementById("edit-organizer-email");
const editOrganizerMessage = document.getElementById("edit-organizer-message");

const editOrganizerClose = document.getElementById("edit-organizer-close");
const editOrganizerCancel = document.getElementById("edit-organizer-cancel");

let organizers = [];

// =====================================
// MODALE DE CONFIRMATION
// =====================================

const confirmModal = document.getElementById("confirm-modal");
const confirmModalMessage = document.getElementById("confirm-modal-message");
const confirmAccept = document.getElementById("confirm-accept");
const confirmCancel = document.getElementById("confirm-cancel");

let confirmResolver = null;

function openConfirmModal(message, buttonText = "Confirmer") {

    confirmModalMessage.textContent = message;
    confirmAccept.textContent = buttonText;

    confirmModal.classList.add("active");

    return new Promise(resolve => {
        confirmResolver = resolve;
    });
}

function closeConfirmModal(result) {

    confirmModal.classList.remove("active");

    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }

    confirmAccept.textContent = "Confirmer";
}

confirmAccept.addEventListener("click", () => {
    closeConfirmModal(true);
});

confirmCancel.addEventListener("click", () => {
    closeConfirmModal(false);
});

confirmModal.addEventListener("click", event => {
    if (event.target === confirmModal) {
        closeConfirmModal(false);
    }
});

// =====================================
// MODALE DES INFORMATIONS
// =====================================

const detailsModal = document.getElementById("details-modal");

const detailName = document.getElementById("detail-name");
const detailEmail = document.getElementById("detail-email");
const detailStatus = document.getElementById("detail-status");
const detailDate = document.getElementById("detail-date");

const detailsClose = document.getElementById("details-close");
const detailsOk = document.getElementById("details-ok");

function closeDetailsModal() {
    detailsModal.classList.remove("active");
}

detailsClose.addEventListener("click", closeDetailsModal);
detailsOk.addEventListener("click", closeDetailsModal);

detailsModal.addEventListener("click", event => {
    if (event.target === detailsModal) {
        closeDetailsModal();
    }
});

// Fermeture des modales avec la touche Échap
document.addEventListener("keydown", event => {

    if (event.key === "Escape") {
        closeConfirmModal(false);
        closeDetailsModal();
    }

});

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
// CHARGEMENT DES ORGANISATEURS
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

        const actionButton = organizer.is_active
            ? `
                <button
                    type="button"
                    class="organizer-toggle-button suspend-button"
                    data-id="${escapeHTML(organizer.id)}"
                    data-action="suspend">
                    Suspendre
                </button>
            `
            : `
                <button
                    type="button"
                    class="organizer-toggle-button reactivate-button"
                    data-id="${escapeHTML(organizer.id)}"
                    data-action="reactivate">
                    Réactiver
                </button>
            `;

        return `
            <tr>
                <td>${escapeHTML(organizer.full_name || "Sans nom")}</td>
                <td>${escapeHTML(organizer.email || "E-mail indisponible")}</td>
                <td>${date}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="organizer-actions">

                        <button
                            type="button"
                            class="organizer-view-button"
                            data-id="${escapeHTML(organizer.id)}">
                            Voir
                        </button>

                        <button
                            type="button"
                            class="organizer-edit-button"
                            data-id="${escapeHTML(organizer.id)}">
                            Modifier
                        </button>

                        ${actionButton}

                    </div>
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

    detailName.textContent = organizer.full_name || "Non renseigné";

    detailEmail.textContent = organizer.email || "Non disponible";

    detailStatus.textContent = organizer.is_active
        ? "Actif"
        : "Suspendu";

    detailDate.textContent = organizer.created_at
        ? new Date(organizer.created_at).toLocaleDateString("fr-FR")
        : "Non disponible";

    detailsModal.classList.add("active");

});

// =====================================
// BOUTON MODIFIER
// =====================================

tableBody.addEventListener("click", event => {

    const button = event.target.closest(".organizer-edit-button");

    if (!button) return;

    const organizer = organizers.find(
        item => item.id === button.dataset.id
    );

    if (!organizer) return;

    // Préremplir les champs
    editOrganizerId.value = organizer.id;
    editOrganizerName.value = organizer.full_name || "";
    editOrganizerEmail.value = organizer.email || "";

    // Réinitialiser le message
    editOrganizerMessage.textContent = "";

    // Ouvrir la fenêtre
    editOrganizerModal.classList.add("active");

});

// =====================================
// FERMETURE DE LA FENÊTRE DE MODIFICATION
// =====================================

function closeEditOrganizerModal() {
    editOrganizerModal.classList.remove("active");
    editOrganizerForm.reset();
    editOrganizerMessage.textContent = "";
}

editOrganizerClose.addEventListener("click", closeEditOrganizerModal);

editOrganizerCancel.addEventListener("click", closeEditOrganizerModal);

editOrganizerModal.addEventListener("click", event => {
    if (event.target === editOrganizerModal) {
        closeEditOrganizerModal();
    }
});

// =====================================
// ENREGISTRER LES MODIFICATIONS
// =====================================

editOrganizerForm.addEventListener("submit", async event => {

    event.preventDefault();

    const organizerId = editOrganizerId.value;
    const fullName = editOrganizerName.value.trim();
    const newEmail = editOrganizerEmail.value.trim().toLowerCase();

    const organizer = organizers.find(
        item => item.id === organizerId
    );

    if (!organizer) {
        editOrganizerMessage.textContent = "Organisateur introuvable.";
        return;
    }

    if (fullName.length < 2 || fullName.length > 100) {
        editOrganizerMessage.textContent =
            "Le nom doit contenir entre 2 et 100 caractères.";
        return;
    }

    const emailChanged =
        newEmail !== (organizer.email || "").trim().toLowerCase();

    // Pour le moment, on bloque le changement d'e-mail.
    // Il sera activé avec la confirmation par e-mail.
    if (emailChanged) {
  const saveButton = document.getElementById("edit-organizer-save");

  saveButton.disabled = true;
  saveButton.textContent = "Enregistrement...";

  try {
    const result = await callOrganizerFunction(
      "request-email-change",
      {
        organizer_id: organizerId,
        new_email: newEmail
      }
    );

    editOrganizerMessage.style.color = "#168344";
    editOrganizerMessage.textContent =
      result.message || "Nouvelle adresse enregistrée.";

    await loadOrganizers();

    setTimeout(() => closeEditOrganizerModal(), 2000);

  } catch (error) {
    editOrganizerMessage.style.color = "#c62828";
    editOrganizerMessage.textContent =
      error.message || "Impossible d'enregistrer la nouvelle adresse.";

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Enregistrer";
  }

  return;
}

    const saveButton = document.getElementById("edit-organizer-save");

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement...";

    try {

        const result = await callOrganizerFunction("update-name", {
            organizer_id: organizerId,
            full_name: fullName
        });

        editOrganizerMessage.style.color = "#168344";
        editOrganizerMessage.textContent =
            result.message || "Nom modifié avec succès.";

        await loadOrganizers();

        setTimeout(() => {
            closeEditOrganizerModal();
        }, 1200);

    } catch (error) {

        console.error("Erreur modification organisateur :", error);

        editOrganizerMessage.style.color = "#c62828";
        editOrganizerMessage.textContent = error.message;

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Enregistrer";

    }

});

// =====================================
// SUSPENDRE / REACTIVER UN ORGANISATEUR
// =====================================

tableBody.addEventListener("click", async event => {

    const button = event.target.closest(".organizer-toggle-button");

    if (!button) return;

    const organizerId = button.dataset.id;
    const action = button.dataset.action;

    const organizer = organizers.find(
        item => item.id === organizerId
    );

    if (!organizer) return;

    const isSuspending = action === "suspend";

    const confirmationMessage = isSuspending
        ? `Voulez-vous vraiment suspendre le compte de ${organizer.full_name} ?`
        : `Voulez-vous réactiver le compte de ${organizer.full_name} ?`;

    const confirmed = await openConfirmModal(
        confirmationMessage,
        isSuspending ? "Suspendre le compte" : "Réactiver le compte"
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Traitement...";

    try {

        const result = await callOrganizerFunction(action, {
            organizer_id: organizerId
        });

        organizersMessage.style.color = "#168344";
        organizersMessage.textContent =
            result.message || "Opération effectuée avec succès.";

        await loadOrganizers();

    } catch (error) {

        console.error("Erreur modification organisateur :", error);

        organizersMessage.style.color = "#c62828";
        organizersMessage.textContent = error.message;

        button.disabled = false;
        button.textContent = isSuspending ? "Suspendre" : "Réactiver";

    }

});

// =====================================
// CREATION D'UN ORGANISATEUR
// =====================================

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

    const confirmed = await openConfirmModal(
        `Envoyer une invitation à ${fullName} (${email}) ?`,
        "Envoyer l'invitation"
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

    const confirmed = await openConfirmModal(
        "Voulez-vous vraiment vous déconnecter ?",
        "Me déconnecter"
    );

    if (!confirmed) return;

    const { error } = await client.auth.signOut();

    if (error) {
        organizersMessage.textContent = "Erreur lors de la déconnexion.";
        return;
    }

    window.location.href = "connexion.html";

});

// =====================================
// CHARGEMENT INITIAL
// =====================================

await loadOrganizers();

});