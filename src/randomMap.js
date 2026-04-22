(function (globalScope) {
  const PEG_RADIUS = 16;
  const TOTAL_PEGS = 42;
  const ORANGE_COUNT = 12;
  const GREEN_COUNT = 2;
  const LAUNCH_Y = 94;
  const AIM_LEFT_EDGE = -0.14;
  const AIM_RIGHT_EDGE = -Math.PI + 0.32;
  const AIMABLE_BUFFER = PEG_RADIUS + 8;

  const MAP_OPTIONS = [
    {
      id: "random",
      name: "Random",
      description: "Fresh peg soup every round.",
    },
    {
      id: "crown",
      name: "Crown",
      description: "Royal spikes with a packed center.",
    },
    {
      id: "heart",
      name: "Heart",
      description: "A chunky heart with a soft drop.",
    },
    {
      id: "diamond",
      name: "Diamond",
      description: "A clean gem shape with a dense core.",
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

  function isFarEnough(candidate, pegs) {
    for (const peg of pegs) {
      const dx = candidate.x - peg.x;
      const dy = candidate.y - peg.y;
      const distance = Math.hypot(dx, dy);

      if (distance < PEG_RADIUS * 2.5) {
        return false;
      }
    }

    return true;
  }

  function generateRandomCandidates(boardBounds, random) {
    const candidates = [];
    const innerPadding = 72;
    const left = boardBounds.left + innerPadding;
    const right = boardBounds.right - innerPadding;
    const top = boardBounds.top + 26;
    const bottom = boardBounds.bottom - 94;
    const usableWidth = right - left;
    const rows = 7;
    const columns = 10;
    const xStep = usableWidth / (columns - 1);
    const yStep = (bottom - top) / (rows - 1);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const offset = row % 2 === 0 ? 0 : xStep / 2;
        const x = left + column * xStep + offset + (random() - 0.5) * 26;
        const y = top + row * yStep + (random() - 0.5) * 28;

        if (x < left || x > right) {
          continue;
        }

        const candidate = liftPegIntoAimWindow(boardBounds, {
          x,
          y: Math.max(top, Math.min(bottom, y)),
        });

        if (candidate.y > bottom) {
          continue;
        }

        candidates.push(candidate);
      }
    }

    return shuffle(candidates, random);
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

  function getPresetRows(mapId) {
    if (mapId === "crown") {
      return [
        { y: 0.2, xs: [0.2, 0.35, 0.5, 0.65, 0.8] },
        { y: 0.29, xs: [0.15, 0.24, 0.33, 0.42, 0.5, 0.58, 0.67, 0.76, 0.85] },
        { y: 0.38, xs: [0.18, 0.27, 0.36, 0.45, 0.55, 0.64, 0.73, 0.82] },
        { y: 0.48, xs: [0.22, 0.32, 0.42, 0.5, 0.58, 0.68, 0.78] },
        { y: 0.59, xs: [0.27, 0.38, 0.5, 0.62, 0.73] },
        { y: 0.7, xs: [0.3, 0.4, 0.5, 0.6, 0.7] },
        { y: 0.8, xs: [0.36, 0.5, 0.64] },
      ];
    }

    if (mapId === "heart") {
      return [
        { y: 0.22, xs: [0.32, 0.4, 0.6, 0.68] },
        { y: 0.3, xs: [0.24, 0.32, 0.4, 0.5, 0.6, 0.68, 0.76] },
        { y: 0.38, xs: [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82] },
        { y: 0.48, xs: [0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78] },
        { y: 0.58, xs: [0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76] },
        { y: 0.68, xs: [0.36, 0.44, 0.52, 0.6, 0.68] },
        { y: 0.78, xs: [0.46, 0.56] },
      ];
    }

    if (mapId === "diamond") {
      return [
        { y: 0.22, xs: [0.5] },
        { y: 0.3, xs: [0.38, 0.5, 0.62] },
        { y: 0.38, xs: [0.3, 0.4, 0.5, 0.6, 0.7] },
        { y: 0.46, xs: [0.22, 0.32, 0.42, 0.5, 0.58, 0.68, 0.78] },
        { y: 0.54, xs: [0.14, 0.24, 0.34, 0.42, 0.5, 0.58, 0.66, 0.76, 0.86] },
        { y: 0.58, xs: [0.5] },
        { y: 0.62, xs: [0.22, 0.32, 0.42, 0.5, 0.58, 0.68, 0.78] },
        { y: 0.7, xs: [0.3, 0.4, 0.5, 0.6, 0.7] },
        { y: 0.78, xs: [0.38, 0.5, 0.62] },
        { y: 0.86, xs: [0.5] },
      ];
    }

    return [];
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
    const candidates = generateRandomCandidates(boardBounds, random);
    const pegs = [];

    for (const candidate of candidates) {
      if (pegs.length >= TOTAL_PEGS) {
        break;
      }

      if (!isFarEnough(candidate, pegs)) {
        continue;
      }

      pegs.push(candidate);
    }

    return pegs;
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

    if (baseLayout.length !== TOTAL_PEGS) {
      throw new Error("Map layout did not produce " + TOTAL_PEGS + " pegs.");
    }

    if (invalidPegs.length > 0) {
      throw new Error("Map layout spawned pegs above the safe aim window.");
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
  };

  globalScope.GeppleMap = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
