(function (globalScope) {
  const PEG_RADIUS = 6;
  const TOTAL_PEGS = 96;
  const ORANGE_COUNT = 25;
  const GREEN_COUNT = 2;
  const LAUNCH_Y = 94;
  const AIM_LEFT_EDGE = -0.14;
  const AIM_RIGHT_EDGE = -Math.PI + 0.32;
  const AIMABLE_BUFFER = PEG_RADIUS + 8;
  const MIN_PEG_SPACING = 30;

  const MAP_OPTIONS = [
    {
      id: "random",
      name: "Random",
      description: "Peggle-style density with fresh spacing every round.",
      backgroundPath: "assets/maps/random-bg.png",
    },
    {
      id: "crown",
      name: "Crown",
      description: "A crown with hanging drapes and jewel clusters.",
      backgroundPath: "assets/maps/crown-bg.png",
    },
    {
      id: "heart",
      name: "Heart",
      description: "A layered heart with ribbons and side flourishes.",
      backgroundPath: "assets/maps/heart-bg.png",
    },
    {
      id: "diamond",
      name: "Diamond",
      description: "A big center gem with orbiting side pieces.",
      backgroundPath: "assets/maps/diamond-bg.png",
    },
    {
      id: "orbit",
      name: "Orbit",
      description: "Separated moons, rings, and crossing comet lanes.",
      backgroundPath: "assets/maps/orbit-bg.png",
    },
    {
      id: "garden",
      name: "Garden",
      description: "Petal clusters, leaf arcs, and open pockets between blooms.",
      backgroundPath: "assets/maps/garden-bg.png",
    },
    {
      id: "clockwork",
      name: "Clockwork",
      description: "Gears, ramps, and staggered machine lanes.",
      backgroundPath: "assets/maps/clockwork-bg.png",
    },
    {
      id: "citadel",
      name: "Citadel",
      description: "Towers, gates, arches, and layered fortress gaps.",
      backgroundPath: "assets/maps/citadel-bg.png",
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

  function addPatternPoint(points, x, y) {
    points.push({
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
    });
  }

  function addPatternRows(points, rows) {
    for (const row of rows) {
      for (const x of row.xs) {
        addPatternPoint(points, x, row.y);
      }
    }
  }

  function addPatternLine(points, startX, startY, endX, endY, count) {
    for (let index = 0; index < count; index += 1) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;

      addPatternPoint(points, x, y);
    }
  }

  function addPatternLineMiddle(points, startX, startY, endX, endY, count) {
    for (let index = 0; index < count; index += 1) {
      const progress = (index + 1) / (count + 1);
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;

      addPatternPoint(points, x, y);
    }
  }

  function addPatternPath(points, vertices, segmentCounts) {
    for (let index = 0; index < vertices.length - 1; index += 1) {
      const start = vertices[index];
      const end = vertices[index + 1];
      const count = segmentCounts[index];
      const firstStep = index === 0 ? 0 : 1;

      for (let step = firstStep; step < count; step += 1) {
        const progress = count === 1 ? 0 : step / (count - 1);
        const x = start[0] + (end[0] - start[0]) * progress;
        const y = start[1] + (end[1] - start[1]) * progress;

        addPatternPoint(points, x, y);
      }
    }
  }

  function addClosedPatternPath(points, vertices, countPerSegment) {
    for (let index = 0; index < vertices.length; index += 1) {
      const start = vertices[index];
      const end = vertices[(index + 1) % vertices.length];

      for (let step = 0; step < countPerSegment; step += 1) {
        const progress = step / countPerSegment;
        const x = start[0] + (end[0] - start[0]) * progress;
        const y = start[1] + (end[1] - start[1]) * progress;

        addPatternPoint(points, x, y);
      }
    }
  }

  function addPatternArc(points, centerX, centerY, radiusX, radiusY, startAngle, endAngle, count) {
    for (let index = 0; index < count; index += 1) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const angle = startAngle + (endAngle - startAngle) * progress;

      addPatternPoint(
        points,
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      );
    }
  }

  function addPatternRing(points, centerX, centerY, radiusX, radiusY, count, phase) {
    const angleOffset = phase || 0;

    for (let index = 0; index < count; index += 1) {
      const angle = angleOffset + (Math.PI * 2 * index) / count;

      addPatternPoint(
        points,
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      );
    }
  }

  function addPatternGear(points, centerX, centerY, radiusX, radiusY, count, phase) {
    const angleOffset = phase || 0;

    for (let index = 0; index < count; index += 1) {
      const angle = angleOffset + (Math.PI * 2 * index) / count;
      const toothScale = index % 2 === 0 ? 1.06 : 0.9;

      addPatternPoint(
        points,
        centerX + Math.cos(angle) * radiusX * toothScale,
        centerY + Math.sin(angle) * radiusY * toothScale
      );
    }
  }

  function addGardenFlower(points, centerX, centerY) {
    const petals = [
      { x: 0, y: 0 },
      { x: 0, y: -0.072 },
      { x: 0.052, y: 0 },
      { x: 0, y: 0.072 },
      { x: -0.052, y: 0 },
      { x: 0.042, y: -0.052 },
      { x: 0.042, y: 0.052 },
      { x: -0.042, y: 0.052 },
      { x: -0.042, y: -0.052 },
    ];

    for (const petal of petals) {
      addPatternPoint(points, centerX + petal.x, centerY + petal.y);
    }
  }

  function addGardenStem(points, centerX, yValues) {
    for (let index = 0; index < yValues.length; index += 1) {
      addPatternPoint(points, centerX + Math.sin(index * 0.9) * 0.012, yValues[index]);
    }
  }

  function addGardenLeaf(points, stemX, stemY, direction) {
    addPatternPoint(points, stemX + direction * 0.04, stemY - 0.024);
    addPatternPoint(points, stemX + direction * 0.072, stemY);
    addPatternPoint(points, stemX + direction * 0.04, stemY + 0.024);
  }

  function addAccentPoints(points, accentPoints) {
    for (const accentPoint of accentPoints) {
      addPatternPoint(points, accentPoint[0], accentPoint[1]);
    }
  }

  function buildCrownPoints() {
    const points = [];
    const spikePath = [
      [0.13, 0.57],
      [0.25, 0.28],
      [0.37, 0.51],
      [0.5, 0.2],
      [0.63, 0.51],
      [0.75, 0.28],
      [0.87, 0.57],
    ];

    addPatternPath(points, spikePath, [5, 5, 6, 6, 5, 5]);
    addPatternLine(points, 0.13, 0.65, 0.87, 0.65, 18);
    addPatternLine(points, 0.18, 0.76, 0.82, 0.76, 16);
    addPatternLine(points, 0.25, 0.82, 0.75, 0.82, 12);
    addPatternRing(points, 0.5, 0.51, 0.04, 0.065, 7, 0.2);
    addPatternRing(points, 0.25, 0.47, 0.032, 0.052, 6, 0.2);
    addPatternRing(points, 0.75, 0.47, 0.032, 0.052, 6, 0.2);
    addAccentPoints(points, [
      [0.43, 0.14],
      [0.57, 0.14],
      [0.43, 0.23],
      [0.57, 0.23],
    ]);

    return points;
  }

  function buildHeartPoints() {
    const points = [];

    addPatternRows(points, [
      { y: 0.19, xs: [0.32, 0.4, 0.6, 0.68] },
      { y: 0.25, xs: [0.24, 0.31, 0.38, 0.45, 0.55, 0.62, 0.69, 0.76] },
      { y: 0.32, xs: [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9] },
      { y: 0.39, xs: [0.15, 0.23, 0.31, 0.39, 0.47, 0.53, 0.61, 0.69, 0.77, 0.85, 0.93, 0.97] },
      { y: 0.46, xs: [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.94, 0.98] },
      { y: 0.53, xs: [0.12, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94, 0.98] },
      { y: 0.6, xs: [0.19, 0.27, 0.35, 0.43, 0.5, 0.57, 0.65, 0.73, 0.81, 0.89] },
      { y: 0.67, xs: [0.18, 0.26, 0.33, 0.4, 0.47, 0.54, 0.61, 0.68, 0.75, 0.82] },
      { y: 0.74, xs: [0.3, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7] },
      { y: 0.81, xs: [0.35, 0.4, 0.45, 0.5, 0.55, 0.6] },
      { y: 0.87, xs: [0.43, 0.47, 0.51, 0.55] },
    ]);

    return points;
  }

  function buildDiamondPoints() {
    const points = [];

    addPatternRows(points, [
      { y: 0.18, xs: [0.45, 0.5, 0.55, 0.6] },
      { y: 0.25, xs: [0.33, 0.39, 0.45, 0.5, 0.55, 0.61, 0.67, 0.73] },
      { y: 0.32, xs: [0.25, 0.31, 0.37, 0.43, 0.49, 0.55, 0.61, 0.67, 0.73, 0.79] },
      { y: 0.39, xs: [0.18, 0.25, 0.32, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74, 0.81, 0.88, 0.95] },
      { y: 0.46, xs: [0.12, 0.19, 0.26, 0.33, 0.4, 0.47, 0.53, 0.6, 0.67, 0.74, 0.81, 0.88, 0.95, 0.98] },
      { y: 0.53, xs: [0.12, 0.19, 0.26, 0.33, 0.4, 0.47, 0.53, 0.6, 0.67, 0.74, 0.81, 0.88, 0.95, 0.98] },
      { y: 0.6, xs: [0.18, 0.25, 0.32, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74, 0.81, 0.88, 0.95] },
      { y: 0.67, xs: [0.25, 0.31, 0.37, 0.43, 0.49, 0.55, 0.61, 0.67, 0.73, 0.79] },
      { y: 0.74, xs: [0.33, 0.39, 0.45, 0.5, 0.55, 0.61, 0.67, 0.73] },
      { y: 0.82, xs: [0.43, 0.48, 0.53, 0.58] },
    ]);

    return points;
  }

  function buildOrbitPoints() {
    const points = [];

    addPatternRing(points, 0.21, 0.55, 0.085, 0.138, 16, 0.15);
    addPatternRing(points, 0.5, 0.5, 0.14, 0.09, 12, 0.1);
    addPatternRing(points, 0.79, 0.55, 0.085, 0.138, 16, 0.45);
    addPatternArc(points, 0.5, 0.22, 0.34, 0.08, -Math.PI * 0.95, -Math.PI * 0.05, 11);
    addPatternArc(points, 0.5, 0.78, 0.34, 0.08, Math.PI * 0.05, Math.PI * 0.95, 11);
    addPatternLineMiddle(points, 0.14, 0.35, 0.32, 0.24, 4);
    addPatternLineMiddle(points, 0.86, 0.35, 0.68, 0.24, 4);
    addAccentPoints(points, [
      [0.12, 0.68],
      [0.17, 0.74],
      [0.25, 0.9],
      [0.34, 0.74],
      [0.66, 0.74],
      [0.75, 0.9],
      [0.83, 0.74],
      [0.88, 0.68],
      [0.4, 0.2],
      [0.6, 0.2],
      [0.38, 0.9],
      [0.62, 0.9],
      [0.22, 0.24],
      [0.78, 0.24],
      [0.32, 0.64],
      [0.68, 0.64],
      [0.1, 0.48],
      [0.9, 0.48],
      [0.46, 0.32],
      [0.54, 0.32],
      [0.28, 0.9],
      [0.72, 0.9],
    ]);

    return points;
  }

  function buildGardenPoints() {
    const points = [];
    const accentPoints = [
      [0.1, 0.72],
      [0.14, 0.76],
      [0.18, 0.8],
      [0.23, 0.84],
      [0.3, 0.83],
      [0.7, 0.83],
      [0.77, 0.84],
      [0.82, 0.8],
      [0.86, 0.76],
      [0.9, 0.72],
      [0.12, 0.4],
      [0.15, 0.47],
      [0.12, 0.54],
      [0.88, 0.54],
      [0.85, 0.47],
      [0.88, 0.4],
      [0.34, 0.23],
      [0.42, 0.2],
      [0.58, 0.2],
      [0.66, 0.23],
      [0.36, 0.54],
      [0.64, 0.54],
      [0.34, 0.74],
      [0.66, 0.74],
      [0.37, 0.88],
      [0.63, 0.88],
      [0.44, 0.58],
      [0.56, 0.58],
      [0.4, 0.64],
      [0.6, 0.64],
    ];

    addGardenFlower(points, 0.24, 0.33);
    addGardenFlower(points, 0.5, 0.42);
    addGardenFlower(points, 0.76, 0.33);
    addGardenFlower(points, 0.5, 0.7);

    addGardenStem(points, 0.24, [0.46, 0.53, 0.6, 0.67, 0.74]);
    addGardenStem(points, 0.76, [0.46, 0.53, 0.6, 0.67, 0.74]);
    addGardenStem(points, 0.5, [0.82, 0.88]);

    addGardenLeaf(points, 0.24, 0.55, 1);
    addGardenLeaf(points, 0.24, 0.68, -1);
    addGardenLeaf(points, 0.76, 0.55, -1);
    addGardenLeaf(points, 0.76, 0.68, 1);
    addGardenLeaf(points, 0.5, 0.85, -1);
    addGardenLeaf(points, 0.5, 0.85, 1);
    addAccentPoints(points, accentPoints);

    return points;
  }

  function buildClockworkPoints() {
    const points = [];

    addPatternGear(points, 0.28, 0.44, 0.115, 0.186, 24, 0.1);
    addPatternGear(points, 0.72, 0.44, 0.115, 0.186, 24, 0.4);
    addPatternGear(points, 0.5, 0.7, 0.095, 0.154, 20, 0.2);
    addPatternLine(points, 0.2, 0.18, 0.8, 0.18, 14);
    addPatternLine(points, 0.2, 0.93, 0.8, 0.93, 14);

    return points;
  }

  function buildCitadelPoints() {
    const points = [];

    addClosedPatternPath(points, [
      [0.15, 0.32],
      [0.28, 0.32],
      [0.28, 0.76],
      [0.15, 0.76],
    ], 4);
    addClosedPatternPath(points, [
      [0.72, 0.32],
      [0.85, 0.32],
      [0.85, 0.76],
      [0.72, 0.76],
    ], 4);
    addPatternArc(points, 0.5, 0.72, 0.12, 0.14, Math.PI, Math.PI * 2, 10);
    addPatternLine(points, 0.34, 0.52, 0.66, 0.52, 11);
    addPatternLine(points, 0.28, 0.84, 0.72, 0.84, 15);
    addPatternLine(points, 0.16, 0.24, 0.27, 0.24, 4);
    addPatternLine(points, 0.73, 0.24, 0.84, 0.24, 4);
    addPatternLine(points, 0.38, 0.36, 0.62, 0.36, 6);
    addAccentPoints(points, [
      [0.19, 0.46],
      [0.24, 0.46],
      [0.76, 0.46],
      [0.81, 0.46],
      [0.18, 0.59],
      [0.23, 0.59],
      [0.77, 0.59],
      [0.82, 0.59],
      [0.47, 0.91],
      [0.53, 0.91],
      [0.38, 0.24],
      [0.62, 0.24],
      [0.31, 0.28],
      [0.69, 0.28],
    ]);

    return points;
  }

  function getPresetPoints(mapId) {
    if (mapId === "crown") {
      return buildCrownPoints();
    }

    if (mapId === "heart") {
      return buildHeartPoints();
    }

    if (mapId === "diamond") {
      return buildDiamondPoints();
    }

    if (mapId === "orbit") {
      return buildOrbitPoints();
    }

    if (mapId === "garden") {
      return buildGardenPoints();
    }

    if (mapId === "clockwork") {
      return buildClockworkPoints();
    }

    if (mapId === "citadel") {
      return buildCitadelPoints();
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
    const points = getPresetPoints(mapId);

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
      backgroundPath: option.backgroundPath,
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
