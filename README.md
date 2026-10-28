# Dîner de Gala AIESEC 2027 — Phase 1

## Contenu
- `index.html` : page d’accueil publique
- `connexion.html` : connexion Supabase et contrôle du rôle dans `profiles`
- `dashboard.html` : première structure du tableau de bord
- `css/style.css` : mise en page responsive
- `js/config.js` : configuration Supabase
- `assets/logo-aiesec.png` : logo AIESEC (si fourni)

## Important : config.js
Le fichier `js/config.js` contient l’URL et la clé publique Supabase. Vérifiez-les avant de tester.
Ne mettez JAMAIS une clé `service_role` ou `sb_secret_...` dans le navigateur ou sur GitHub.

## Tester
Ouvrez le dossier avec VS Code et lancez `index.html` avec une extension de serveur local (par exemple Live Server).
La connexion attend les colonnes `id`, `full_name`, `role` et `is_active` dans `public.profiles`. Les rôles autorisés sont `admin` et `organizer`.

## Sécurité
Avant toute mise en production, configurez les politiques RLS et faites passer la validation des QR codes par une fonction serveur Supabase atomique. Cette phase ne contient pas encore la création de cartes PNG ni le scanner QR.
