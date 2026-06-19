(() => {
  interface CombatScoreFormRow {
    category: string;
    technique: string;
    neWazaType: string;
    value: string;
  }

  const tachiWazaTechniques = [
    "Seoi-nage",
    "Ippon Seoi-nage",
    "O-soto-gari",
    "O-uchi-gari",
    "Ko-uchi-gari",
    "Ko-soto-gari",
    "Uchi-mata",
    "Harai-goshi",
    "Tai-otoshi",
    "Tomoe-nage",
    "Sumi-gaeshi",
    "Kata-guruma",
    "De-ashi-barai",
    "Hiza-guruma",
    "Sasae-tsurikomi-goshi",
    "Okuri-ashi-barai",
    "Ura-nage",
    "Yoko-tomoe-nage"
  ];

  function createEmptyCombatScoreRow(): CombatScoreFormRow {
    return { category: "", technique: "", neWazaType: "", value: "" };
  }

  function isCombatScoreRowComplete(score: CombatScoreFormRow): boolean {
    if (!score.category || !score.value) return false;
    if (score.category === "Tachi-waza") return Boolean(score.technique);
    if (score.category === "Ne-waza") return Boolean(score.neWazaType);
    return false;
  }

  window.KirokuCompetitionFormHelpers = {
    createEmptyCombatScoreRow,
    isCombatScoreRowComplete,
    tachiWazaTechniques
  };
})();
