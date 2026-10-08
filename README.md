# Planning d’équipe pour Grist

Ce widget fournit une vue mensuelle simple des présences et absences d’une équipe. Il permet de déclarer des congés, prévisions de congé, journées de télétravail, formations et autres situations, pour une journée entière ou une demi-journée.

Chaque membre gère uniquement sa propre ligne. Un administrateur peut gérer l’ensemble du planning ainsi que la ligne des congés scolaires.

## Distribution recommandée

Le moyen le plus simple de diffuser l’outil consiste à transmettre une copie du document Grist déjà configuré :

1. Télécharger le document Grist sans son historique.
2. Transmettre le fichier au responsable de l’unité.
3. Le responsable importe ce fichier dans son espace Grist.
4. Il renseigne la table `Utilisateurs` avec les membres de son équipe.
5. Il invite individuellement ces personnes dans le document Grist.

La copie conserve les tables, le widget et les règles d’accès. Il ne faut donc pas recréer le document ni modifier les règles ACL pour une utilisation courante.

L’accès public au document doit rester désactivé.

## Initialisation de la table Utilisateurs

La table doit conserver le nom exact `Utilisateurs` et les identifiants de colonnes ci-dessous.

| Colonne | Type Grist | Contenu attendu |
| --- | --- | --- |
| `nom` | Texte | Nom affiché dans le planning |
| `email` | Texte | Adresse utilisée par la personne pour accéder à Grist |
| `role` | Choix ou texte | `ADMINISTRATEUR` ou `MEMBRE` |
| `actif` | Case à cocher | Cochée si la personne doit apparaître dans le planning |
| `date_arrivee` | Date | Facultative ; premier jour de présence dans l’équipe |
| `date_depart` | Date | Facultative ; dernier jour de présence dans l’équipe |

### Adresse électronique

Le champ `email` est essentiel : il permet d’identifier la personne connectée et de l’autoriser à modifier sa propre ligne.

- Saisir l’adresse professionnelle ANFSI utilisée lors de l’invitation dans Grist.
- L’adresse doit correspondre à celle du compte avec lequel l’utilisateur se connecte à Grist.
- Si une personne dispose de plusieurs adresses professionnelles, utiliser uniquement celle reconnue par Grist.
- Ne pas saisir deux lignes pour une même personne.

Exemple : si l’utilisateur est invité avec son adresse ANFSI `prenom.nom@interieur.gouv.fr`, cette même adresse doit être inscrite dans la colonne `email`.

### Rôles

- `ADMINISTRATEUR` : peut gérer toutes les lignes et renseigner les congés scolaires.
- `MEMBRE` : peut consulter l’ensemble du planning, mais ne peut modifier que sa propre ligne.

Les valeurs doivent être saisies exactement sous cette forme, en majuscules. Il est recommandé de désigner au moins un administrateur.

### Membres actifs, arrivées et départs

- Une personne dont la case `actif` est décochée n’apparaît plus dans le planning. Ses anciennes périodes restent présentes dans la table `Periodes`.
- `date_arrivee` et `date_depart` sont facultatives. Elles peuvent rester vides si ces dates ne sont pas connues.
- Lorsqu’elles sont renseignées, les jours antérieurs à l’arrivée ou postérieurs au départ sont rendus inactifs dans le planning.

### Exemple d’initialisation

| nom | email | role | actif | date_arrivee | date_depart |
| --- | --- | --- | --- | --- | --- |
| Responsable unité | responsable@interieur.gouv.fr | ADMINISTRATEUR | Oui |  |  |
| Membre équipe | membre@interieur.gouv.fr | MEMBRE | Oui | 01/10/2026 |  |

## Invitation des utilisateurs dans Grist

Après avoir rempli la table `Utilisateurs` :

1. Ouvrir la fenêtre de partage ou d’invitation du document.
2. Inviter chaque personne avec la même adresse que celle inscrite dans la colonne `email`.
3. Donner aux membres un accès leur permettant de modifier le document ; les règles ACL limitent ensuite leurs écritures à leur propre ligne.
4. Vérifier que l’accès public est désactivé.
5. Effectuer un essai avec un compte `MEMBRE` avant la diffusion générale.

Un utilisateur absent de la table, inactif ou connecté avec une autre adresse ne pourra pas gérer sa ligne.

## Table Periodes

La table `Periodes` contient les données enregistrées par le widget. Elle doit conserver les identifiants de colonnes suivants :

| Colonne | Type Grist | Configuration |
| --- | --- | --- |
| `utilisateur` | Référence | Référence vers `Utilisateurs`, avec `nom` comme champ d’affichage |
| `date_debut_periode` | Date | Premier jour de la période |
| `date_fin_periode` | Date | Dernier jour de la période |
| `type` | Choix ou texte | Type de situation |
| `portion` | Choix ou texte | Journée ou demi-journée |
| `commentaire` | Texte multiligne | Précision facultative |

Valeurs utilisées dans `type` :

- `Prévision congé`
- `Congé`
- `Télétravail`
- `Formation`
- `Autre`
- `Congés scolaires`

Valeurs utilisées dans `portion` :

- `Journée`
- `Matin`
- `Après-midi`

Il est préférable de ne pas saisir directement les périodes dans cette table : le widget assure la cohérence des dates, des journées entières et des demi-journées.

Pour les congés scolaires, le champ `utilisateur` reste vide et le type vaut `Congés scolaires`. Cette ligne est gérée depuis le planning par un administrateur.

## Installation du widget dans un nouveau document

Cette partie n’est utile que si le document modèle n’est pas utilisé.

1. Créer les tables `Utilisateurs` et `Periodes` avec les colonnes décrites ci-dessus.
2. Ajouter une page ou une section de type **Custom Widget Builder**.
3. Copier le contenu de `index.html` dans la partie HTML du widget.
4. Copier le contenu de `app.js` dans la partie JavaScript.
5. Conserver les styles CSS dans `index.html` : aucun fichier CSS séparé n’est nécessaire.
6. Autoriser le widget à accéder au document en lecture et en écriture lorsque Grist le demande.
7. Configurer les règles ACL avant d’inviter les utilisateurs.

Le widget dépend actuellement de l’API Grist et de Bootstrap chargés depuis les CDN indiqués dans `index.html`.

## Principes des règles d’accès

Le document modèle est déjà configuré. Les règles ne doivent être modifiées que par une personne maîtrisant les ACL Grist.

Elles reposent sur l’adresse du compte connecté et sur la table `Utilisateurs` :

- un attribut utilisateur `Profil` recherche dans `Utilisateurs` la ligne dont `email` correspond à `user.Email` ;
- tous les utilisateurs autorisés peuvent consulter le planning ;
- un membre peut créer, modifier ou supprimer uniquement les périodes rattachées à son propre profil ;
- un administrateur peut gérer toutes les périodes ;
- seuls les administrateurs peuvent gérer la ligne `Congés scolaires` ;
- les adresses électroniques des autres membres ne sont pas exposées inutilement.

Après toute modification des ACL, tester au minimum avec un compte administrateur et un compte membre.

## Utilisation du planning

### Ajouter une période

1. Choisir une situation : prévision de congé, congé, télétravail, formation ou autre.
2. Choisir la durée : journée entière, matin ou après-midi.
3. Cliquer-glisser sur sa ligne, du premier au dernier jour concerné.
4. Ajouter éventuellement un commentaire.
5. Cliquer sur **Enregistrer**.

Il est possible de déclarer deux situations différentes le même jour, par exemple télétravail le matin et autre situation l’après-midi.

### Modifier ou supprimer

- Cliquer sur une période colorée pour ouvrir sa fiche, modifier son type ou son commentaire, ou la supprimer.
- Cliquer-glisser sur une partie déjà colorée pour l’effacer.

### Navigation

- Les flèches permettent de passer au mois précédent ou suivant.
- Un clic sur le mois permet de choisir directement un autre mois.
- Le bouton **Aujourd’hui** revient au mois courant.
- Le bouton **Vue d’ensemble** affiche six mois à partir du mois sélectionné.
- Le commutateur **Équipe** permet d’afficher les noms complets ou une version compacte laissant davantage de largeur aux jours.

### Congés scolaires

La ligne `Congés scolaires` est toujours placée en bas du planning. Seul un administrateur peut la renseigner. Les périodes sont affichées en jaune vif.

## Contrôles avant diffusion

- Le responsable est déclaré `ADMINISTRATEUR` et actif.
- Chaque membre est déclaré une seule fois avec l’adresse exacte utilisée dans Grist.
- Tous les utilisateurs nécessaires ont été invités dans le document.
- L’accès public est désactivé.
- Un membre ne peut modifier que sa propre ligne.
- Un membre ne peut pas modifier les congés scolaires.
- L’administrateur peut gérer toutes les lignes.
- Une période test est bien enregistrée dans `Periodes`.

## Précautions

- Ne pas renommer les tables ni les identifiants de colonnes sans adapter `app.js`.
- Ne pas modifier directement les références de la table `Periodes` sauf correction exceptionnelle.
- Les commentaires doivent rester adaptés à un planning partagé : éviter d’y inscrire des informations médicales ou personnelles sensibles.
- Avant une évolution importante, effectuer une copie du document Grist.
