const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_CSV = path.join(ROOT, "judokas_100_utilisateurs.csv");
const OUTPUT_SQL = path.join(ROOT, "supabase", "seed_competitions_combats.sql");
const SEASON_LABEL = "2025_2026";

const COMPETITION_LEVELS = ["Départemental", "Régional", "National", "International"];
const RANKINGS = ["1er", "2e", "3e", "4e", "5e", "Non classé"];
const HANDEDNESSES = ["Droitier", "Gaucher"];
const OPPONENT_STANCES = ["Droitier", "Gaucher"];
const TACHI_WAZA = [
  "Seoi-nage",
  "O-soto-gari",
  "Uchi-mata",
  "Tai-otoshi",
  "Harai-goshi",
  "Ko-uchi-gari",
  "O-uchi-gari",
  "Sasae-tsuri-komi-ashi",
  "De-ashi-barai",
  "Tani-otoshi"
];
const NE_WAZA = [
  "Hon-gesa-gatame",
  "Yoko-shiho-gatame",
  "Tate-shiho-gatame",
  "Hadaka-jime",
  "Juji-gatame"
];
const OPPONENT_LAST_NAMES = [
  "Dubois",
  "Mercier",
  "Girard",
  "Andre",
  "Lambert",
  "Bonnet",
  "Rousseau",
  "Vincent",
  "Muller",
  "Leroy",
  "Faure",
  "Garnier",
  "Morel",
  "Blanc",
  "Perrin",
  "Fontaine",
  "Gauthier",
  "Masson",
  "Robin",
  "Boyer"
];
const OPPONENT_FIRST_NAMES_BY_GENDER = {
  Homme: [
    "Maxence",
    "Noé",
    "Ilyes",
    "Sacha",
    "Nolan",
    "Mathéo",
    "Youssef",
    "Liam",
    "Adrien",
    "Quentin"
  ],
  Femme: [
    "Camille",
    "Zoé",
    "Louise",
    "Mila",
    "Sarah",
    "Inaya",
    "Manon",
    "Nora",
    "Alice",
    "Maëlys"
  ]
};
const WEIGHTS_BY_CATEGORY_AND_GENDER = {
  Benjamin: {
    Homme: ["-30kg", "-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "+66kg"],
    Femme: ["-32kg", "-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "+63kg"]
  },
  Minime: {
    Homme: ["-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "+73kg"],
    Femme: ["-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
  },
  Cadet: {
    Homme: ["-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "+90kg"],
    Femme: ["-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
  },
  Junior: {
    Homme: ["-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
    Femme: ["-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
  },
  Senior: {
    Homme: ["-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
    Femme: ["-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
  },
  "Vétéran": {
    Homme: ["-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
    Femme: ["-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
  }
};

const EVENT_TEMPLATES = {
  Poussinet: [
    ["2025-10-05", "Animation petits tigres de rentrée", "Départemental"],
    ["2025-12-07", "Interclubs éducatif d'hiver", "Départemental"],
    ["2026-03-15", "Challenge technique du printemps", "Départemental"],
    ["2026-05-24", "Tournoi amical de fin de saison", "Départemental"]
  ],
  Poussin: [
    ["2025-10-12", "Tournoi poussins de rentrée", "Départemental"],
    ["2025-11-23", "Coupe interclubs d'automne", "Départemental"],
    ["2026-01-25", "Challenge éducatif d'hiver", "Départemental"],
    ["2026-03-22", "Tournoi du printemps", "Départemental"],
    ["2026-06-07", "Coupe de fin de saison", "Départemental"]
  ],
  Benjamin: [
    ["2025-09-28", "Tournoi de préparation benjamins", "Départemental"],
    ["2025-11-16", "Critérium départemental benjamins", "Départemental"],
    ["2026-01-18", "Coupe régionale benjamins", "Régional"],
    ["2026-03-08", "Tournoi régional benjamins", "Régional"],
    ["2026-05-17", "Open benjamins de fin de saison", "Départemental"]
  ],
  Minime: [
    ["2025-09-21", "Tournoi de préparation minimes", "Départemental"],
    ["2025-10-19", "Critérium départemental minimes", "Départemental"],
    ["2025-12-14", "Coupe régionale minimes", "Régional"],
    ["2026-02-01", "Circuit régional minimes", "Régional"],
    ["2026-04-12", "Open national minimes", "National"],
    ["2026-05-31", "Tournoi de clôture minimes", "Départemental"]
  ],
  Cadet: [
    ["2025-09-14", "Tournoi de préparation cadets", "Départemental"],
    ["2025-10-26", "Championnat départemental cadets", "Départemental"],
    ["2025-12-21", "Tournoi régional cadets", "Régional"],
    ["2026-01-11", "Demi-finale régionale cadets", "Régional"],
    ["2026-03-29", "Open national cadets", "National"],
    ["2026-05-03", "Tournoi international cadets", "International"]
  ],
  Junior: [
    ["2025-09-28", "Tournoi de préparation juniors", "Départemental"],
    ["2025-11-09", "Championnat départemental juniors", "Départemental"],
    ["2025-12-07", "Circuit régional juniors", "Régional"],
    ["2026-02-15", "Open national juniors", "National"],
    ["2026-04-19", "Tournoi international juniors", "International"],
    ["2026-06-14", "Coupe régionale juniors", "Régional"]
  ],
  Senior: [
    ["2025-10-05", "Open de rentrée seniors", "Départemental"],
    ["2025-11-30", "Championnat départemental seniors", "Départemental"],
    ["2026-01-04", "Tournoi régional seniors", "Régional"],
    ["2026-02-22", "Demi-finale régionale seniors", "Régional"],
    ["2026-04-05", "Open national seniors", "National"],
    ["2026-05-10", "Tournoi international seniors", "International"]
  ],
  "Vétéran": [
    ["2025-11-02", "Tournoi vétérans d'automne", "Régional"],
    ["2026-02-08", "Coupe régionale vétérans", "Régional"],
    ["2026-05-17", "Open national vétérans", "National"]
  ]
};

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function quoteSql(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvRows(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function getSeedJudokaId(email) {
  return `seed_user_${slugify(email)}`;
}

function getWeightCategory(judoka, random) {
  const byGender = WEIGHTS_BY_CATEGORY_AND_GENDER[judoka.ageCategory];
  if (!byGender) {
    return "";
  }
  const weights = byGender[judoka.genre] || byGender.Homme;
  const preferredIndex = Math.min(weights.length - 1, Math.floor(random() * weights.length));
  return weights[preferredIndex];
}

function toSeedJudokaRows(csvRows) {
  return csvRows.map((row) => {
    const random = createRandom(hashString(`profile:${row.email}:${SEASON_LABEL}`));
    const isJudoka = row.profileType === "JUDOKA";
    const ageCategory = row.ageCategory || "";
    const genre = row.genre || "";
    const weightCategory = isJudoka ? getWeightCategory({ ageCategory, genre }, random) : "";

    return {
      id_judoka: getSeedJudokaId(row.email),
      email: row.email,
      prenom: row.prenom,
      nom: row.nom,
      role: row.role || "NORMAL",
      profile_type: row.profileType,
      categorie_age: ageCategory,
      categorie_poids: weightCategory,
      couleur_ceinture: row.couleur_ceinture || "",
      genre,
      annee_categorie: row.anneeCategorie || "",
      lateralite: isJudoka ? pick(HANDEDNESSES, random) : "",
      pending_parent_email: row.parentEmail || ""
    };
  });
}

function toParentLinkRows(csvRows) {
  return csvRows
    .filter((row) => row.profileType === "JUDOKA" && row.parentEmail)
    .map((row) => ({
      id_parent_email: row.parentEmail,
      id_judoka_email: row.email
    }));
}

function getCompetitionCount(ageCategory, random) {
  if (ageCategory === "Poussinet") {
    return 2 + Math.floor(random() * 2);
  }
  if (ageCategory === "Poussin") {
    return 3 + Math.floor(random() * 2);
  }
  if (ageCategory === "Benjamin") {
    return 3 + Math.floor(random() * 3);
  }
  if (ageCategory === "Vétéran") {
    return 2 + Math.floor(random() * 2);
  }
  return 4 + Math.floor(random() * 3);
}

function getRanking(wins, losses, draws, random) {
  const total = wins + losses + draws;
  const ratio = total ? (wins + draws * 0.5) / total : 0;
  if (ratio >= 0.86) return pick(["1er", "1er", "2e"], random);
  if (ratio >= 0.7) return pick(["1er", "2e", "2e", "3e"], random);
  if (ratio >= 0.55) return pick(["2e", "3e", "3e", "4e"], random);
  if (ratio >= 0.4) return pick(["3e", "4e", "5e"], random);
  return pick(["5e", "Non classé", "Non classé"], random);
}

function getCombatCount(ageCategory, random) {
  if (ageCategory === "Poussinet") {
    return 2 + Math.floor(random() * 2);
  }
  if (ageCategory === "Poussin") {
    return 2 + Math.floor(random() * 3);
  }
  return 3 + Math.floor(random() * 3);
}

function getResult(random, level, combatIndex) {
  const base = level === "National" || level === "International" ? 0.47 : 0.58;
  const roll = random();
  if (roll < base - combatIndex * 0.025) return "Victoire";
  if (roll < 0.96) return "Défaite";
  return "Egalité";
}

function getDecisionType(result, random) {
  if (result === "Egalité") return "Hiki wake";
  const roll = random();
  if (roll < 0.48) return "Ippon";
  if (roll < 0.73) return "Waza-ari";
  if (roll < 0.82) return "Yuko";
  if (roll < 0.94) return "Décision";
  return "Hansoku-make";
}

function createScores(combatId, result, decisionType, random) {
  if (result === "Egalité" || decisionType === "Décision" || decisionType === "Hansoku-make" || decisionType === "Forfait") {
    return [];
  }

  const scoreRows = [];
  const scoreCount = decisionType === "Ippon" ? 1 : 1 + Math.floor(random() * 2);
  for (let index = 0; index < scoreCount; index += 1) {
    const useNeWaza = random() < 0.3;
    if (useNeWaza) {
      const technique = pick(NE_WAZA, random);
      scoreRows.push({
        id_combat_score: `${combatId}_S${index}`,
        id_combat: combatId,
        categorie: "Ne-waza",
        technique,
        type_ne_waza: technique,
        valeur: index === 0 ? decisionType : "Waza-ari",
        ordre: index
      });
    } else {
      scoreRows.push({
        id_combat_score: `${combatId}_S${index}`,
        id_combat: combatId,
        categorie: "Tachi-waza",
        technique: pick(TACHI_WAZA, random),
        type_ne_waza: "",
        valeur: index === 0 ? decisionType : "Waza-ari",
        ordre: index
      });
    }
  }
  return scoreRows;
}

function createNotes(result, decisionType, random) {
  if (result === "Victoire") {
    return pick(
      [
        "Bon engagement dès le kumikata, continuer à varier les attaques.",
        "A su imposer son rythme et conclure sur la séquence forte.",
        "Gestion solide de l'avance, vigilance à garder sur les sorties de tapis.",
        "Bonne transition debout-sol après une première minute équilibrée."
      ],
      random
    );
  }
  if (result === "Défaite") {
    if (decisionType === "Hansoku-make") {
      return "Défaite sur pénalités après une garde subie trop longtemps.";
    }
    return pick(
      [
        "Combat accroché, manque de replacement après la première attaque.",
        "A subi la garde adverse, priorité au travail d'entrée de manche.",
        "Bonne attitude malgré le score, travailler la défense au sol.",
        "Début de combat positif puis baisse d'intensité dans la dernière minute."
      ],
      random
    );
  }
  return "Combat équilibré, aucune différence nette au terme du temps réglementaire.";
}

function generateDataset(judokas) {
  const clubCompetitions = [];
  const competitions = [];
  const combats = [];
  const combatScores = [];

  Object.entries(EVENT_TEMPLATES).forEach(([ageCategory, events]) => {
    events.forEach(([date, name, level], index) => {
      clubCompetitions.push({
        id_club_competition: `seed_${SEASON_LABEL}_club_${slugify(ageCategory)}_${index + 1}`,
        nom: name,
        date,
        categorie_age: ageCategory,
        niveau: level
      });
    });
  });

  judokas.forEach((judoka) => {
    const random = createRandom(hashString(`${judoka.email}:${judoka.ageCategory}:${SEASON_LABEL}`));
    const events = [...EVENT_TEMPLATES[judoka.ageCategory]];
    const desiredCount = Math.min(events.length, getCompetitionCount(judoka.ageCategory, random));
    const selectedEvents = [];

    while (selectedEvents.length < desiredCount) {
      const candidate = events.splice(Math.floor(random() * events.length), 1)[0];
      if (candidate) {
        selectedEvents.push(candidate);
      }
    }
    selectedEvents.sort((a, b) => a[0].localeCompare(b[0]));

    const weightCategory = getWeightCategory(judoka, random);
    selectedEvents.forEach(([date, name, level], competitionIndex) => {
      const clubCompetitionIndex = EVENT_TEMPLATES[judoka.ageCategory].findIndex(
        ([eventDate, eventName]) => eventDate === date && eventName === name
      );
      const competitionId = `seed_${SEASON_LABEL}_comp_${slugify(judoka.email)}_${competitionIndex + 1}`;
      const fightCount = getCombatCount(judoka.ageCategory, random);
      let wins = 0;
      let losses = 0;
      let draws = 0;

      for (let combatIndex = 0; combatIndex < fightCount; combatIndex += 1) {
        const result = getResult(random, level, combatIndex);
        const decisionType = getDecisionType(result, random);
        const combatId = `${competitionId}_combat_${combatIndex + 1}`;
        const opponentFirstNames = OPPONENT_FIRST_NAMES_BY_GENDER[judoka.genre] || OPPONENT_FIRST_NAMES_BY_GENDER.Homme;

        if (result === "Victoire") wins += 1;
        else if (result === "Défaite") losses += 1;
        else draws += 1;

        combats.push({
          id_combat: combatId,
          id_judoka_email: judoka.email,
          id_competition: competitionId,
          adversaire: `${pick(opponentFirstNames, random)} ${pick(OPPONENT_LAST_NAMES, random)}`,
          garde_adversaire: pick(OPPONENT_STANCES, random),
          resultat: result,
          type_victoire: decisionType,
          deroule: createNotes(result, decisionType, random)
        });
        combatScores.push(...createScores(combatId, result, decisionType, random));
      }

      const ranking = getRanking(wins, losses, draws, random);
      competitions.push({
        id_competition: competitionId,
        id_judoka_email: judoka.email,
        club_competition_id: `seed_${SEASON_LABEL}_club_${slugify(judoka.ageCategory)}_${clubCompetitionIndex + 1}`,
        nom: name,
        date,
        categorie_age: judoka.ageCategory,
        categorie_poids: weightCategory,
        niveau: level,
        classement: RANKINGS.includes(ranking) ? ranking : "Non classé",
        coach_objective: pick(
          [
            "Installer sa garde forte avant la première attaque.",
            "Enchaîner attaque debout puis contrôle au sol.",
            "Rester mobile et provoquer les déplacements adverses.",
            "Garder l'intensité jusqu'au matte."
          ],
          random
        ),
        coach_review: pick(
          [
            "Progression visible sur l'engagement et l'attitude.",
            "Bonne compétition, axe prioritaire : varier les directions.",
            "Résultats cohérents avec le travail réalisé à l'entraînement.",
            "Bilan positif malgré quelques séquences défensives à corriger."
          ],
          random
        )
      });
    });
  });

  return { clubCompetitions, competitions, combats, combatScores };
}

function valuesBlock(rows, columns) {
  return rows
    .map((row) => `  (${columns.map((column) => quoteSql(row[column])).join(", ")})`)
    .join(",\n");
}

function renderSql(dataset) {
  const judokaColumns = [
    "id_judoka",
    "email",
    "prenom",
    "nom",
    "role",
    "profile_type",
    "categorie_age",
    "categorie_poids",
    "couleur_ceinture",
    "genre",
    "annee_categorie",
    "lateralite",
    "pending_parent_email"
  ];
  const parentLinkColumns = ["id_parent_email", "id_judoka_email"];
  const seedEmailColumns = ["email"];
  const clubColumns = ["id_club_competition", "nom", "date", "categorie_age", "niveau"];
  const competitionColumns = [
    "id_competition",
    "id_judoka_email",
    "club_competition_id",
    "nom",
    "date",
    "categorie_age",
    "categorie_poids",
    "niveau",
    "classement",
    "coach_objective",
    "coach_review"
  ];
  const combatColumns = [
    "id_combat",
    "id_judoka_email",
    "id_competition",
    "adversaire",
    "garde_adversaire",
    "resultat",
    "type_victoire",
    "deroule"
  ];
  const scoreColumns = ["id_combat_score", "id_combat", "categorie", "technique", "type_ne_waza", "valeur", "ordre"];

  return `-- Dataset réaliste judokas/compétitions/combats pour judokas_100_utilisateurs.csv.
-- Saison 2025-2026, généré par scripts/generate-competition-dataset.js.
-- Peut être exécuté seul : les profils sont créés ou mis à jour par email.

begin;

delete from public.combat_scores where id_combat_score like 'seed_${SEASON_LABEL}_%';
delete from public.combats where id_combat like 'seed_${SEASON_LABEL}_%';
delete from public.competitions where id_competition like 'seed_${SEASON_LABEL}_%';
delete from public.club_competitions where id_club_competition like 'seed_${SEASON_LABEL}_%';

with seed_emails(${seedEmailColumns.join(", ")}) as (
values
${valuesBlock(dataset.judokas, seedEmailColumns)}
)
delete from public.parent_judokas
using public.judokas as seed_profiles
where (
  parent_judokas.id_parent = seed_profiles.id_judoka
  or parent_judokas.id_judoka = seed_profiles.id_judoka
)
and exists (
  select 1 from seed_emails where lower(seed_emails.email) = lower(seed_profiles.email)
);

delete from public.parent_judokas where id_parent like 'seed_user_%' or id_judoka like 'seed_user_%';
delete from public.judokas where id_judoka like 'seed_user_%';

with seed_rows(${judokaColumns.join(", ")}) as (
values
${valuesBlock(dataset.judokas, judokaColumns)}
)
insert into public.judokas (
  id_judoka,
  email,
  prenom,
  nom,
  role,
  profile_type,
  categorie_age,
  categorie_poids,
  couleur_ceinture,
  genre,
  annee_categorie,
  lateralite,
  pending_parent_email
)
select
  seed_rows.id_judoka,
  seed_rows.email,
  seed_rows.prenom,
  seed_rows.nom,
  seed_rows.role,
  seed_rows.profile_type,
  seed_rows.categorie_age,
  seed_rows.categorie_poids,
  seed_rows.couleur_ceinture,
  seed_rows.genre,
  seed_rows.annee_categorie,
  seed_rows.lateralite,
  nullif(seed_rows.pending_parent_email, '')
from seed_rows
where not exists (
  select 1 from public.judokas existing where lower(existing.email) = lower(seed_rows.email)
)
on conflict (id_judoka) do update set
  email = excluded.email,
  prenom = excluded.prenom,
  nom = excluded.nom,
  role = excluded.role,
  profile_type = excluded.profile_type,
  categorie_age = excluded.categorie_age,
  categorie_poids = excluded.categorie_poids,
  couleur_ceinture = excluded.couleur_ceinture,
  genre = excluded.genre,
  annee_categorie = excluded.annee_categorie,
  lateralite = excluded.lateralite,
  pending_parent_email = excluded.pending_parent_email,
  updated_at = now();

with seed_rows(${judokaColumns.join(", ")}) as (
values
${valuesBlock(dataset.judokas, judokaColumns)}
)
update public.judokas as target
set
  prenom = seed_rows.prenom,
  nom = seed_rows.nom,
  role = seed_rows.role,
  profile_type = seed_rows.profile_type,
  categorie_age = seed_rows.categorie_age,
  categorie_poids = seed_rows.categorie_poids,
  couleur_ceinture = seed_rows.couleur_ceinture,
  genre = seed_rows.genre,
  annee_categorie = seed_rows.annee_categorie,
  lateralite = seed_rows.lateralite,
  pending_parent_email = nullif(seed_rows.pending_parent_email, ''),
  updated_at = now()
from seed_rows
where lower(target.email) = lower(seed_rows.email);

with seed_rows(${parentLinkColumns.join(", ")}) as (
values
${valuesBlock(dataset.parentLinks, parentLinkColumns)}
)
insert into public.parent_judokas (
  id_parent,
  id_judoka
)
select
  parents.id_judoka,
  children.id_judoka
from seed_rows
join public.judokas parents on lower(parents.email) = lower(seed_rows.id_parent_email)
join public.judokas children on lower(children.email) = lower(seed_rows.id_judoka_email)
on conflict (id_parent, id_judoka) do nothing;

with seed_rows(${clubColumns.join(", ")}) as (
values
${valuesBlock(dataset.clubCompetitions, clubColumns)}
)
insert into public.club_competitions (
  id_club_competition,
  nom,
  date,
  categorie_age,
  niveau
)
select
  id_club_competition,
  nom,
  date::date,
  categorie_age,
  niveau
from seed_rows
on conflict (id_club_competition) do update set
  nom = excluded.nom,
  date = excluded.date,
  categorie_age = excluded.categorie_age,
  niveau = excluded.niveau,
  updated_at = now();

with seed_rows(${competitionColumns.join(", ")}) as (
values
${valuesBlock(dataset.competitions, competitionColumns)}
)
insert into public.competitions (
  id_competition,
  id_judoka,
  club_competition_id,
  nom,
  date,
  categorie_age,
  categorie_poids,
  niveau,
  classement,
  coach_objective,
  coach_review
)
select
  seed_rows.id_competition,
  judokas.id_judoka,
  seed_rows.club_competition_id,
  seed_rows.nom,
  seed_rows.date::date,
  seed_rows.categorie_age,
  seed_rows.categorie_poids,
  seed_rows.niveau,
  seed_rows.classement,
  seed_rows.coach_objective,
  seed_rows.coach_review
from seed_rows
join public.judokas on lower(judokas.email) = lower(seed_rows.id_judoka_email)
on conflict (id_competition) do update set
  id_judoka = excluded.id_judoka,
  club_competition_id = excluded.club_competition_id,
  nom = excluded.nom,
  date = excluded.date,
  categorie_age = excluded.categorie_age,
  categorie_poids = excluded.categorie_poids,
  niveau = excluded.niveau,
  classement = excluded.classement,
  coach_objective = excluded.coach_objective,
  coach_review = excluded.coach_review,
  updated_at = now();

with seed_rows(${combatColumns.join(", ")}) as (
values
${valuesBlock(dataset.combats, combatColumns)}
)
insert into public.combats (
  id_combat,
  id_judoka,
  id_competition,
  adversaire,
  garde_adversaire,
  resultat,
  type_victoire,
  deroule
)
select
  seed_rows.id_combat,
  competitions.id_judoka,
  seed_rows.id_competition,
  seed_rows.adversaire,
  seed_rows.garde_adversaire,
  seed_rows.resultat,
  seed_rows.type_victoire,
  seed_rows.deroule
from seed_rows
join public.competitions on competitions.id_competition = seed_rows.id_competition
on conflict (id_combat) do update set
  id_judoka = excluded.id_judoka,
  id_competition = excluded.id_competition,
  adversaire = excluded.adversaire,
  garde_adversaire = excluded.garde_adversaire,
  resultat = excluded.resultat,
  type_victoire = excluded.type_victoire,
  deroule = excluded.deroule,
  updated_at = now();

with seed_rows(${scoreColumns.join(", ")}) as (
values
${valuesBlock(dataset.combatScores, scoreColumns)}
)
insert into public.combat_scores (
  id_combat_score,
  id_combat,
  categorie,
  technique,
  type_ne_waza,
  valeur,
  ordre
)
select
  seed_rows.id_combat_score,
  seed_rows.id_combat,
  seed_rows.categorie,
  seed_rows.technique,
  seed_rows.type_ne_waza,
  seed_rows.valeur,
  seed_rows.ordre::integer
from seed_rows
join public.combats on combats.id_combat = seed_rows.id_combat
on conflict (id_combat_score) do update set
  id_combat = excluded.id_combat,
  categorie = excluded.categorie,
  technique = excluded.technique,
  type_ne_waza = excluded.type_ne_waza,
  valeur = excluded.valeur,
  ordre = excluded.ordre;

commit;
`;
}

const csvRows = parseCsvRows(SOURCE_CSV);
const judokas = csvRows.filter((row) => row.profileType === "JUDOKA");
const dataset = {
  judokas: toSeedJudokaRows(csvRows),
  parentLinks: toParentLinkRows(csvRows),
  ...generateDataset(judokas)
};
fs.writeFileSync(OUTPUT_SQL, renderSql(dataset));

console.log(
  `Generated ${OUTPUT_SQL} with ${dataset.judokas.length} judokas, ` +
    `${dataset.parentLinks.length} parent links, ${dataset.clubCompetitions.length} club competitions, ` +
    `${dataset.competitions.length} competitions, ${dataset.combats.length} combats and ` +
    `${dataset.combatScores.length} combat scores.`
);
