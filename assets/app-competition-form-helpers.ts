(() => {
  interface CombatScoreFormRow {
    category: string;
    technique: string;
    neWazaType: string;
    value: string;
  }

  // COMBAT-TECH : techniques groupées par famille (Kodokan), du plus courant au plus rare dans chaque famille.
  const tachiWazaFamilies = [
    { label: "Te-waza · bras", techniques: ["Seoi-nage", "Ippon Seoi-nage", "Morote-seoi-nage", "Seoi-otoshi", "Tai-otoshi", "Kata-guruma", "Sukui-nage", "Uki-otoshi", "Sumi-otoshi", "Obi-otoshi", "Kuchiki-taoshi", "Kibisu-gaeshi"] },
    { label: "Koshi-waza · hanches", techniques: ["O-goshi", "Uki-goshi", "Koshi-guruma", "Tsurikomi-goshi", "Sode-tsurikomi-goshi", "Harai-goshi", "Hane-goshi", "Tsuri-goshi", "Ushiro-goshi", "Utsuri-goshi"] },
    { label: "Ashi-waza · jambes", techniques: ["O-soto-gari", "O-uchi-gari", "Ko-uchi-gari", "Ko-soto-gari", "Ko-soto-gake", "Uchi-mata", "De-ashi-barai", "Okuri-ashi-barai", "Hiza-guruma", "Sasae-tsurikomi-ashi", "Harai-tsurikomi-ashi", "Ashi-guruma", "O-guruma", "O-soto-guruma", "Tsubame-gaeshi"] },
    { label: "Sutemi-waza · sacrifices", techniques: ["Tomoe-nage", "Yoko-tomoe-nage", "Sumi-gaeshi", "Ura-nage", "Tani-otoshi", "Yoko-guruma", "Uki-waza", "Yoko-otoshi", "Hikikomi-gaeshi", "Soto-makikomi", "Uchi-makikomi", "Hane-makikomi"] }
  ];

  const neWazaFamilies = [
    { label: "Osaekomi-waza · immobilisations", techniques: ["Hon-gesa-gatame", "Kuzure-kesa-gatame", "Ushiro-kesa-gatame", "Makura-kesa-gatame", "Kata-gatame", "Yoko-shiho-gatame", "Tate-shiho-gatame", "Kami-shiho-gatame", "Kuzure-kami-shiho-gatame", "Ura-gatame"] },
    { label: "Shime-waza · étranglements", techniques: ["Hadaka-jime", "Okuri-eri-jime", "Kata-ha-jime", "Kata-juji-jime", "Gyaku-juji-jime", "Nami-juji-jime", "Sankaku-jime", "Sode-guruma-jime", "Tsukkomi-jime"] },
    { label: "Kansetsu-waza · clés de bras", techniques: ["Juji-gatame", "Ude-garami", "Ude-gatame", "Waki-gatame", "Hiza-gatame", "Sankaku-gatame", "Hara-gatame"] }
  ];

  const tachiWazaTechniques = tachiWazaFamilies.flatMap((family) => family.techniques);
  const neWazaTechniques = neWazaFamilies.flatMap((family) => family.techniques);

  function createEmptyCombatScoreRow(): CombatScoreFormRow {
    return { category: "", technique: "", neWazaType: "", value: "" };
  }

  // COMBAT-TECH-OPT : un point est enregistrable dès que sa valeur est connue ; la technique peut rester à préciser.
  function isCombatScoreRowComplete(score: CombatScoreFormRow): boolean {
    return Boolean(score.value);
  }

  window.KirokuCompetitionFormHelpers = {
    createEmptyCombatScoreRow,
    isCombatScoreRowComplete,
    neWazaFamilies,
    neWazaTechniques,
    tachiWazaFamilies,
    tachiWazaTechniques
  };
})();
