/** Agenda FFJDA : rattachement d'un organisateur (ligue ou comité) à sa ligue régionale. */

export const NATIONAL_LIGUE = "National";

export const LIGUES: readonly string[] = [
  NATIONAL_LIGUE,
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
  "Guadeloupe",
  "Guyane",
  "Martinique",
  "Mayotte",
  "Nouvelle-Calédonie",
  "Polynésie",
  "Réunion"
];

const ARA = "Auvergne-Rhône-Alpes";
const BFC = "Bourgogne-Franche-Comté";
const BRE = "Bretagne";
const CVL = "Centre-Val de Loire";
const COR = "Corse";
const GES = "Grand Est";
const HDF = "Hauts-de-France";
const IDF = "Île-de-France";
const NOR = "Normandie";
const NAQ = "Nouvelle-Aquitaine";
const OCC = "Occitanie";
const PDL = "Pays de la Loire";
const PAC = "Provence-Alpes-Côte d'Azur";

/** Noms de ligue tels que la FFJDA les écrit (et alias), vers le libellé d'affichage. */
const LIGUE_ALIASES: Record<string, string> = {
  "auvergne rhone alpes": ARA,
  "bourgogne franche comte": BFC,
  bretagne: BRE,
  "centre val loire": CVL,
  centre: CVL,
  corse: COR,
  "grand est": GES,
  "hauts france": HDF,
  "ile france": IDF,
  normandie: NOR,
  "nouvelle aquitaine": NAQ,
  occitanie: OCC,
  "pays loire": PDL,
  "provence alpes cote azur": PAC,
  paca: PAC,
  guadeloupe: "Guadeloupe",
  guyane: "Guyane",
  martinique: "Martinique",
  mayotte: "Mayotte",
  "nouvelle caledonie": "Nouvelle-Calédonie",
  polynesie: "Polynésie",
  "polynesie francaise": "Polynésie",
  reunion: "Réunion"
};

/** Départements (et comités fusionnés) vers leur ligue. */
const DEPARTEMENTS: Record<string, string> = {
  ain: ARA, allier: ARA, ardeche: ARA, cantal: ARA, drome: ARA, "drome ardeche": ARA, isere: ARA,
  loire: ARA, "haute loire": ARA, "puy dome": ARA, rhone: ARA, savoie: ARA, "haute savoie": ARA,
  "cote or": BFC, doubs: BFC, jura: BFC, nievre: BFC, "haute saone": BFC, "saone loire": BFC,
  yonne: BFC, "territoire belfort": BFC,
  "cotes armor": BRE, finistere: BRE, "ille vilaine": BRE, morbihan: BRE,
  cher: CVL, "eure loir": CVL, indre: CVL, "indre loire": CVL, "loir cher": CVL, loiret: CVL,
  "corse sud": COR, "haute corse": COR,
  ardennes: GES, aube: GES, marne: GES, "haute marne": GES, "meurthe moselle": GES, meuse: GES,
  moselle: GES, "bas rhin": GES, "haut rhin": GES, vosges: GES,
  aisne: HDF, nord: HDF, oise: HDF, "pas calais": HDF, somme: HDF,
  paris: IDF, "seine marne": IDF, yvelines: IDF, essonne: IDF, "hauts seine": IDF,
  "seine saint denis": IDF, "val marne": IDF, "val oise": IDF,
  calvados: NOR, eure: NOR, manche: NOR, orne: NOR, "seine maritime": NOR,
  charente: NAQ, "charente maritime": NAQ, correze: NAQ, creuse: NAQ, dordogne: NAQ, gironde: NAQ,
  landes: NAQ, "lot garonne": NAQ, "pyrenees atlantiques": NAQ, "deux sevres": NAQ, vienne: NAQ,
  "haute vienne": NAQ,
  ariege: OCC, aude: OCC, aveyron: OCC, gard: OCC, "haute garonne": OCC, gers: OCC, herault: OCC,
  lot: OCC, lozere: OCC, "hautes pyrenees": OCC, "pyrenees orientales": OCC, tarn: OCC,
  "tarn garonne": OCC,
  "loire atlantique": PDL, "maine loire": PDL, mayenne: PDL, sarthe: PDL, vendee: PDL,
  "alpes haute provence": PAC, "hautes alpes": PAC, "alpes maritimes": PAC, "bouches rhone": PAC,
  var: PAC, vaucluse: PAC,
  guadeloupe: "Guadeloupe", martinique: "Martinique", guyane: "Guyane", reunion: "Réunion",
  mayotte: "Mayotte", "nouvelle caledonie": "Nouvelle-Calédonie", polynesie: "Polynésie"
};

/** Sites synchronisés : un événement propre au site (sans organisateur) appartient à sa ligue. */
const HOST_LIGUES: Record<string, string> = {
  "www.ffjudo.com": NATIONAL_LIGUE,
  "pays-de-la-loire-judo.ffjudo.com": PDL,
  "judo-bretagne.ffjudo.com": BRE,
  "nouvelle-aquitaine-judo.ffjudo.com": NAQ
};

const STOP_WORDS = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "et", "sur"]);
const ABBREVIATIONS: Record<string, string> = { hte: "haute", htes: "hautes", st: "saint", ste: "sainte" };
const TRAILING_SPORT = /\s+(judo|jud|ju|j)$/;

/** Minuscules, sans accents ni ponctuation, sans mots vides, abréviations développées. */
function normalizeName(value: string): string[] {
  const words = String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(TRAILING_SPORT, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => ABBREVIATIONS[word] || word);
  return words.filter((word) => !STOP_WORDS.has(word));
}

/** Correspondance exacte, puis mot à mot par préfixe (libellés tronqués : « atlant » → « atlantiques »). */
function lookup(words: string[], table: Record<string, string>): string {
  const key = words.join(" ");
  const exact = Object.hasOwn(table, key) ? table[key] : undefined;
  if (exact) {
    return exact;
  }
  const candidates = Object.keys(table).filter((name) => {
    const nameWords = name.split(" ");
    return (
      nameWords.length === words.length && words.every((word, index) => (nameWords[index] ?? "").startsWith(word))
    );
  });
  const [only] = candidates;
  return candidates.length === 1 && only ? (table[only] ?? "") : "";
}

/** Ligue d'affichage d'un organisateur FFJDA ; "" si inconnue. */
export function resolveLigue(proprietaire: string, sourceHost: string): string {
  const owner = String(proprietaire || "").trim();
  if (!owner) {
    return HOST_LIGUES[String(sourceHost || "").toLowerCase()] || "";
  }
  const words = normalizeName(owner);
  if (!words.length) {
    return "";
  }
  if (words[0] === "ffjda" || words.includes("federation")) {
    return NATIONAL_LIGUE;
  }
  if (words[0] === "ligue") {
    return lookup(words.slice(1), LIGUE_ALIASES);
  }
  if (words[0] === "comite") {
    return lookup(words.slice(1), DEPARTEMENTS);
  }
  return lookup(words, LIGUE_ALIASES) || lookup(words, DEPARTEMENTS);
}

export default resolveLigue;
