document.addEventListener("DOMContentLoaded", async () => {
const message = document.getElementById("dashboard-message");
const logoutButton = document.getElementById("logout-button");
const statCards = document.querySelectorAll(".stat-card");

function showMessage(text, type = "") {
    if (!message) return;
    message.textContent = text;
    message.className = "notice" + (type ? ` ${type}` : "");
}

function showStat(index, value, description) {
    const card = statCards[index];
    if (!card) return;

    const number = card.querySelector("strong");
    const small = card.querySelector("small");

    if (number) number.textContent = value;
    if (small && description) small.textContent = description;
}

try {
    if (!window.supabase || !window.AIESEC_CONFIG) {
        throw new Error("La configuration Supabase est introuvable.");
    }

    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.AIESEC_CONFIG;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("L'URL ou la clé publique Supabase manque dans config.js.");
    }

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
        window.location.href = "connexion.html";
        return;
    }

    const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("full_name, role, is_active")
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

    showMessage(
        `Connecté en tant que ${profile.role === "admin" ? "administrateur" : "organisateur"}.`
    );

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            await client.auth.signOut();
            window.location.href = "connexion.html";
        });
    }

    // Identifier le gala actif.
    const { data: event, error: eventError } = await client
        .from("events")
        .select("id, name")
        .eq("is_active", true)
        .eq("name", "Dîner de Gala AIESEC 2027")
        .maybeSingle();

    if (eventError) throw eventError;

    if (!event) {
        showMessage(
            "Connexion réussie, mais aucun événement actif correspondant au gala n'a été trouvé."
        );
        showStat(0, "—", "Événement introuvable");
        showStat(1, "—", "Événement introuvable");
        showStat(2, "—", "Événement introuvable");
        return;
    }

    // Compter les invitations du gala.
    const { count: invitationCount, error: invitationError } =
        await client
            .from("invitations")
            .select("id, guests!inner(event_id)", {
                count: "exact",
                head: true
            })
            .eq("guests.event_id", event.id);

    if (invitationError) throw invitationError;

    // Compter les entrées validées.
    const { count: entryCount, error: entryError } =
        await client
            .from("entry_logs")
            .select("id, invitations!inner(guest_id, guests!inner(event_id))", {
                count: "exact",
                head: true
            })
            .eq("action", "accepted")
            .eq("invitations.guests.event_id", event.id);

    if (entryError) throw entryError;

    const totalInvitations = invitationCount ?? 0;
    const totalEntries = entryCount ?? 0;

    // Les invitations restantes correspondent aux invitations
    // dont le statut est "valid".
    const { count: remainingCount, error: remainingError } =
        await client
            .from("invitations")
            .select("id, guests!inner(event_id)", {
                count: "exact",
                head: true
            })
            .eq("guests.event_id", event.id)
            .eq("status", "valid");

    if (remainingError) throw remainingError;

    showStat(0, totalInvitations, "Invitations enregistrées");
    showStat(1, totalEntries, "Entrées acceptées");
    showStat(2, remainingCount ?? 0, "Invitations encore valides");

} catch (error) {
    console.error("Erreur du tableau de bord :", error);

    showMessage(
        "Impossible de charger les statistiques. Vérifie la console du navigateur et les autorisations Supabase."
    );
}});
