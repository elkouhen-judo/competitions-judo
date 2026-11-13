// Page publique « Données personnelles » (RGPD), accessible sans connexion.
// L'adresse de contact n'est pas versionnée : elle vient de RGPD_CONTACT_EMAIL.
const LAST_UPDATE = "11 novembre 2026";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderContact() {
  const email = String(process.env.RGPD_CONTACT_EMAIL || "").trim();
  if (email) {
    const safe = escapeHtml(email);
    return `par e-mail à <a href="mailto:${safe}">${safe}</a>`;
  }
  return "auprès de votre coach, qui transmettra votre demande à l'administrateur de l'application";
}

function renderPrivacyHtml() {
  const contact = renderContact();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f3f5fa">
  <title>Données personnelles - Ayumi</title>
  <link rel="stylesheet" href="/api/styles">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <style>
    body { background: var(--bg); color: var(--text, #1f2937); }
    .privacy { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; line-height: 1.6; }
    .privacy h1 { font-size: 1.6rem; margin: 8px 0 4px; }
    .privacy h2 { font-size: 1.15rem; margin: 28px 0 8px; }
    .privacy p, .privacy li { margin: 6px 0; }
    .privacy ul { padding-left: 1.2rem; list-style: disc; }
    .privacy .privacy-meta { color: var(--muted); font-size: .9rem; }
    .privacy a { color: var(--primary); text-decoration: underline; }
    .privacy .privacy-back { display: inline-block; margin-bottom: 8px; }
    .privacy table { width: 100%; border-collapse: collapse; font-size: .95rem; }
    .privacy th, .privacy td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid var(--line); }
    .privacy-table-wrap { overflow-x: auto; }
  </style>
</head>
<body>
  <main class="privacy">
    <a class="privacy-back" href="/">← Retour à Ayumi</a>
    <h1>Données personnelles</h1>
    <p class="privacy-meta">Politique de confidentialité et droits RGPD · mise à jour le ${LAST_UPDATE}</p>

    <h2>À quoi sert Ayumi</h2>
    <p>Ayumi - 歩み permet aux judokas, à leurs parents et à leurs coachs de suivre les compétitions de judo : résultats, combats, classements et statistiques de saison. L'application n'affiche aucune publicité, ne vend aucune donnée et ne fait aucun suivi publicitaire.</p>

    <h2>Responsable du traitement</h2>
    <p>Les données sont traitées par l'administrateur de l'application Ayumi, pour le compte du club de judo auquel les judokas sont rattachés. Pour toute question ou demande, contactez-le ${contact}.</p>

    <h2>Données collectées</h2>
    <ul>
      <li><strong>Identité et compte</strong> : prénom, nom, adresse e-mail du compte Google utilisé pour se connecter, rôle (judoka, parent, coach, administrateur), club.</li>
      <li><strong>Profil sportif</strong> : catégorie d'âge, catégorie de poids, couleur de ceinture, genre, année dans la catégorie, latéralité.</li>
      <li><strong>Liens familiaux</strong> : lien entre un parent et ses enfants judokas.</li>
      <li><strong>Activité sportive</strong> : compétitions, combats (adversaire, résultat, points marqués), classements, bilans rédigés par le coach.</li>
    </ul>
    <p>Aucune donnée bancaire, aucune donnée de santé et aucune photo ne sont collectées. Le mot de passe Google n'est jamais transmis à Ayumi.</p>

    <h2>Finalités et bases légales</h2>
    <div class="privacy-table-wrap">
      <table>
        <thead><tr><th>Finalité</th><th>Base légale</th></tr></thead>
        <tbody>
          <tr><td>Créer et sécuriser l'accès à l'application</td><td>Intérêt légitime du club à réserver l'accès à ses membres</td></tr>
          <tr><td>Suivre les compétitions, combats et résultats</td><td>Intérêt légitime du club à accompagner la progression sportive de ses judokas</td></tr>
          <tr><td>Rédiger les bilans du coach</td><td>Intérêt légitime (suivi sportif)</td></tr>
        </tbody>
      </table>
    </div>

    <h2>Mineurs</h2>
    <p>Beaucoup de judokas suivis sont mineurs. Leur profil est créé par le club ou par un parent, et un parent rattaché peut consulter et corriger les informations de son enfant. Un mineur ne reçoit un accès personnel qu'avec l'accord de son représentant légal. Les parents peuvent exercer les droits décrits ci-dessous au nom de leur enfant.</p>

    <h2>Qui peut voir les données</h2>
    <ul>
      <li>Le judoka lui-même, s'il dispose d'un accès.</li>
      <li>Ses parents rattachés.</li>
      <li>Les coachs de son club, uniquement pour les judokas de ce club.</li>
      <li>L'administrateur de l'application, pour la gestion des accès.</li>
    </ul>
    <p>Les données ne sont ni publiées, ni vendues, ni transmises à des tiers à des fins commerciales.</p>

    <h2>Sous-traitants et hébergement</h2>
    <ul>
      <li><strong>Supabase</strong> : base de données et authentification, hébergées dans l'Union européenne (Irlande).</li>
      <li><strong>Vercel</strong> : hébergement de l'application web.</li>
      <li><strong>Google</strong> : connexion avec un compte Google, et polices de caractères (Google Fonts).</li>
      <li><strong>Anthropic (Claude)</strong> : uniquement si un coach connecte de lui-même un assistant Claude à Ayumi. L'assistant peut alors lire les données que ce coach est autorisé à consulter, pour répondre à ses questions.</li>
    </ul>
    <p>Vercel, Google et Anthropic sont des sociétés américaines. Les transferts de données hors de l'Union européenne qui peuvent en résulter sont encadrés par le Data Privacy Framework UE–États-Unis ou par les clauses contractuelles types de la Commission européenne.</p>

    <h2>Durée de conservation</h2>
    <ul>
      <li>Les données d'un judoka sont conservées tant qu'il est suivi par le club, puis supprimées sur demande ou au plus tard 3 ans après la dernière activité enregistrée.</li>
      <li>Les invitations non utilisées sont supprimées par l'administrateur.</li>
      <li>Les sauvegardes techniques sont conservées pour une durée limitée et ne servent qu'à restaurer le service en cas d'incident.</li>
    </ul>

    <h2>Stockage sur votre appareil</h2>
    <p>Ayumi n'utilise aucun cookie publicitaire ni outil de mesure d'audience. L'application garde sur votre appareil votre session de connexion, une copie des données affichées pour fonctionner hors connexion, et quelques préférences d'affichage (par exemple le dernier enfant consulté). Ces éléments sont nécessaires au fonctionnement et sont effacés lorsque vous vous déconnectez ou videz les données du site.</p>

    <h2>Vos droits</h2>
    <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, la limitation de leur traitement, leur portabilité, et vous opposer à leur traitement. Écrivez ${contact}. Une réponse vous sera apportée dans un délai d'un mois.</p>
    <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL : <a href="https://www.cnil.fr/fr/plaintes" rel="noopener">www.cnil.fr/fr/plaintes</a>.</p>

    <h2>Sécurité</h2>
    <p>Les échanges sont chiffrés (HTTPS). L'accès aux données est réservé aux comptes autorisés et limité selon le rôle de chacun. La base de données n'est pas accessible directement depuis le navigateur.</p>
  </main>
</body>
</html>`;
}

module.exports = function handler(_req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.status(200).send(renderPrivacyHtml());
};

module.exports.renderPrivacyHtml = renderPrivacyHtml;
