(function () {
  const PEG_RADIUS = 16;
  const TOTAL_PEGS = 42;
  const ORANGE_COUNT = 12;
  const GREEN_COUNT = 2;

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

  function generateCandidates(boardBounds, random) {
    const candidates = [];
    const innerPadding = 72;
    const left = boardBounds.left + innerPadding;
    const right = boardBounds.right - innerPadding;
    const top = boardBounds.top + 26;
    const bottom = boardBounds.bottom - 94;
    const usableWidth = right - left;
    const rows = 6;
    const columns = 8;
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

        candidates.push({
          x,
          y: Math.max(top, Math.min(bottom, y)),
          radius: PEG_RADIUS,
        });
      }
    }

    return shuffle(candidates, random);
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

  function generateMap(boardBounds, seed) {
    const random = createRandom(seed);
    const candidates = generateCandidates(boardBounds, random);
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

    return {
      seed,
      pegs: decoratePegs(pegs, random),
      orangeCount: ORANGE_COUNT,
      greenCount: GREEN_COUNT,
    };
  }

  window.GeppleMap = {
    generateMap,
  };
})();
