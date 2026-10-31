(() => {
"use strict";

const message = document.getElementById("page-message");
const tableBody = document.getElementById("invitations-body");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("statusFilter");
const refreshButton = document.getElementById("refresh-button");
const resultsCount = document.getElementById("results-count");
const logoutButton = document.getElementById("logout-button");

let supabaseClient;
let invitations = [];

function showMessage(text) {
    message.textContent = text;
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
}

function statusLabel(status) {
    const labels = {
        valid: "Valide",
        used: "Utilisée",
        revoked: "Révoquée"
    };

    return labels[status] || status || "Inconnu";
}

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
    return cell;
}

// Récupérer les invitations correspondant aux filtres
function getFilteredInvitations() {

    const query = searchInput.value.trim().toLocaleLowerCase("fr");
    const selectedStatus = statusFilter.value;

    return invitations.filter((invitation) => {

        const guest = invitation.guests || {};

        const searchable = [
            invitation.invitation_number,
            guest.last_name,
            guest.first_names,
            guest.organization
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("fr");

        const matchesSearch = searchable.includes(query);

        const matchesStatus =
            selectedStatus === "all" ||
            invitation.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });
}
// Affichage des invitations
function renderInvitations() {
    const filtered = getFilteredInvitations();

    tableBody.replaceChildren();

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 7;

        cell.textContent = invitations.length === 0
            ? "Aucune invitation enregistrée."
            : "Aucune invitation ne correspond à votre recherche et à votre filtre.";

        row.appendChild(cell);
        tableBody.appendChild(row);

    } else {
        for (const invitation of filtered) {
            const guest = invitation.guests || {};
            const row = document.createElement("tr");

            addCell(row, invitation.invitation_number);

            addCell(
                row,
                [guest.last_name, guest.first_names]
                    .filter(Boolean)
                    .join(" ") || "—"
            );

            addCell(row, guest.organization || "—");
            addCell(row, formatDate(invitation.created_at));
            addCell(row, formatDate(invitation.checked_in_at));

            const statusCell = addCell(
                row,
                statusLabel(invitation.status)
            );

            statusCell.dataset.status = invitation.status || "";

            const actionCell = document.createElement("td");

            const detailsButton = document.createElement("button");
            detailsButton.type = "button";
            detailsButton.textContent = "Voir les détails";
            detailsButton.className = "details-button";

            detailsButton.addEventListener("click", () => {
                showInvitationDetails(invitation);
            });

            actionCell.appendChild(detailsButton);

            if (invitation.status === "valid") {
                const revokeButton = document.createElement("button");

                revokeButton.type = "button";
                revokeButton.textContent = "Révoquer";
                revokeButton.className = "revoke-button";

                revokeButton.addEventListener("click", () => {
                    revokeInvitation(invitation, revokeButton);
                });

                actionCell.appendChild(revokeButton);
            }

            row.appendChild(actionCell);
            tableBody.appendChild(row);
        }
    }

    resultsCount.textContent =
        `${filtered.length} invitation(s) affichée(s) sur ${invitations.length}.`;
}
// Exportation Excel
function exportToExcel() {

    if (typeof XLSX === "undefined") {
        showMessage("La bibliothèque Excel n'a pas pu être chargée.");
        return;
    }

    const filtered = getFilteredInvitations();

    if (filtered.length === 0) {
        showMessage("Aucune invitation à exporter.");
        return;
    }

    const excelData = filtered.map((invitation) => {

        const guest = invitation.guests || {};

        return {
            "Numéro d'invitation": invitation.invitation_number,
            "Nom": guest.last_name || "",
            "Prénoms": guest.first_names || "",
            "Organisation": guest.organization || "",
            "Date de création": formatDate(invitation.created_at),
            "Date d'entrée": formatDate(invitation.checked_in_at),
            "Statut": statusLabel(invitation.status)
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
        { wch: 23 },
        { wch: 20 },
        { wch: 25 },
        { wch: 25 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Invitations"
    );

    const date = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(
        workbook,
        `AIESEC_Gala_Invitations_${date}.xlsx`
    );

    showMessage(`${filtered.length} invitation(s) exportée(s) avec succès.`);
}

// Impression de la liste des invités
// Impression de la liste des invités
function printInvitations() {
    const filtered = getFilteredInvitations();

    if (filtered.length === 0) {
        showMessage("Aucune invitation à imprimer.");
        return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        showMessage("Autorisez les fenêtres pop-up pour imprimer.");
        return;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    const rows = filtered.map((invitation) => {
        const guest = invitation.guests || {};

        return `
            <tr>
                <td>${escapeHTML(invitation.invitation_number)}</td>
                <td>${escapeHTML(guest.last_name)}</td>
                <td>${escapeHTML(guest.first_names)}</td>
                <td>${escapeHTML(guest.organization)}</td>
                <td>${escapeHTML(formatDate(invitation.created_at))}</td>
                <td>${escapeHTML(statusLabel(invitation.status))}</td>
            </tr>
        `;
    }).join("");

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Liste des invités - AIESEC Gala 2027</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 25px;
                    color: #333;
                }

                h1 {
                    color: #003b71;
                    text-align: center;
                }

                .subtitle {
                    text-align: center;
                    margin-bottom: 30px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }

                th {
                    background: #003b71;
                    color: white;
                }

                tr:nth-child(even) {
                    background: #f4f7fa;
                }

                .footer {
                    margin-top: 25px;
                    text-align: right;
                    font-size: 11px;
                    color: #777;
                }

                @page {
                    size: A4 landscape;
                    margin: 12mm;
                }
            </style>
        </head>

        <body>
            <h1>AIESEC - DÎNER DE GALA 2027</h1>

            <p class="subtitle">
                Liste des invités · ${filtered.length} participant(s)
            </p>

            <table>
                <thead>
                    <tr>
                        <th>Numéro</th>
                        <th>Nom</th>
                        <th>Prénoms</th>
                        <th>Organisation</th>
                        <th>Créée le</th>
                        <th>Statut</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>

            <p class="footer">
                Document généré le ${new Date().toLocaleString("fr-FR")}
            </p>

            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}
// Affichage des détails
function showInvitationDetails(invitation) {
    const guest = invitation.guests || {};

    document.getElementById("detail-number").textContent =
        invitation.invitation_number || "—";

    document.getElementById("detail-lastname").textContent =
        guest.last_name || "—";

    document.getElementById("detail-firstnames").textContent =
        guest.first_names || "—";

    document.getElementById("detail-organization").textContent =
        guest.organization || "—";

    document.getElementById("detail-status").textContent =
        statusLabel(invitation.status);

    document.getElementById("detail-created").textContent =
        formatDate(invitation.created_at);

    document.getElementById("detail-entry").textContent =
        formatDate(invitation.checked_in_at);

    document.getElementById("details-modal").hidden = false;
}

// Révocation d'une invitation
let selectedInvitation = null;

// Ouvrir la fenêtre de confirmation
function revokeInvitation(invitation, button) {
    selectedInvitation = {
        invitation,
        button
    };

    const guest = invitation.guests || {};

    const guestName = [
        guest.last_name,
        guest.first_names
    ].filter(Boolean).join(" ");

    document.getElementById("revoke-message").textContent =
        `Voulez-vous vraiment révoquer l'invitation de ${guestName} (${invitation.invitation_number}) ?`;

    document.getElementById("revoke-modal").hidden = false;
}

// Fermer la fenêtre
function closeRevokeModal() {
    document.getElementById("revoke-modal").hidden = true;
    selectedInvitation = null;
}

// Confirmer la révocation
async function confirmRevokeInvitation() {
    if (!selectedInvitation) return;

    const { invitation, button } = selectedInvitation;

    const confirmButton = document.getElementById("confirm-revoke");

    confirmButton.disabled = true;
    confirmButton.textContent = "Révocation...";

    try {
        const { data, error } = await supabaseClient
            .from("invitations")
            .update({ status: "revoked" })
            .eq("id", invitation.id)
            .eq("status", "valid")
            .select("id")
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new Error("Cette invitation n'est plus valide.");
        }

        invitation.status = "revoked";

        renderInvitations();

        showMessage(
            `L'invitation ${invitation.invitation_number} a été révoquée avec succès.`
        );

        closeRevokeModal();

    } catch (error) {
        console.error("Erreur de révocation :", error);

        showMessage(
            "Impossible de révoquer cette invitation. Vérifiez les autorisations Supabase."
        );

        button.disabled = false;
        button.textContent = "Révoquer";

        closeRevokeModal();

    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = "Oui, révoquer";
    }
}

// Chargement des invitations
async function loadInvitations() {
    refreshButton.disabled = true;
    showMessage("Chargement des invitations…");

    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            window.location.href = "connexion.html";
            return;
        }

        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("role, is_active")
                .eq("id", sessionData.session.user.id)
                .maybeSingle();

        if (profileError) throw profileError;

        if (
            !profile ||
            !profile.is_active ||
            !["admin", "organizer"].includes(profile.role)
        ) {
            showMessage(
                "Accès refusé : compte administrateur ou organisateur requis."
            );
            return;
        }

        const { data: event, error: eventError } =
            await supabaseClient
                .from("events")
                .select("id")
                .eq("name", "Dîner de Gala AIESEC 2027")
                .eq("is_active", true)
                .maybeSingle();

        if (eventError) throw eventError;

        if (!event) {
            invitations = [];
            renderInvitations();

            showMessage(
                "Aucun événement actif correspondant au gala n'a été trouvé."
            );

            return;
        }

        const { data, error } = await supabaseClient
            .from("invitations")
            .select(`
                id,
                invitation_number,
                status,
                created_at,
                checked_in_at,
                guests!inner (
                    last_name,
                    first_names,
                    organization,
                    event_id
                )
            `)
            .eq("guests.event_id", event.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        invitations = data || [];

        renderInvitations();

        showMessage(
            invitations.length
                ? "Les invitations ont été chargées."
                : "Aucune invitation trouvée pour cet événement."
        );

    } catch (error) {
        console.error("Chargement des invitations :", error);

        showMessage(
            "Impossible de charger les invitations. Vérifiez la connexion et les autorisations Supabase."
        );

    } finally {
        refreshButton.disabled = false;
    }
}

// Initialisation
async function initialize() {
    try {
        const config = window.AIESEC_CONFIG;

        if (
            !window.supabase ||
            !config ||
            !config.SUPABASE_URL ||
            !config.SUPABASE_ANON_KEY
        ) {
            throw new Error("Configuration Supabase manquante.");
        }

        supabaseClient = window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
        );

        await loadInvitations();

    } catch (error) {
        console.error(error);

        showMessage(
            "Impossible d'initialiser la page. Vérifiez js/config.js."
        );
    }
}

// Événements
document.getElementById("export-excel-button")
    .addEventListener("click", exportToExcel);

document.getElementById("print-button")
    .addEventListener("click", printInvitations);
document.getElementById("cancel-revoke")
    .addEventListener("click", closeRevokeModal);

document.getElementById("confirm-revoke")
    .addEventListener("click", confirmRevokeInvitation);

document.getElementById("revoke-modal")
    .addEventListener("click", (event) => {
        if (event.target.id === "revoke-modal") {
            closeRevokeModal();
        }
    });
searchInput.addEventListener("input", renderInvitations);

statusFilter.addEventListener("change", renderInvitations);

refreshButton.addEventListener("click", loadInvitations);

logoutButton.addEventListener("click", async () => {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }

    window.location.href = "connexion.html";
});

// Fermeture de la fenêtre modale
function closeDetailsModal() {
    document.getElementById("details-modal").hidden = true;
}

document.getElementById("close-modal")
    .addEventListener("click", closeDetailsModal);

document.getElementById("modal-close-button")
    .addEventListener("click", closeDetailsModal);

document.getElementById("details-modal")
    .addEventListener("click", (event) => {
        if (event.target.id === "details-modal") {
            closeDetailsModal();
        }
    });

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
    closeDetailsModal();
    closeRevokeModal();
}
});

// Démarrage
initialize();

})();