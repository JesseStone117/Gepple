(function (globalScope) {
  const PEG_RADIUS = 8;
  const TOTAL_PEGS = 96;
  const ORANGE_COUNT = 25;
  const GREEN_COUNT = 2;
  const LAUNCH_Y = 94;
  const AIM_LEFT_EDGE = -0.14;
  const AIM_RIGHT_EDGE = -Math.PI + 0.32;
  const AIMABLE_BUFFER = PEG_RADIUS + 8;
  const MIN_PEG_SPACING = 48;

  const MAP_OPTIONS = [
    {
      id: "random",
      name: "Random",
      description: "Peggle-style density with fresh spacing every round.",
    },
    {
      id: "crown",
      name: "Crown",
      description: "A crown with hanging drapes and jewel clusters.",
    },
    {
      id: "heart",
      name: "Heart",
      description: "A layered heart with ribbons and side flourishes.",
    },
    {
      id: "diamond",
      name: "Diamond",
      description: "A big center gem with orbiting side pieces.",
    },
    {
      id: "orbit",
      name: "Orbit",
      description: "Separated moons, rings, and crossing comet lanes.",
    },
    {
      id: "garden",
      name: "Garden",
      description: "Petal clusters, leaf arcs, and open pockets between blooms.",
    },
    {
      id: "clockwork",
      name: "Clockwork",
      description: "Gears, ramps, and staggered machine lanes.",
    },
    {
      id: "citadel",
      name: "Citadel",
      description: "Towers, gates, arches, and layered fortress gaps.",
    },
  ];

  function createRandom(seed) {
    let value = seed >>> 0;

    return function nextRandom() {
      value += 0x6d2b79f5;
      let next = value;

      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);

      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(text) {
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function shuffle(array, random) {
    const copy = array.slice();

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      const current = copy[index];

      copy[index] = copy[swapIndex];
      copy[swapIndex] = current;
    }

    return copy;
  }

  function spread(start, end, count) {
    if (count <= 1) {
      return [start];
    }

    const values = [];
    const step = (end - start) / (count - 1);

    for (let index = 0; index < count; index += 1) {
      values.push(Number((start + step * index).toFixed(3)));
    }

    return values;
  }

  function createAimVector(turnAim) {
    return {
      x: -Math.cos(turnAim),
      y: -Math.sin(turnAim),
    };
  }

  const LEFT_EDGE_VECTOR = createAimVector(AIM_LEFT_EDGE);
  const RIGHT_EDGE_VECTOR = createAimVector(AIM_RIGHT_EDGE);

  function getMinimumAimableY(boardBounds, x) {
    const horizontalDistance = x - boardBounds.centerX;

    if (Math.abs(horizontalDistance) < 0.001) {
      return LAUNCH_Y + AIMABLE_BUFFER;
    }

    const edgeVector = horizontalDistance < 0 ? LEFT_EDGE_VECTOR : RIGHT_EDGE_VECTOR;
    const risePerPixel = edgeVector.y / Math.max(0.001, Math.abs(edgeVector.x));

    return LAUNCH_Y + Math.abs(horizontalDistance) * risePerPixel + AIMABLE_BUFFER;
  }

  function liftPegIntoAimWindow(boardBounds, peg) {
    const minimumY = getMinimumAimableY(boardBounds, peg.x);

    return {
      x: peg.x,
      y: Math.max(minimumY, peg.y),
      radius: PEG_RADIUS,
    };
  }

  function findPegsAboveAimWindow(boardBounds, pegs) {
    return pegs.filter(function filterPeg(peg) {
      return peg.y + 0.001 < getMinimumAimableY(boardBounds, peg.x);
    });
  }

  function getPegDistance(firstPeg, secondPeg) {
    const dx = firstPeg.x - secondPeg.x;
    const dy = firstPeg.y - secondPeg.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  function findSpacingViolations(pegs, minimumDistance) {
    const requiredDistance = minimumDistance || MIN_PEG_SPACING;
    const violations = [];

    for (let firstIndex = 0; firstIndex < pegs.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < pegs.length; secondIndex += 1) {
        const distance = getPegDistance(pegs[firstIndex], pegs[secondIndex]);

        if (distance >= requiredDistance) {
          continue;
        }

        violations.push({
          firstIndex,
          secondIndex,
          distance,
        });
      }
    }

    return violations;
  }

  function isFarEnoughFromPlacedPegs(candidate, placedPegs, minimumDistance) {
    for (const placedPeg of placedPegs) {
      if (getPegDistance(candidate, placedPeg) < minimumDistance) {
        return false;
      }
    }

    return true;
  }

  function pickWellSpacedPegs(candidates, random, minimumDistance) {
    const requiredDistance = minimumDistance || MIN_PEG_SPACING;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const placedPegs = [];
      const shuffledCandidates = shuffle(candidates, random);

      for (const candidate of shuffledCandidates) {
        if (!isFarEnoughFromPlacedPegs(candidate, placedPegs, requiredDistance)) {
          continue;
        }

        placedPegs.push(candidate);

        if (placedPegs.length === TOTAL_PEGS) {
          return placedPegs;
        }
      }
    }

    throw new Error("Random map generator could not keep the pegs spaced out enough.");
  }

  function createPointsFromRows(rows) {
    const points = [];

    for (const row of rows) {
      for (const x of row.xs) {
        points.push({
          x,
          y: row.y,
        });
      }
    }

    return points;
  }

  function buildCrownRows() {
    return [
      { y: 0.14, xs: [0.12, 0.2, 0.28, 0.38, 0.5, 0.62, 0.72, 0.8] },
      { y: 0.22, xs: [0.08, 0.16, 0.24, 0.34, 0.42, 0.58, 0.66, 0.76, 0.84, 0.92] },
      { y: 0.3, xs: [0.12, 0.2, 0.28, 0.36, 0.44, 0.56, 0.64, 0.72, 0.8, 0.88] },
      { y: 0.38, xs: spread(0.08, 0.92, 12) },
      { y: 0.46, xs: spread(0.1, 0.9, 12) },
      { y: 0.54, xs: spread(0.08, 0.92, 12) },
      { y: 0.62, xs: [0.12, 0.2, 0.28, 0.36, 0.44, 0.56, 0.64, 0.72, 0.8, 0.88] },
      { y: 0.7, xs: [0.08, 0.16, 0.24, 0.34, 0.42, 0.58, 0.66, 0.76, 0.84, 0.92] },
      { y: 0.78, xs: [0.18, 0.28, 0.38, 0.5, 0.62, 0.72, 0.82] },
      { y: 0.86, xs: [0.3, 0.4, 0.5, 0.6, 0.7] },
    ];
  }

  function buildHeartRows() {
    return [
      { y: 0.14, xs: [0.18, 0.26, 0.34, 0.42, 0.58, 0.66, 0.74, 0.82] },
      { y: 0.22, xs: [0.12, 0.2, 0.28, 0.36, 0.44, 0.56, 0.64, 0.72, 0.8, 0.88] },
      { y: 0.3, xs: spread(0.08, 0.92, 12) },
      { y: 0.38, xs: spread(0.1, 0.9, 12) },
      { y: 0.46, xs: spread(0.14, 0.86, 12) },
      { y: 0.54, xs: spread(0.18, 0.82, 12) },
      { y: 0.62, xs: spread(0.22, 0.78, 10) },
      { y: 0.7, xs: spread(0.24, 0.76, 10) },
      { y: 0.78, xs: spread(0.34, 0.66, 6) },
      { y: 0.86, xs: [0.38, 0.46, 0.54, 0.62] },
    ];
  }

  function buildDiamondRows() {
    return [
      { y: 0.14, xs: [0.38, 0.46, 0.54, 0.62] },
      { y: 0.22, xs: [0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78] },
      { y: 0.3, xs: spread(0.14, 0.86, 10) },
      { y: 0.38, xs: spread(0.08, 0.92, 12) },
      { y: 0.46, xs: spread(0.04, 0.96, 14) },
      { y: 0.54, xs: spread(0.04, 0.96, 14) },
      { y: 0.62, xs: spread(0.08, 0.92, 12) },
      { y: 0.7, xs: spread(0.14, 0.86, 10) },
      { y: 0.78, xs: [0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78] },
      { y: 0.86, xs: [0.38, 0.46, 0.54, 0.62] },
    ];
  }

  function buildOrbitRows() {
    return [
      { y: 0.14, xs: [0.2, 0.3, 0.42, 0.5, 0.58, 0.7, 0.8, 0.9] },
      { y: 0.22, xs: [0.08, 0.18, 0.28, 0.4, 0.48, 0.56, 0.64, 0.76, 0.86, 0.96] },
      { y: 0.3, xs: [0.08, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 0.92, 0.98] },
      { y: 0.38, xs: [0.06, 0.16, 0.28, 0.38, 0.46, 0.54, 0.62, 0.72, 0.84, 0.94] },
      { y: 0.46, xs: [0.08, 0.18, 0.28, 0.38, 0.46, 0.54, 0.62, 0.72, 0.82, 0.92] },
      { y: 0.54, xs: [0.08, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 0.92, 0.98] },
      { y: 0.62, xs: [0.06, 0.16, 0.28, 0.38, 0.46, 0.54, 0.62, 0.72, 0.84, 0.94] },
      { y: 0.7, xs: [0.08, 0.2, 0.32, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92, 0.98] },
      { y: 0.78, xs: [0.14, 0.26, 0.38, 0.48, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.86, xs: [0.08, 0.2, 0.32, 0.44, 0.5, 0.56, 0.68, 0.8, 0.92] },
    ];
  }

  function buildGardenRows() {
    return [
      { y: 0.14, xs: [0.18, 0.28, 0.4, 0.5, 0.6, 0.72, 0.82, 0.92] },
      { y: 0.22, xs: [0.08, 0.18, 0.28, 0.4, 0.48, 0.56, 0.64, 0.76, 0.86, 0.96] },
      { y: 0.3, xs: [0.08, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 0.92, 0.98] },
      { y: 0.38, xs: [0.1, 0.22, 0.34, 0.44, 0.5, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.46, xs: [0.08, 0.2, 0.32, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92, 0.98] },
      { y: 0.54, xs: [0.1, 0.22, 0.34, 0.44, 0.5, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.62, xs: [0.08, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 0.92, 0.98] },
      { y: 0.7, xs: [0.1, 0.22, 0.34, 0.46, 0.54, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.78, xs: [0.14, 0.26, 0.38, 0.48, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.86, xs: [0.08, 0.2, 0.32, 0.44, 0.5, 0.56, 0.68, 0.8, 0.92, 0.98] },
    ];
  }

  function buildClockworkRows() {
    return [
      { y: 0.14, xs: [0.16, 0.28, 0.4, 0.5, 0.6, 0.72, 0.84, 0.92] },
      { y: 0.22, xs: [0.08, 0.18, 0.28, 0.4, 0.48, 0.56, 0.64, 0.76, 0.86, 0.96] },
      { y: 0.3, xs: [0.12, 0.22, 0.32, 0.42, 0.5, 0.58, 0.68, 0.78, 0.88, 0.98] },
      { y: 0.38, xs: [0.08, 0.2, 0.32, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92, 0.98] },
      { y: 0.46, xs: [0.08, 0.16, 0.28, 0.38, 0.48, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.54, xs: [0.04, 0.14, 0.26, 0.38, 0.48, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.62, xs: [0.08, 0.14, 0.26, 0.36, 0.46, 0.54, 0.64, 0.74, 0.86, 0.96] },
      { y: 0.7, xs: [0.04, 0.14, 0.26, 0.38, 0.48, 0.56, 0.66, 0.78, 0.9, 0.98] },
      { y: 0.78, xs: [0.16, 0.28, 0.4, 0.48, 0.56, 0.64, 0.76, 0.88, 0.98] },
      { y: 0.86, xs: [0.08, 0.22, 0.36, 0.48, 0.56, 0.68, 0.82, 0.9, 0.96] },
    ];
  }

  function buildCitadelRows() {
    return [
      { y: 0.14, xs: [0.06, 0.12, 0.24, 0.38, 0.48, 0.56, 0.66, 0.78, 0.83, 0.95] },
      { y: 0.22, xs: [0.08, 0.2, 0.32, 0.44, 0.52, 0.6, 0.72, 0.78, 0.83, 0.99] },
      { y: 0.3, xs: [0.12, 0.24, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.88, 0.98] },
      { y: 0.38, xs: [0.08, 0.2, 0.32, 0.44, 0.52, 0.6, 0.72, 0.84, 0.9, 0.96] },
      { y: 0.46, xs: [0.12, 0.24, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.88, 0.98] },
      { y: 0.54, xs: [0.08, 0.2, 0.32, 0.44, 0.52, 0.6, 0.72, 0.84, 0.9, 0.96] },
      { y: 0.62, xs: [0.06, 0.12, 0.24, 0.36, 0.46, 0.54, 0.64, 0.76, 0.88, 0.98] },
      { y: 0.7, xs: [0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92, 0.98] },
      { y: 0.78, xs: [0.08, 0.2, 0.32, 0.42, 0.5, 0.58, 0.68, 0.8, 0.92] },
      { y: 0.86, xs: [0.14, 0.28, 0.4, 0.5, 0.6, 0.72, 0.86, 0.98] },
    ];
  }

  function getPresetRows(mapId) {
    if (mapId === "crown") {
      return buildCrownRows();
    }

    if (mapId === "heart") {
      return buildHeartRows();
    }

    if (mapId === "diamond") {
      return buildDiamondRows();
    }

    if (mapId === "orbit") {
      return buildOrbitRows();
    }

    if (mapId === "garden") {
      return buildGardenRows();
    }

    if (mapId === "clockwork") {
      return buildClockworkRows();
    }

    if (mapId === "citadel") {
      return buildCitadelRows();
    }

    return [];
  }

  function generateRandomCandidates(boardBounds, random) {
    const candidates = [];
    const innerPadding = 48;
    const left = boardBounds.left + innerPadding;
    const right = boardBounds.right - innerPadding;
    const top = boardBounds.top + 18;
    const bottom = boardBounds.bottom - 86;
    const rows = 11;
    const columns = 13;
    const xStep = (right - left) / (columns - 1);
    const yStep = (bottom - top) / (rows - 1);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const offset = row % 2 === 0 ? 0 : xStep / 2;
        const x = left + column * xStep + offset + (random() - 0.5) * 4;
        const rawY = top + row * yStep + (random() - 0.5) * 4;

        if (x < left || x > right) {
          continue;
        }

        const minimumY = getMinimumAimableY(boardBounds, x);
        const candidate = liftPegIntoAimWindow(boardBounds, {
          x,
          y: Math.max(minimumY, Math.max(top, Math.min(bottom, rawY))),
        });

        if (candidate.y > bottom) {
          continue;
        }

        candidates.push(candidate);
      }
    }

    return pickWellSpacedPegs(candidates, random, MIN_PEG_SPACING);
  }

  function normalizePatternPoint(boardBounds, point) {
    const x = boardBounds.left + point.x * boardBounds.width;
    const y = boardBounds.top + point.y * boardBounds.height;

    return liftPegIntoAimWindow(boardBounds, {
      x,
      y,
    });
  }

  function createPresetLayout(boardBounds, mapId) {
    const rows = getPresetRows(mapId);
    const points = createPointsFromRows(rows);

    return points.map(function mapPoint(point) {
      return normalizePatternPoint(boardBounds, point);
    });
  }

  function decoratePegs(pegs, random) {
    const indices = shuffle(
      pegs.map(function mapPeg(_, index) {
        return index;
      }),
      random
    );

    const orangeSet = new Set(indices.slice(0, ORANGE_COUNT));
    const greenSet = new Set(indices.slice(ORANGE_COUNT, ORANGE_COUNT + GREEN_COUNT));

    return pegs.map(function mapPeg(peg, index) {
      let type = "blue";

      if (orangeSet.has(index)) {
        type = "orange";
      }

      if (greenSet.has(index)) {
        type = "green";
      }

      return {
        id: "peg-" + index,
        x: peg.x,
        y: peg.y,
        radius: peg.radius,
        type,
        isHit: false,
        wobble: random() * Math.PI * 2,
        glow: 0,
      };
    });
  }

  function getMapOption(mapId) {
    return (
      MAP_OPTIONS.find(function findOption(option) {
        return option.id === mapId;
      }) || MAP_OPTIONS[0]
    );
  }

  function createBaseLayout(boardBounds, mapId, seed) {
    if (mapId !== "random") {
      return createPresetLayout(boardBounds, mapId);
    }

    const random = createRandom(seed);
    return generateRandomCandidates(boardBounds, random);
  }

  function getDecorationSeed(seed, mapId) {
    if (mapId === "random") {
      return seed;
    }

    return hashString("gepple-map-" + mapId);
  }

  function normalizeMapRequest(seedOrOptions) {
    if (typeof seedOrOptions === "object" && seedOrOptions !== null) {
      return {
        seed: Number(seedOrOptions.seed) || 1,
        mapId: seedOrOptions.mapId || "random",
      };
    }

    return {
      seed: Number(seedOrOptions) || 1,
      mapId: "random",
    };
  }

  function generateMap(boardBounds, seedOrOptions) {
    const request = normalizeMapRequest(seedOrOptions);
    const option = getMapOption(request.mapId);
    const baseLayout = createBaseLayout(boardBounds, option.id, request.seed);
    const decorationRandom = createRandom(getDecorationSeed(request.seed, option.id));
    const invalidPegs = findPegsAboveAimWindow(boardBounds, baseLayout);
    const spacingViolations = findSpacingViolations(baseLayout, MIN_PEG_SPACING);

    if (baseLayout.length !== TOTAL_PEGS) {
      throw new Error("Map layout did not produce " + TOTAL_PEGS + " pegs.");
    }

    if (invalidPegs.length > 0) {
      throw new Error("Map layout spawned pegs above the safe aim window.");
    }

    if (spacingViolations.length > 0) {
      throw new Error("Map layout placed pegs too close together.");
    }

    return {
      seed: request.seed,
      mapId: option.id,
      name: option.name,
      pegs: decoratePegs(baseLayout, decorationRandom),
      orangeCount: ORANGE_COUNT,
      greenCount: GREEN_COUNT,
    };
  }

  const api = {
    generateMap,
    getMapOptions: function getMapOptions() {
      return MAP_OPTIONS.slice();
    },
    getMinimumAimableY,
    findPegsAboveAimWindow,
    findSpacingViolations,
  };

  globalScope.GeppleMap = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
