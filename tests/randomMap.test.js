const assert = require("node:assert/strict");

const GeppleMap = require("../src/randomMap.js");

const boardBounds = {
  left: 292,
  right: 1308,
  top: 152,
  bottom: 778,
  width: 1308 - 292,
  height: 778 - 152,
  centerX: (292 + 1308) / 2,
};

function getTypeCount(pegs, type) {
  return pegs.filter(function filterPeg(peg) {
    return peg.type === type;
  }).length;
}

function serializePositions(pegs) {
  return pegs.map(function mapPeg(peg) {
    return {
      x: Number(peg.x.toFixed(3)),
      y: Number(peg.y.toFixed(3)),
    };
  });
}

function runTest(name, callback) {
  try {
    callback();
    console.log("PASS", name);
  } catch (error) {
    console.error("FAIL", name);
    throw error;
  }
}

runTest("random layouts never place pegs above the safe aim window", function () {
  for (let seed = 1; seed <= 250; seed += 1) {
    const map = GeppleMap.generateMap(boardBounds, {
      seed,
      mapId: "random",
    });
    const tooHigh = GeppleMap.findPegsAboveAimWindow(boardBounds, map.pegs);

    assert.equal(map.pegs.length, 96);
    assert.equal(tooHigh.length, 0, "seed " + seed + " placed a peg above the safe aim window");
  }
});

runTest("every selectable layout keeps the expected peg counts and color counts", function () {
  for (const option of GeppleMap.getMapOptions()) {
    const map = GeppleMap.generateMap(boardBounds, {
      seed: 42,
      mapId: option.id,
    });

    assert.equal(map.pegs.length, 96, option.id + " should have 96 pegs");
    assert.equal(getTypeCount(map.pegs, "orange"), 25, option.id + " should have 25 orange pegs");
    assert.equal(getTypeCount(map.pegs, "green"), 2, option.id + " should have 2 green pegs");
    assert.equal(GeppleMap.findPegsAboveAimWindow(boardBounds, map.pegs).length, 0, option.id + " has a peg that is too high");
  }
});

runTest("static layouts keep the same peg positions across seeds", function () {
  for (const option of GeppleMap.getMapOptions()) {
    if (option.id === "random") {
      continue;
    }

    const first = GeppleMap.generateMap(boardBounds, {
      seed: 7,
      mapId: option.id,
    });
    const second = GeppleMap.generateMap(boardBounds, {
      seed: 999,
      mapId: option.id,
    });

    assert.deepEqual(
      serializePositions(first.pegs),
      serializePositions(second.pegs),
      option.id + " should keep the same peg positions"
    );
  }
});
