document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.getElementById("admin-sidebar");
    const main = document.getElementById("admin-main");

    const toggleButton = document.getElementById("sidebar-toggle");
    const mobileButton = document.getElementById("mobile-menu-button");

    if (!sidebar || !main) return;

    // Restaurer l'état précédent de la barre latérale
    const savedState = localStorage.getItem("adminSidebarCollapsed");

    if (savedState === "true") {
        sidebar.classList.add("collapsed");
        main.classList.add("expanded");
    }

    // Plier ou déplier la barre latérale sur ordinateur
    toggleButton?.addEventListener("click", () => {

        sidebar.classList.toggle("collapsed");
        main.classList.toggle("expanded");

        const isCollapsed = sidebar.classList.contains("collapsed");

        localStorage.setItem("adminSidebarCollapsed", isCollapsed);

        toggleButton.title = isCollapsed
            ? "Déployer le menu"
            : "Réduire le menu";
    });

    // Ouvrir le menu sur mobile
    mobileButton?.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });

    // Fermer le menu lorsqu'on clique à l'extérieur
    document.addEventListener("click", (event) => {

        const clickedInsideSidebar = sidebar.contains(event.target);
        const clickedMobileButton = mobileButton?.contains(event.target);

        if (
            window.innerWidth <= 768 &&
            !clickedInsideSidebar &&
            !clickedMobileButton
        ) {
            sidebar.classList.remove("mobile-open");
        }
    });

    // Fermer le menu mobile après sélection d'une rubrique
    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove("mobile-open");
            }
        });
    });

});