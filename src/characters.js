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
    {
      id: "prism-raven",
      name: "Prism Raven",
      title: "Refraction Trickster",
      abilityName: "Prism Link",
      abilityDescription: "Charge on a green peg, then make the first peg hit beam into the nearest orange peg.",
      accent: "#b06cff",
      accentSoft: "rgba(176, 108, 255, 0.28)",
      trailColor: "rgba(118, 238, 255, 0.78)",
      ballColor: "#eadcff",
      portraitPath: "assets/characters/prism-raven.png",
      portraitGradient: "linear-gradient(160deg, rgba(176, 108, 255, 0.82), rgba(21, 182, 214, 0.78))",
    },
    {
      id: "bore-mole",
      name: "Bore Mole",
      title: "Drillbreak Engineer",
      abilityName: "Tunnel Drive",
      abilityDescription: "Charge on a green peg, then drill through the next three pegs without bouncing off them.",
      accent: "#d8a24a",
      accentSoft: "rgba(216, 162, 74, 0.28)",
      trailColor: "rgba(255, 196, 96, 0.78)",
      ballColor: "#ffe0a1",
      portraitPath: "assets/characters/bore-mole.png",
      portraitGradient: "linear-gradient(160deg, rgba(216, 162, 74, 0.82), rgba(20, 111, 142, 0.76))",
    },
    {
      id: "marina-seal",
      name: "Marina Seal",
      title: "Tideback Captain",
      abilityName: "Tide Rebound",
      abilityDescription: "Charge on a green peg, then bounce once from the gutter before the shot is lost.",
      accent: "#59e0ff",
      accentSoft: "rgba(89, 224, 255, 0.28)",
      trailColor: "rgba(134, 239, 255, 0.78)",
      ballColor: "#d9fbff",
      portraitPath: "assets/characters/marina-seal.png",
      portraitGradient: "linear-gradient(160deg, rgba(89, 224, 255, 0.78), rgba(255, 143, 90, 0.72))",
    },
  ];

  const lookup = {};

  for (const character of characters) {
    lookup[character.id] = character;
  }

  window.GeppleCharacters = characters;
  window.GeppleCharacterLookup = lookup;
})();
