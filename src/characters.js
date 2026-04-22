(function () {
  const characters = [
    {
      id: "luna-hare",
      name: "Luna Hare",
      title: "Moonshot Captain",
      abilityName: "Star Pull",
      abilityDescription: "Charge on a green peg, then have the next shot bend toward the closest orange peg.",
      accent: "#ffd166",
      accentSoft: "rgba(255, 209, 102, 0.28)",
      trailColor: "rgba(255, 230, 164, 0.8)",
      ballColor: "#fff1bd",
      portraitPath: "assets/characters/luna-hare.png",
      portraitGradient: "linear-gradient(160deg, rgba(255, 209, 102, 0.78), rgba(47, 81, 153, 0.84))",
    },
    {
      id: "tempo-fox",
      name: "Tempo Fox",
      title: "Bassline Brawler",
      abilityName: "Bass Burst",
      abilityDescription: "Charge on a green peg, then make the next shot blast a shockwave on its first peg hit.",
      accent: "#ff8f5a",
      accentSoft: "rgba(255, 143, 90, 0.28)",
      trailColor: "rgba(255, 173, 140, 0.78)",
      ballColor: "#ffd6c4",
      portraitPath: "assets/characters/tempo-fox.png",
      portraitGradient: "linear-gradient(160deg, rgba(255, 143, 90, 0.82), rgba(88, 26, 76, 0.84))",
    },
    {
      id: "pixel-goat",
      name: "Pixel Goat",
      title: "Glitch Wrangler",
      abilityName: "Double Trouble",
      abilityDescription: "Charge on a green peg, then split the next shot into echo balls right after launch.",
      accent: "#69d1ff",
      accentSoft: "rgba(105, 209, 255, 0.28)",
      trailColor: "rgba(150, 226, 255, 0.82)",
      ballColor: "#d5f4ff",
      portraitPath: "assets/characters/pixel-goat.png",
      portraitGradient: "linear-gradient(160deg, rgba(105, 209, 255, 0.82), rgba(47, 226, 197, 0.8))",
    },
  ];

  const lookup = {};

  for (const character of characters) {
    lookup[character.id] = character;
  }

  window.GeppleCharacters = characters;
  window.GeppleCharacterLookup = lookup;
})();
