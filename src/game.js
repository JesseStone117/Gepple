(function () {
  const GAME_WIDTH = 1600;
  const GAME_HEIGHT = 900;
  const GAMEPLAY_RENDER_SCALE = 0.91;
  const GAMEPLAY_RENDER_ORIGIN_Y = 38;
  const BOARD_LEFT = 292;
  const BOARD_RIGHT = 1308;
  const BOARD_TOP = 152;
  const BOARD_BOTTOM = 778;
  const LAUNCH_Y = 94;
  const BALL_RADIUS = 12;
  const BALL_SPEED = 860;
  const AIM_TURN_SPEED = 0.72;
  const AIM_CURVE_POWER = 1.7;
  const GRAVITY = 690;
  const MAX_PARTICLES = 220;
  const TURN_DELAY = 0.9;
  const LUNA_HOMING_DELAY = 0.42;
  const LUNA_HOMING_MIN_SPEED = 760;
  const LUNA_HOMING_TURN_RATE = 9.5;
  const LUNA_HOMING_CAPTURE_PADDING = 14;
  const TRAJECTORY_PREVIEW_STEP = 1 / 120;
  const TRAJECTORY_PREVIEW_SECONDS = 2.7;
  const TRAJECTORY_PREVIEW_POINT_INTERVAL = 0.075;
  const LAST_ORANGE_TIME_SCALE = 0.16;
  const LAST_ORANGE_CAMERA_SCALE = 1.54;
  const LAST_ORANGE_CAMERA_SPEED = 1.9;
  const MOVING_CATCHER_SCORE_BONUS = 5000;
  const SCORE_MULTIPLIER_STEPS = [
    { orangeHits: 0, multiplier: 1 },
    { orangeHits: 10, multiplier: 2 },
    { orangeHits: 15, multiplier: 3 },
    { orangeHits: 19, multiplier: 5 },
    { orangeHits: 22, multiplier: 10 },
  ];
  const FINAL_BUCKET_BONUSES = [1000, 2000, 5000, 2000, 1000];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getShortestAngleDelta(fromAngle, toAngle) {
    return Math.atan2(Math.sin(toAngle - fromAngle), Math.cos(toAngle - fromAngle));
  }

  function getPreciseAimAmount(rawAimX) {
    const aimX = clamp(rawAimX, -1, 1);
    const magnitude = Math.abs(aimX);

    if (magnitude === 0) {
      return 0;
    }

    return Math.sign(aimX) * Math.pow(magnitude, AIM_CURVE_POWER);
  }

  function getScoreMultiplierForOrangeHits(orangeHits) {
    let activeStep = SCORE_MULTIPLIER_STEPS[0];

    for (const step of SCORE_MULTIPLIER_STEPS) {
      if (orangeHits < step.orangeHits) {
        return activeStep.multiplier;
      }

      activeStep = step;
    }

    return activeStep.multiplier;
  }

  function findNextScoreMultiplierStep(orangeHits) {
    for (const step of SCORE_MULTIPLIER_STEPS) {
      if (step.orangeHits > orangeHits) {
        return step;
      }
    }

    return null;
  }

  function formatBucketBonus(bonus) {
    if (bonus >= 1000) {
      return bonus / 1000 + "K";
    }

    return String(bonus);
  }

  function traceRoundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);

    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function createParticle(x, y, color, size, speedX, speedY, life) {
    return {
      x,
      y,
      color,
      size,
      speedX,
      speedY,
      life,
      maxLife: life,
    };
  }

  class GeppleGame {
    constructor(canvas, audioManager) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.audioManager = audioManager;

      this.width = GAME_WIDTH;
      this.height = GAME_HEIGHT;
      this.boardBounds = {
        left: BOARD_LEFT,
        right: BOARD_RIGHT,
        top: BOARD_TOP,
        bottom: BOARD_BOTTOM,
        width: BOARD_RIGHT - BOARD_LEFT,
        height: BOARD_BOTTOM - BOARD_TOP,
        centerX: (BOARD_LEFT + BOARD_RIGHT) / 2,
      };

      this.scene = "menu";
      this.turnState = "idle";
      this.players = [];
      this.activePlayerIndex = 0;
      this.activeBalls = [];
      this.pegs = [];
      this.orangeTotal = 0;
      this.orangeRemaining = 0;
      this.turnAim = -Math.PI / 2;
      this.turnDelay = 0;
      this.seed = 0;
      this.mapId = "random";
      this.mapName = "Random";
      this.mapBackgroundPath = "";
      this.mapBackgroundImage = null;
      this.backgroundImageCache = {};
      this.roundReason = "";
      this.winnerIndex = 0;
      this.finalShotWin = false;
      this.finalShotActive = false;
      this.finalShotOwnerIndex = -1;
      this.finalBucketBonus = 0;
      this.finalBucketLabel = "";
      this.finalBucketOwnerIndex = -1;
      this.lastOrangeCelebrationActive = false;
      this.lastOrangeBall = null;
      this.lastOrangeCameraProgress = 0;
      this.lastOrangeFocusX = this.boardBounds.centerX;
      this.lastOrangeFocusY = this.boardBounds.bottom;

      this.bucket = {
        x: this.boardBounds.centerX,
        y: this.height - 52,
        width: 158,
        height: 30,
        speed: 280,
        direction: 1,
      };

      this.particles = [];
      this.toasts = [];
      this.backgroundBubbles = this.createBackgroundBubbles();
      this.screenFlash = 0;
      this.cameraShake = 0;
    }

    createBackgroundBubbles() {
      const bubbles = [];

      for (let index = 0; index < 18; index += 1) {
        bubbles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: 30 + Math.random() * 90,
          speed: 14 + Math.random() * 30,
          tint: index % 2 === 0 ? "rgba(255, 209, 102, 0.06)" : "rgba(105, 209, 255, 0.06)",
        });
      }

      return bubbles;
    }

    startRound(playerConfigs, roundOptions) {
      this.scene = "playing";
      this.turnState = "aiming";
      this.turnAim = -Math.PI / 2;
      this.turnDelay = 0;
      this.seed = Date.now();
      this.mapId = roundOptions && roundOptions.mapId ? roundOptions.mapId : "random";
      this.roundReason = "";
      this.winnerIndex = 0;
      this.finalShotWin = false;
      this.finalShotActive = false;
      this.finalShotOwnerIndex = -1;
      this.finalBucketBonus = 0;
      this.finalBucketLabel = "";
      this.finalBucketOwnerIndex = -1;
      this.lastOrangeCelebrationActive = false;
      this.lastOrangeBall = null;
      this.lastOrangeCameraProgress = 0;
      this.lastOrangeFocusX = this.boardBounds.centerX;
      this.lastOrangeFocusY = this.boardBounds.bottom;
      this.bucket.x = this.boardBounds.centerX;
      this.bucket.direction = 1;

      this.players = playerConfigs.map(function mapPlayer(playerConfig, index) {
        return {
          index,
          name: playerConfig.name,
          characterId: playerConfig.characterId,
          controllerLabel: playerConfig.controllerLabel,
          score: 0,
          ballsRemaining: 6,
          orangeHits: 0,
          currentShotHits: 0,
          abilityCharged: false,
          abilityUsedThisShot: false,
        };
      });

      this.activePlayerIndex = 0;
      this.activeBalls = [];
      this.particles = [];
      this.toasts = [];
      this.screenFlash = 0;
      this.cameraShake = 0;

      this.generateNewMap();
      this.pushToast(this.mapName + " board loaded. Orange pegs decide the pace.");
    }

    returnToMenu() {
      this.scene = "menu";
      this.turnState = "idle";
      this.activeBalls = [];
      this.particles = [];
      this.toasts = [];
      this.lastOrangeCelebrationActive = false;
      this.lastOrangeBall = null;
      this.lastOrangeCameraProgress = 0;
      this.audioManager.stopGameMusic();
    }

    generateNewMap() {
      const map = window.GeppleMap.generateMap(this.boardBounds, {
        seed: this.seed,
        mapId: this.mapId,
      });

      this.mapName = map.name;
      this.setMapBackground(map.backgroundPath);
      this.pegs = map.pegs;
      this.orangeTotal = map.orangeCount;
      this.orangeRemaining = map.orangeCount;
    }

    setMapBackground(backgroundPath) {
      this.mapBackgroundPath = backgroundPath || "";
      this.mapBackgroundImage = this.getBackgroundImage(this.mapBackgroundPath);
    }

    getBackgroundImage(backgroundPath) {
      if (!backgroundPath || typeof Image === "undefined") {
        return null;
      }

      if (this.backgroundImageCache[backgroundPath]) {
        return this.backgroundImageCache[backgroundPath];
      }

      const image = new Image();
      image.src = this.getVersionedAssetPath(backgroundPath);
      this.backgroundImageCache[backgroundPath] = image;

      return image;
    }

    getVersionedAssetPath(path) {
      if (typeof window !== "undefined" && window.GeppleAssetPath) {
        return window.GeppleAssetPath(path);
      }

      return path;
    }

    getActivePlayer() {
      return this.players[this.activePlayerIndex];
    }

    getActiveCharacter() {
      const player = this.getActivePlayer();

      if (!player) {
        return null;
      }

      return window.GeppleCharacterLookup[player.characterId];
    }

    getOrangeClaimed() {
      return Math.max(0, this.orangeTotal - this.orangeRemaining);
    }

    getScoreMultiplier() {
      return getScoreMultiplierForOrangeHits(this.getOrangeClaimed());
    }

    getNextScoreMultiplierStep() {
      return findNextScoreMultiplierStep(this.getOrangeClaimed());
    }

    getOrangeNeededForNextMultiplier() {
      const nextStep = this.getNextScoreMultiplierStep();

      if (!nextStep) {
        return 0;
      }

      return Math.max(0, nextStep.orangeHits - this.getOrangeClaimed());
    }

    hasReserveBalls() {
      return this.players.some(function hasBalls(player) {
        return player.ballsRemaining > 0;
      });
    }

    getLaunchVector(speed) {
      return {
        x: -Math.cos(this.turnAim) * speed,
        y: -Math.sin(this.turnAim) * speed,
      };
    }

    isActiveAbilityReady() {
      const activePlayer = this.getActivePlayer();

      if (!activePlayer) {
        return false;
      }

      return activePlayer.abilityCharged && this.turnState === "aiming";
    }

    pushToast(text) {
      this.toasts.unshift({
        id: "toast-" + Date.now() + "-" + Math.random(),
        text,
        life: 3,
        maxLife: 3,
      });

      this.toasts = this.toasts.slice(0, 4);
    }

    update(deltaTime, playerInputs) {
      this.updateBackground(deltaTime);
      this.updateToasts(deltaTime);
      this.updateLastOrangeCamera(deltaTime);

      if (this.scene !== "playing") {
        this.render();
        return;
      }

      const step = 1 / 120;
      const gameplayDeltaTime = deltaTime * this.getGameplayTimeScale();
      let remaining = Math.min(gameplayDeltaTime, 1 / 24);

      while (remaining > 0) {
        const currentStep = Math.min(step, remaining);
        this.updatePlayingStep(currentStep, playerInputs);
        remaining -= currentStep;
      }

      this.render();
    }

    updateBackground(deltaTime) {
      for (const bubble of this.backgroundBubbles) {
        bubble.y += bubble.speed * deltaTime;

        if (bubble.y - bubble.radius > this.height + 60) {
          bubble.y = -bubble.radius;
          bubble.x = Math.random() * this.width;
        }
      }
    }

    updateToasts(deltaTime) {
      for (const toast of this.toasts) {
        toast.life -= deltaTime;
      }

      this.toasts = this.toasts.filter(function keepToast(toast) {
        return toast.life > 0;
      });
    }

    getGameplayTimeScale() {
      if (this.lastOrangeCelebrationActive) {
        return LAST_ORANGE_TIME_SCALE;
      }

      return 1;
    }

    updateLastOrangeCamera(deltaTime) {
      const targetProgress = this.lastOrangeCelebrationActive ? 1 : 0;
      const nextProgress =
        this.lastOrangeCameraProgress +
        (targetProgress - this.lastOrangeCameraProgress) * Math.min(1, deltaTime * LAST_ORANGE_CAMERA_SPEED);

      this.lastOrangeCameraProgress = nextProgress;

      if (!this.lastOrangeCelebrationActive) {
        return;
      }

      const focusBall = this.getLastOrangeFocusBall();

      if (!focusBall) {
        return;
      }

      this.lastOrangeFocusX = focusBall.x;
      this.lastOrangeFocusY = focusBall.y;
    }

    getLastOrangeFocusBall() {
      if (this.lastOrangeBall && this.activeBalls.includes(this.lastOrangeBall)) {
        return this.lastOrangeBall;
      }

      if (this.activeBalls.length === 0) {
        return null;
      }

      return this.activeBalls[0];
    }

    updatePlayingStep(deltaTime, playerInputs) {
      this.screenFlash = Math.max(0, this.screenFlash - deltaTime * 2.3);
      this.cameraShake = Math.max(0, this.cameraShake - deltaTime * 2.6);

      if (!this.finalShotActive) {
        this.updateBucket(deltaTime);
      }

      this.updateParticles(deltaTime);

      if (this.turnState === "aiming") {
        this.updateAim(deltaTime, playerInputs[this.activePlayerIndex]);
      }

      if (this.turnState === "in-flight") {
        this.updateBalls(deltaTime);
      }

      if (this.turnState === "switching") {
        this.turnDelay -= deltaTime;

        if (this.turnDelay <= 0) {
          this.advanceTurn();
        }
      }

      this.checkRoundEnd();
    }

    updateAim(deltaTime, input) {
      if (!input) {
        return;
      }

      this.turnAim -= getPreciseAimAmount(input.aimX) * deltaTime * AIM_TURN_SPEED;
      this.turnAim = clamp(this.turnAim, -Math.PI + 0.32, -0.14);

      if (!input.launchPressed) {
        return;
      }

      const activePlayer = this.getActivePlayer();

      if (!activePlayer || activePlayer.ballsRemaining <= 0) {
        return;
      }

      const shouldAutoUseAbility = activePlayer.abilityCharged;

      activePlayer.ballsRemaining -= 1;
      activePlayer.currentShotHits = 0;
      activePlayer.abilityUsedThisShot = false;
      activePlayer.abilityCharged = false;

      const character = window.GeppleCharacterLookup[activePlayer.characterId];
      const isFinalShot = !this.hasReserveBalls();
      const launchVector = this.getLaunchVector(BALL_SPEED);
      const primaryBall = {
        x: this.boardBounds.centerX,
        y: LAUNCH_Y,
        radius: BALL_RADIUS,
        speedX: launchVector.x,
        speedY: launchVector.y,
        ownerIndex: activePlayer.index,
        trailColor: character.trailColor,
        color: character.ballColor,
        guaranteedOrangeHoming: false,
        homingDelay: 0,
        homingTimer: 0,
        homingTargetId: null,
        homingMinSpeed: 0,
        homingTurnRate: 0,
        scoreScale: 1,
        shockwaveReady: false,
        prismLinkReady: false,
        drillHitsRemaining: 0,
        tideReboundReady: false,
        isFinalShot,
      };

      this.activeBalls.push(primaryBall);

      if (shouldAutoUseAbility) {
        this.activateStoredAbility(activePlayer, primaryBall);
      }

      if (isFinalShot) {
        this.finalShotActive = true;
        this.finalShotOwnerIndex = activePlayer.index;
      }

      this.turnState = "in-flight";
      this.audioManager.playLaunch();

      if (isFinalShot) {
        this.pushToast(activePlayer.name + " fired the final shot. Land a bottom bucket for bonus score.");
        return;
      }

      this.pushToast(activePlayer.name + " launched " + character.name + "'s shot.");
    }

    updateBalls(deltaTime) {
      for (let index = this.activeBalls.length - 1; index >= 0; index -= 1) {
        const ball = this.activeBalls[index];

        this.updateSingleBall(ball, deltaTime);

        if (
          ball.isRemoved ||
          (!ball.guaranteedOrangeHoming && !this.finalShotActive && ball.y - ball.radius > this.height + 80)
        ) {
          this.activeBalls.splice(index, 1);
        }
      }

      if (this.activeBalls.length === 0 && this.turnState === "in-flight") {
        this.turnState = "switching";
        this.turnDelay = TURN_DELAY;
      }
    }

    updateSingleBall(ball, deltaTime) {
      this.updateHoming(ball, deltaTime);

      ball.speedY += GRAVITY * deltaTime;
      ball.x += ball.speedX * deltaTime;
      ball.y += ball.speedY * deltaTime;

      this.handleWallBounce(ball);
      this.handleBucketCatch(ball);

      if (ball.isRemoved) {
        return;
      }

      this.handleFinalShotFloorBounce(ball);
      this.handleGuaranteedHomingFloorBounce(ball);
      this.handleTideRebound(ball);

      this.handlePegCollisions(ball);
      this.resolveGuaranteedHomingHit(ball);
    }

    updateHoming(ball, deltaTime) {
      if (!ball.guaranteedOrangeHoming && ball.homingTimer <= 0) {
        return;
      }

      if (ball.homingDelay > 0) {
        ball.homingDelay = Math.max(0, ball.homingDelay - deltaTime);
        return;
      }

      const target = this.getHomingTarget(ball);

      if (!target) {
        this.clearHoming(ball);
        return;
      }

      this.applyHoming(ball, target, deltaTime);

      if (ball.guaranteedOrangeHoming) {
        return;
      }

      ball.homingTimer = Math.max(0, ball.homingTimer - deltaTime);
    }

    getHomingTarget(ball) {
      if (ball.homingTargetId) {
        const currentTarget = this.pegs.find(function findPeg(peg) {
          return peg.id === ball.homingTargetId && !peg.isHit && peg.type === "orange";
        });

        if (currentTarget) {
          return currentTarget;
        }
      }

      const target = this.findClosestOrangePeg(ball);

      if (target) {
        ball.homingTargetId = target.id;
      }

      return target;
    }

    findClosestOrangePeg(source) {
      let target = null;
      let bestDistance = Infinity;

      for (const peg of this.pegs) {
        if (peg.isHit || peg.type !== "orange") {
          continue;
        }

        const dx = peg.x - source.x;
        const dy = peg.y - source.y;
        const distance = Math.hypot(dx, dy);

        if (distance < bestDistance) {
          bestDistance = distance;
          target = peg;
        }
      }

      return target;
    }

    applyHoming(ball, target, deltaTime) {
      const turnRate = ball.homingTurnRate || 2.6;
      const minimumSpeed = ball.homingMinSpeed || 420;

      const desiredAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
      const currentAngle = Math.atan2(ball.speedY, ball.speedX);
      const angleDelta = getShortestAngleDelta(currentAngle, desiredAngle);
      const maxTurn = turnRate * deltaTime;
      const nextAngle = currentAngle + clamp(angleDelta, -maxTurn, maxTurn);
      const speed = Math.max(minimumSpeed, Math.hypot(ball.speedX, ball.speedY));

      ball.speedX = Math.cos(nextAngle) * speed;
      ball.speedY = Math.sin(nextAngle) * speed;
    }

    clearHoming(ball) {
      ball.guaranteedOrangeHoming = false;
      ball.homingDelay = 0;
      ball.homingTimer = 0;
      ball.homingTargetId = null;
      ball.homingMinSpeed = 0;
      ball.homingTurnRate = 0;
    }

    shouldProtectGuaranteedHoming(ball) {
      return ball.guaranteedOrangeHoming && this.orangeRemaining > 0;
    }

    handleWallBounce(ball) {
      const leftWall = this.boardBounds.left + 12;
      const rightWall = this.boardBounds.right - 12;
      const ceiling = 42;

      if (ball.x - ball.radius < leftWall) {
        ball.x = leftWall + ball.radius;
        ball.speedX = Math.abs(ball.speedX) * 0.98;
      }

      if (ball.x + ball.radius > rightWall) {
        ball.x = rightWall - ball.radius;
        ball.speedX = -Math.abs(ball.speedX) * 0.98;
      }

      if (ball.y - ball.radius < ceiling) {
        ball.y = ceiling + ball.radius;
        ball.speedY = Math.abs(ball.speedY) * 0.96;
      }
    }

    getFinalBuckets() {
      const gap = 16;
      const laneLeft = this.boardBounds.left + 28;
      const laneWidth = this.boardBounds.width - 56;
      const bucketWidth = (laneWidth - gap * (FINAL_BUCKET_BONUSES.length - 1)) / FINAL_BUCKET_BONUSES.length;
      const bucketHeight = 46;
      const bucketBottom = this.height - 10;
      const bucketTop = bucketBottom - bucketHeight;

      return FINAL_BUCKET_BONUSES.map(function mapBucket(bonus, index) {
        const left = laneLeft + index * (bucketWidth + gap);

        return {
          left,
          right: left + bucketWidth,
          top: bucketTop,
          bottom: bucketBottom,
          width: bucketWidth,
          height: bucketHeight,
          bonus,
          label: formatBucketBonus(bonus),
          index,
        };
      });
    }

    findFinalBucketAt(x) {
      const buckets = this.getFinalBuckets();

      for (const bucket of buckets) {
        if (x >= bucket.left && x <= bucket.right) {
          return bucket;
        }
      }

      return null;
    }

    handleBucketCatch(ball) {
      if (this.shouldProtectGuaranteedHoming(ball)) {
        return;
      }

      if (this.finalShotActive) {
        this.handleFinalBucketCatch(ball);
        return;
      }

      const bucketTop = this.bucket.y - this.bucket.height;
      const bucketLeft = this.bucket.x - this.bucket.width / 2;
      const bucketRight = this.bucket.x + this.bucket.width / 2;

      if (ball.y + ball.radius < bucketTop) {
        return;
      }

      if (ball.x < bucketLeft || ball.x > bucketRight) {
        return;
      }

      const player = this.players[ball.ownerIndex];

      if (!player) {
        return;
      }

      player.score += MOVING_CATCHER_SCORE_BONUS;
      ball.isRemoved = true;
      this.audioManager.playBucketCatch();
      this.spawnBurst(ball.x, bucketTop, "#7df2c5", 16, 160);
      this.pushToast(player.name + " landed the moving catcher for +5K.");
    }

    handleFinalBucketCatch(ball) {
      const bucket = this.findFinalBucketAt(ball.x);

      if (!bucket) {
        return;
      }

      if (ball.y + ball.radius < bucket.top) {
        return;
      }

      if (ball.speedY < 0) {
        return;
      }

      const player = this.players[ball.ownerIndex];

      if (!player) {
        return;
      }

      player.score += bucket.bonus;
      ball.isRemoved = true;
      this.finalBucketBonus = bucket.bonus;
      this.finalBucketLabel = bucket.label;
      this.finalBucketOwnerIndex = player.index;

      this.audioManager.playBucketCatch();
      this.spawnBurst(ball.x, bucket.top, "#ffe27a", 28, 230);
      this.finishRound(player.name + " landed the " + bucket.label + " final bucket");
    }

    handleFinalShotFloorBounce(ball) {
      if (!this.finalShotActive) {
        return;
      }

      const floorY = this.height - 8;

      if (ball.y + ball.radius < floorY) {
        return;
      }

      ball.y = floorY - ball.radius;
      ball.speedY = -Math.max(520, Math.abs(ball.speedY) * 0.82);
      ball.speedX *= 0.98;

      if (Math.abs(ball.speedX) >= 120) {
        return;
      }

      ball.speedX = ball.x < this.boardBounds.centerX ? 170 : -170;
    }

    handleGuaranteedHomingFloorBounce(ball) {
      if (!ball.guaranteedOrangeHoming || this.finalShotActive) {
        return;
      }

      const floorY = this.height - 18;

      if (ball.y + ball.radius < floorY) {
        return;
      }

      ball.y = floorY - ball.radius;
      ball.speedY = -Math.max(520, Math.abs(ball.speedY) * 0.82);
      ball.speedX *= 0.98;
    }

    handleTideRebound(ball) {
      if (!ball.tideReboundReady || this.finalShotActive) {
        return;
      }

      const floorY = this.height - 18;

      if (ball.y + ball.radius < floorY || ball.speedY < 0) {
        return;
      }

      ball.tideReboundReady = false;
      ball.y = floorY - ball.radius;
      ball.speedY = -Math.max(680, Math.abs(ball.speedY) * 0.88);
      ball.speedX *= 0.9;

      this.spawnBurst(ball.x, floorY, "#59e0ff", 24, 210);
      this.pushToast("Tide Rebound kicked the shot back into play.");
      this.audioManager.playAbilityUse();
    }

    resolveGuaranteedHomingHit(ball) {
      if (!ball.guaranteedOrangeHoming) {
        return;
      }

      if (ball.homingDelay > 0) {
        return;
      }

      const target = this.getHomingTarget(ball);

      if (!target) {
        this.clearHoming(ball);
        return;
      }

      const dx = ball.x - target.x;
      const dy = ball.y - target.y;
      const distance = Math.hypot(dx, dy);
      const captureRadius = ball.radius + target.radius + LUNA_HOMING_CAPTURE_PADDING;

      if (distance > captureRadius) {
        return;
      }

      const normalX = distance === 0 ? 0 : dx / distance;
      const normalY = distance === 0 ? -1 : dy / distance;
      const overlap = Math.max(0, ball.radius + target.radius - distance);
      const dot = ball.speedX * normalX + ball.speedY * normalY;

      target.isHit = true;
      target.glow = 1;
      ball.x += normalX * overlap;
      ball.y += normalY * overlap;
      ball.speedX -= 2 * dot * normalX;
      ball.speedY -= 2 * dot * normalY;
      ball.speedX *= 0.985;
      ball.speedY *= 0.985;

      this.handlePegHit(target, ball);
    }

    handlePegCollisions(ball) {
      for (const peg of this.pegs) {
        if (peg.isHit) {
          continue;
        }

        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.hypot(dx, dy);
        const overlap = ball.radius + peg.radius - distance;

        if (overlap <= 0) {
          continue;
        }

        if (ball.drillHitsRemaining > 0) {
          this.handleDrillPegCollision(ball, peg, overlap);
          break;
        }

        peg.isHit = true;
        peg.glow = 1;

        const normalX = distance === 0 ? 0 : dx / distance;
        const normalY = distance === 0 ? -1 : dy / distance;

        ball.x += normalX * overlap;
        ball.y += normalY * overlap;

        const dot = ball.speedX * normalX + ball.speedY * normalY;
        ball.speedX -= 2 * dot * normalX;
        ball.speedY -= 2 * dot * normalY;
        ball.speedX *= 0.985;
        ball.speedY *= 0.985;

        this.handlePegHit(peg, ball);
        break;
      }
    }

    handleDrillPegCollision(ball, peg, overlap) {
      const speed = Math.max(1, Math.hypot(ball.speedX, ball.speedY));
      const moveDistance = Math.max(2, overlap);

      peg.isHit = true;
      peg.glow = 1;
      ball.x += (ball.speedX / speed) * moveDistance;
      ball.y += (ball.speedY / speed) * moveDistance;
      ball.speedX *= 0.985;
      ball.speedY *= 0.985;
      ball.drillHitsRemaining -= 1;

      this.handlePegHit(peg, ball);
      this.spawnBurst(ball.x, ball.y, "#d8a24a", 12, 170);
    }

    handlePegHit(peg, ball) {
      const player = this.players[ball.ownerIndex];

      if (!player) {
        return;
      }

      let points = 100;
      let particleColor = "#69d1ff";
      const previousMultiplier = this.getScoreMultiplier();

      if (peg.type === "orange") {
        points = 500;
        this.orangeRemaining -= 1;
        player.orangeHits += 1;
        particleColor = "#ff8f5a";
        this.clearHoming(ball);

        if (this.orangeRemaining <= 0) {
          this.startLastOrangeCelebration(ball);
        }
      }

      if (peg.type === "green") {
        points = 300;
        player.abilityCharged = true;
        particleColor = "#7df2c5";
        this.pushToast(player.name + " charged " + window.GeppleCharacterLookup[player.characterId].abilityName + ".");
        this.audioManager.playAbilityReady();
      }

      player.currentShotHits += 1;
      const comboBonus = 1 + (player.currentShotHits - 1) * 0.2;
      const scoreMultiplier = this.getScoreMultiplier();
      player.score += Math.round(points * comboBonus * ball.scoreScale * scoreMultiplier);

      this.audioManager.playPegHit(peg.type);
      this.screenFlash = Math.min(1, this.screenFlash + 0.1);
      this.cameraShake = Math.min(1, this.cameraShake + 0.12);
      this.spawnBurst(peg.x, peg.y, particleColor, peg.type === "orange" ? 18 : 12, 190);

      if (peg.type === "orange" && scoreMultiplier > previousMultiplier) {
        this.pushToast("Orange multiplier is now " + scoreMultiplier + "x.");
      }

      if (ball.shockwaveReady) {
        ball.shockwaveReady = false;
        this.resolveShockwave(ball, 116);
        ball.speedY = Math.min(ball.speedY, -320);
        this.spawnBurst(ball.x, ball.y, "#ff8f5a", 22, 220);
      }

      if (ball.prismLinkReady) {
        ball.prismLinkReady = false;
        this.resolvePrismLink(ball, peg);
      }
    }

    startLastOrangeCelebration(ball) {
      if (this.lastOrangeCelebrationActive) {
        return;
      }

      this.lastOrangeCelebrationActive = true;
      this.lastOrangeBall = ball;
      this.lastOrangeFocusX = ball.x;
      this.lastOrangeFocusY = ball.y;
      this.screenFlash = Math.min(1, this.screenFlash + 0.45);
      this.cameraShake = Math.min(1, this.cameraShake + 0.35);
      this.pushToast("Last orange! Follow the shot to the buckets.");
    }

    activateStoredAbility(player, primaryBall) {
      const character = window.GeppleCharacterLookup[player.characterId];

      player.abilityUsedThisShot = true;

      if (character.id === "luna-hare") {
        primaryBall.guaranteedOrangeHoming = true;
        primaryBall.homingDelay = LUNA_HOMING_DELAY;
        primaryBall.homingMinSpeed = LUNA_HOMING_MIN_SPEED;
        primaryBall.homingTurnRate = LUNA_HOMING_TURN_RATE;

        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 20, 180);
        this.pushToast(character.abilityName + " will arc into an orange after the launch.");
        this.audioManager.playAbilityUse();
        return;
      }

      if (character.id === "tempo-fox") {
        primaryBall.shockwaveReady = true;
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 22, 220);
        this.pushToast(character.abilityName + " is primed for the first peg hit.");
        this.audioManager.playAbilityUse();
        return;
      }

      if (character.id === "pixel-goat") {
        const cloneA = Object.assign({}, primaryBall, {
          speedX: primaryBall.speedX * 0.88 + 170,
          speedY: primaryBall.speedY * 0.95,
          x: primaryBall.x - 10,
          scoreScale: 0.82,
        });

        const cloneB = Object.assign({}, primaryBall, {
          speedX: primaryBall.speedX * 0.88 - 170,
          speedY: primaryBall.speedY * 0.95,
          x: primaryBall.x + 10,
          scoreScale: 0.82,
        });

        this.activeBalls.push(cloneA, cloneB);
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 24, 200);
        this.pushToast(character.abilityName + " split the next shot into a wider spread.");
        this.audioManager.playAbilityUse();
        return;
      }

      if (character.id === "prism-raven") {
        primaryBall.prismLinkReady = true;
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 22, 210);
        this.pushToast(character.abilityName + " will beam the first hit into an orange peg.");
        this.audioManager.playAbilityUse();
        return;
      }

      if (character.id === "bore-mole") {
        primaryBall.drillHitsRemaining = 3;
        primaryBall.speedX *= 1.04;
        primaryBall.speedY *= 1.04;
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 24, 220);
        this.pushToast(character.abilityName + " will drill through the next three pegs.");
        this.audioManager.playAbilityUse();
        return;
      }

      if (character.id === "marina-seal") {
        primaryBall.tideReboundReady = true;
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 22, 190);
        this.pushToast(character.abilityName + " will save this shot from the gutter once.");
        this.audioManager.playAbilityUse();
        return;
      }
    }

    resolveShockwave(ball, radius) {
      for (const peg of this.pegs) {
        if (peg.isHit) {
          continue;
        }

        const distance = Math.hypot(ball.x - peg.x, ball.y - peg.y);

        if (distance > radius) {
          continue;
        }

        peg.isHit = true;
        this.handlePegHit(peg, ball);
      }
    }

    resolvePrismLink(ball, sourcePeg) {
      const target = this.findClosestOrangePeg(sourcePeg);

      if (!target) {
        return;
      }

      target.isHit = true;
      target.glow = 1;

      this.spawnPrismLinkBurst(sourcePeg, target);
      this.handlePegHit(target, ball);
      this.pushToast("Prism Link claimed a nearby orange peg.");
    }

    spawnPrismLinkBurst(sourcePeg, targetPeg) {
      const steps = 7;

      for (let index = 0; index <= steps; index += 1) {
        const progress = index / steps;
        const x = sourcePeg.x + (targetPeg.x - sourcePeg.x) * progress;
        const y = sourcePeg.y + (targetPeg.y - sourcePeg.y) * progress;
        const color = index % 2 === 0 ? "#b06cff" : "#76eeff";

        this.spawnBurst(x, y, color, 3, 120);
      }
    }

    spawnBurst(x, y, color, count, speed) {
      for (let index = 0; index < count; index += 1) {
        const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
        const velocity = speed * (0.35 + Math.random() * 0.75);

        this.particles.push(
          createParticle(
            x,
            y,
            color,
            4 + Math.random() * 6,
            Math.cos(angle) * velocity,
            Math.sin(angle) * velocity,
            0.35 + Math.random() * 0.4
          )
        );
      }

      if (this.particles.length > MAX_PARTICLES) {
        this.particles.splice(0, this.particles.length - MAX_PARTICLES);
      }
    }

    updateParticles(deltaTime) {
      for (const particle of this.particles) {
        particle.life -= deltaTime;
        particle.x += particle.speedX * deltaTime;
        particle.y += particle.speedY * deltaTime;
        particle.speedX *= 0.98;
        particle.speedY = particle.speedY * 0.98 + 180 * deltaTime;
      }

      this.particles = this.particles.filter(function keepParticle(particle) {
        return particle.life > 0;
      });
    }

    updateBucket(deltaTime) {
      const minX = this.boardBounds.left + 96;
      const maxX = this.boardBounds.right - 96;

      this.bucket.x += this.bucket.direction * this.bucket.speed * deltaTime;

      if (this.bucket.x < minX) {
        this.bucket.x = minX;
        this.bucket.direction = 1;
      }

      if (this.bucket.x > maxX) {
        this.bucket.x = maxX;
        this.bucket.direction = -1;
      }
    }

    advanceTurn() {
      if (this.scene !== "playing") {
        return;
      }

      const currentPlayer = this.players[this.activePlayerIndex];

      if (currentPlayer) {
        currentPlayer.abilityUsedThisShot = false;
      }

      const nextIndex = this.findNextPlayerIndex();

      if (nextIndex === -1) {
        this.finishRound("Out of balls");
        return;
      }

      this.activePlayerIndex = nextIndex;
      this.turnState = "aiming";
      this.turnAim = -Math.PI / 2;
      this.pushToast(this.players[this.activePlayerIndex].name + " is up. Make it bounce.");
    }

    findNextPlayerIndex() {
      for (let offset = 1; offset <= this.players.length; offset += 1) {
        const candidateIndex = (this.activePlayerIndex + offset) % this.players.length;
        const candidate = this.players[candidateIndex];

        if (candidate.ballsRemaining > 0) {
          return candidateIndex;
        }
      }

      return -1;
    }

    checkRoundEnd() {
      if (this.scene !== "playing") {
        return;
      }

      if (this.finalShotActive) {
        return;
      }

      if (this.lastOrangeCelebrationActive) {
        this.finishLastOrangeCelebrationIfReady();
        return;
      }

      if (this.orangeRemaining <= 0) {
        this.finishRound("Cleared the last orange peg");
        return;
      }

      if (!this.hasReserveBalls() && this.activeBalls.length === 0 && this.turnState !== "switching") {
        this.finishRound("Both players ran out of balls");
      }
    }

    finishLastOrangeCelebrationIfReady() {
      if (this.activeBalls.length > 0) {
        return;
      }

      this.finishRound("Cleared the last orange peg");
    }

    finishRound(reason) {
      this.scene = "round-over";
      this.turnState = "complete";
      this.roundReason = reason;
      this.activeBalls = [];
      this.finalShotActive = false;
      this.lastOrangeCelebrationActive = false;
      this.lastOrangeBall = null;
      this.audioManager.stopGameMusic();

      let bestScore = -Infinity;
      let winnerIndex = 0;

      for (const player of this.players) {
        if (player.score > bestScore) {
          bestScore = player.score;
          winnerIndex = player.index;
        }
      }

      this.winnerIndex = winnerIndex;
      this.finalShotWin = this.finalBucketBonus > 0;

      if (this.finalShotWin) {
        const bucketOwner = this.players[this.finalBucketOwnerIndex];
        const bucketOwnerName = bucketOwner ? bucketOwner.name : "The final shot";

        this.audioManager.playFinalShotWin();
        this.pushToast(bucketOwnerName + " banked the " + this.finalBucketLabel + " final bucket.");
        return;
      }

      this.audioManager.playRoundWin();
      this.pushToast(this.players[winnerIndex].name + " takes the round.");
    }

    getUiState() {
      return {
        scene: this.scene,
        players: this.players,
        activePlayerIndex: this.activePlayerIndex,
        orangeTotal: this.orangeTotal,
        orangeClaimed: this.getOrangeClaimed(),
        orangeRemaining: this.orangeRemaining,
        scoreMultiplier: this.getScoreMultiplier(),
        scoreMultiplierSteps: SCORE_MULTIPLIER_STEPS,
        nextScoreMultiplier: this.getNextScoreMultiplierStep(),
        orangeNeededForNextMultiplier: this.getOrangeNeededForNextMultiplier(),
        turnState: this.turnState,
        roundReason: this.roundReason,
        winnerIndex: this.winnerIndex,
        finalShotWin: this.finalShotWin,
        finalShotActive: this.finalShotActive,
        finalBucketBonus: this.finalBucketBonus,
        finalBucketLabel: this.finalBucketLabel,
        finalBucketOwnerIndex: this.finalBucketOwnerIndex,
        toasts: this.toasts,
      };
    }

    render() {
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);

      this.renderBackground(context);
      context.save();

      if (this.cameraShake > 0) {
        const shakeAmount = this.cameraShake * 8;
        context.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
      }

      this.applyGameplayRenderScale(context);
      this.renderBoardFrame(context);
      this.renderLauncher(context);
      this.renderAbilityReadyIndicator(context);
      this.renderTrajectory(context);
      this.renderPegs(context);
      this.renderBucket(context);
      this.renderBalls(context);
      this.renderParticles(context);
      context.restore();

      if (this.screenFlash > 0) {
        context.fillStyle = "rgba(255, 255, 255, " + this.screenFlash * 0.12 + ")";
        context.fillRect(0, 0, this.width, this.height);
      }
    }

    applyGameplayRenderScale(context) {
      const cameraProgress = this.lastOrangeCameraProgress;
      const focusX = this.lastOrangeFocusX;
      const focusY = this.lastOrangeFocusY;
      const anchorX = this.boardBounds.centerX;
      const anchorY = GAMEPLAY_RENDER_ORIGIN_Y + (this.height * 0.54 - GAMEPLAY_RENDER_ORIGIN_Y) * cameraProgress;
      const zoom = GAMEPLAY_RENDER_SCALE + (LAST_ORANGE_CAMERA_SCALE - GAMEPLAY_RENDER_SCALE) * cameraProgress;
      const cameraFocusX = this.boardBounds.centerX + (focusX - this.boardBounds.centerX) * cameraProgress;
      const cameraFocusY = GAMEPLAY_RENDER_ORIGIN_Y + (focusY - GAMEPLAY_RENDER_ORIGIN_Y) * cameraProgress;

      context.translate(anchorX, anchorY);
      context.scale(zoom, zoom);
      context.translate(-cameraFocusX, -cameraFocusY);
    }

    renderBackground(context) {
      const gradient = context.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#08111f");
      gradient.addColorStop(0.52, "#102645");
      gradient.addColorStop(1, "#1a4b74");

      context.fillStyle = gradient;
      context.fillRect(0, 0, this.width, this.height);

      if (this.canRenderMapBackground()) {
        this.renderMapBackground(context);
      }

      for (const bubble of this.backgroundBubbles) {
        context.fillStyle = bubble.tint;
        context.beginPath();
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = "rgba(255, 255, 255, 0.05)";

      for (let index = 0; index < 70; index += 1) {
        const x = (index * 163) % this.width;
        const y = (index * 271) % this.height;

        context.beginPath();
        context.arc(x, y, 1.8, 0, Math.PI * 2);
        context.fill();
      }
    }

    canRenderMapBackground() {
      return (
        this.mapBackgroundImage &&
        this.mapBackgroundImage.complete &&
        this.mapBackgroundImage.naturalWidth > 0 &&
        this.mapBackgroundImage.naturalHeight > 0
      );
    }

    renderMapBackground(context) {
      const image = this.mapBackgroundImage;
      const canvasRatio = this.width / this.height;
      const imageRatio = image.naturalWidth / image.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;

      if (imageRatio > canvasRatio) {
        sourceWidth = image.naturalHeight * canvasRatio;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      }

      if (imageRatio < canvasRatio) {
        sourceHeight = image.naturalWidth / canvasRatio;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }

      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, this.width, this.height);
      this.renderBackgroundReadabilityOverlay(context);
    }

    renderBackgroundReadabilityOverlay(context) {
      const centerShade = context.createRadialGradient(
        this.boardBounds.centerX,
        this.height * 0.5,
        this.width * 0.08,
        this.boardBounds.centerX,
        this.height * 0.5,
        this.width * 0.48
      );

      centerShade.addColorStop(0, "rgba(4, 9, 20, 0.68)");
      centerShade.addColorStop(0.55, "rgba(4, 9, 20, 0.44)");
      centerShade.addColorStop(1, "rgba(4, 9, 20, 0.18)");

      context.fillStyle = centerShade;
      context.fillRect(0, 0, this.width, this.height);
      context.fillStyle = "rgba(4, 9, 20, 0.2)";
      context.fillRect(0, 0, this.width, this.height);
    }

    renderBoardFrame(context) {
      const board = this.boardBounds;

      context.fillStyle = "rgba(2, 7, 15, 0.22)";
      context.fillRect(0, 0, board.left - 24, this.height);
      context.fillRect(board.right + 24, 0, this.width - board.right - 24, this.height);

      traceRoundedRect(context, board.left - 18, board.top - 18, board.width + 36, board.height + 112, 30);
      context.fillStyle = "rgba(4, 12, 22, 0.18)";
      context.fill();

      traceRoundedRect(context, board.left - 18, board.top - 18, board.width + 36, board.height + 112, 30);
      context.strokeStyle = "rgba(179, 219, 255, 0.16)";
      context.lineWidth = 2;
      context.stroke();

      context.strokeStyle = "rgba(255, 255, 255, 0.05)";
      context.lineWidth = 1;

      for (let index = 1; index <= 4; index += 1) {
        const x = board.left + (board.width / 5) * index;

        context.beginPath();
        context.moveTo(x, board.top + 20);
        context.lineTo(x, board.bottom + 52);
        context.stroke();
      }
    }

    renderLauncher(context) {
      context.save();
      context.translate(this.boardBounds.centerX, 74);
      context.rotate(this.turnAim + Math.PI / 2);

      context.fillStyle = "rgba(255, 255, 255, 0.18)";
      context.fillRect(-18, -12, 36, 74);

      context.fillStyle = "rgba(255, 226, 122, 0.8)";
      context.fillRect(-8, -24, 16, 28);
      context.restore();

      context.fillStyle = "rgba(255, 255, 255, 0.22)";
      context.beginPath();
      context.arc(this.boardBounds.centerX, LAUNCH_Y, 18, 0, Math.PI * 2);
      context.fill();
    }

    createTrajectoryPreviewBall() {
      const launchVector = this.getLaunchVector(BALL_SPEED);
      const ball = {
        x: this.boardBounds.centerX,
        y: LAUNCH_Y,
        radius: BALL_RADIUS,
        speedX: launchVector.x,
        speedY: launchVector.y,
        guaranteedOrangeHoming: false,
        homingDelay: 0,
        homingTimer: 0,
        homingTargetId: null,
        homingMinSpeed: 0,
        homingTurnRate: 0,
      };

      this.configureTrajectoryAbilityPreview(ball);
      return ball;
    }

    configureTrajectoryAbilityPreview(ball) {
      const player = this.getActivePlayer();
      const character = this.getActiveCharacter();

      if (!player || !character) {
        return;
      }

      if (!player.abilityCharged || character.id !== "luna-hare") {
        return;
      }

      ball.guaranteedOrangeHoming = true;
      ball.homingDelay = LUNA_HOMING_DELAY;
      ball.homingMinSpeed = LUNA_HOMING_MIN_SPEED;
      ball.homingTurnRate = LUNA_HOMING_TURN_RATE;
    }

    buildTrajectoryPreview() {
      const ball = this.createTrajectoryPreviewBall();
      const points = [{ x: ball.x, y: ball.y }];
      let elapsed = 0;
      let nextPointAt = 0;

      while (elapsed < TRAJECTORY_PREVIEW_SECONDS) {
        elapsed += TRAJECTORY_PREVIEW_STEP;
        this.updateTrajectoryPreviewBall(ball, TRAJECTORY_PREVIEW_STEP);

        const hitPeg = this.findTrajectoryPegHit(ball);

        if (hitPeg) {
          points.push({ x: ball.x, y: ball.y });
          return {
            points,
            hitPeg,
            hitX: ball.x,
            hitY: ball.y,
          };
        }

        if (ball.y - ball.radius > this.height + 80) {
          break;
        }

        if (elapsed >= nextPointAt) {
          points.push({ x: ball.x, y: ball.y });
          nextPointAt += TRAJECTORY_PREVIEW_POINT_INTERVAL;
        }
      }

      return {
        points,
        hitPeg: null,
        hitX: null,
        hitY: null,
      };
    }

    updateTrajectoryPreviewBall(ball, deltaTime) {
      this.updateHoming(ball, deltaTime);

      ball.speedY += GRAVITY * deltaTime;
      ball.x += ball.speedX * deltaTime;
      ball.y += ball.speedY * deltaTime;

      this.handleWallBounce(ball);
      this.handleGuaranteedHomingFloorBounce(ball);
    }

    findTrajectoryPegHit(ball) {
      let hitPeg = null;
      let bestDistance = Infinity;

      for (const peg of this.pegs) {
        if (peg.isHit) {
          continue;
        }

        const distance = Math.hypot(ball.x - peg.x, ball.y - peg.y);
        const hitRadius = this.getTrajectoryPegHitRadius(ball, peg);

        if (distance > hitRadius) {
          continue;
        }

        if (distance >= bestDistance) {
          continue;
        }

        hitPeg = peg;
        bestDistance = distance;
      }

      return hitPeg;
    }

    getTrajectoryPegHitRadius(ball, peg) {
      const normalRadius = ball.radius + peg.radius;

      if (!ball.guaranteedOrangeHoming || ball.homingDelay > 0) {
        return normalRadius;
      }

      if (peg.id !== ball.homingTargetId) {
        return normalRadius;
      }

      return normalRadius + LUNA_HOMING_CAPTURE_PADDING;
    }

    renderTrajectory(context) {
      if (this.scene !== "playing" || this.turnState !== "aiming") {
        return;
      }

      const preview = this.buildTrajectoryPreview();

      context.save();
      this.renderTrajectoryPath(context, preview.points);
      this.renderTrajectoryDots(context, preview.points);
      this.renderTrajectoryHit(context, preview);
      context.restore();
    }

    renderTrajectoryPath(context, points) {
      if (points.length < 2) {
        return;
      }

      context.strokeStyle = "rgba(255, 255, 255, 0.16)";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);

      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y);
      }

      context.stroke();
    }

    renderTrajectoryDots(context, points) {
      context.fillStyle = "rgba(255, 255, 255, 0.48)";

      for (let index = 1; index < points.length; index += 1) {
        const point = points[index];

        context.beginPath();
        context.arc(point.x, point.y, Math.max(1.6, 5 - index * 0.14), 0, Math.PI * 2);
        context.fill();
      }
    }

    renderTrajectoryHit(context, preview) {
      if (!preview.hitPeg) {
        return;
      }

      context.strokeStyle = "rgba(255, 226, 122, 0.92)";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(preview.hitPeg.x, preview.hitPeg.y, preview.hitPeg.radius + 16, 0, Math.PI * 2);
      context.stroke();

      context.fillStyle = "rgba(255, 226, 122, 0.86)";
      context.beginPath();
      context.arc(preview.hitX, preview.hitY, 5, 0, Math.PI * 2);
      context.fill();
    }

    renderAbilityReadyIndicator(context) {
      if (this.scene !== "playing") {
        return;
      }

      if (!this.isActiveAbilityReady()) {
        return;
      }

      const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.5;
      const outerRadius = 26 + pulse * 7;
      const innerRadius = 18 + pulse * 3;

      context.strokeStyle = "rgba(125, 242, 197, " + (0.4 + pulse * 0.25) + ")";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(this.boardBounds.centerX, LAUNCH_Y, outerRadius, 0, Math.PI * 2);
      context.stroke();

      context.strokeStyle = "rgba(255, 226, 122, " + (0.45 + pulse * 0.2) + ")";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(this.boardBounds.centerX, LAUNCH_Y, innerRadius, 0, Math.PI * 2);
      context.stroke();
    }

    renderPegs(context) {
      for (const peg of this.pegs) {
        if (peg.isHit) {
          continue;
        }

        let fillStyle = "#69d1ff";
        let glow = "rgba(105, 209, 255, 0.35)";

        if (peg.type === "orange") {
          fillStyle = "#ff8f5a";
          glow = "rgba(255, 143, 90, 0.42)";
        }

        if (peg.type === "green") {
          fillStyle = "#7df2c5";
          glow = "rgba(125, 242, 197, 0.42)";
        }

        context.fillStyle = glow;
        context.beginPath();
        context.arc(peg.x, peg.y, peg.radius + 8, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = fillStyle;
        context.beginPath();
        context.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(255, 255, 255, 0.44)";
        context.beginPath();
        context.arc(peg.x - peg.radius * 0.5, peg.y - peg.radius * 0.58, peg.radius * 0.35, 0, Math.PI * 2);
        context.fill();
      }
    }

    renderBucket(context) {
      if (this.finalShotActive) {
        this.renderFinalBuckets(context);
        return;
      }

      const left = this.bucket.x - this.bucket.width / 2;
      const top = this.bucket.y - this.bucket.height;

      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      context.fillRect(this.boardBounds.left + 24, top - 8, this.boardBounds.width - 48, this.bucket.height + 10);

      context.fillStyle = "rgba(255, 255, 255, 0.18)";
      context.fillRect(left, top, this.bucket.width, this.bucket.height);

      context.fillStyle = "rgba(125, 242, 197, 0.34)";
      context.fillRect(left + 18, top + 4, this.bucket.width - 36, this.bucket.height - 8);
    }

    renderFinalBuckets(context) {
      const buckets = this.getFinalBuckets();
      const laneLeft = this.boardBounds.left + 12;
      const laneWidth = this.boardBounds.width - 24;
      const laneTop = buckets[0].top - 10;

      context.fillStyle = "rgba(255, 226, 122, 0.09)";
      context.fillRect(laneLeft, laneTop, laneWidth, buckets[0].height + 18);

      context.font = "700 24px Trebuchet MS, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (const bucket of buckets) {
        const isMiddleBucket = bucket.index === 2;

        traceRoundedRect(context, bucket.left, bucket.top, bucket.width, bucket.height, 14);
        context.fillStyle = isMiddleBucket ? "rgba(255, 226, 122, 0.38)" : "rgba(255, 255, 255, 0.2)";
        context.fill();

        traceRoundedRect(context, bucket.left + 8, bucket.top + 7, bucket.width - 16, bucket.height - 14, 10);
        context.fillStyle = isMiddleBucket ? "rgba(255, 143, 90, 0.34)" : "rgba(125, 242, 197, 0.24)";
        context.fill();

        context.fillStyle = "#f6fbff";
        context.fillText("+" + bucket.label, bucket.left + bucket.width / 2, bucket.top + bucket.height / 2);
      }

      context.textAlign = "start";
      context.textBaseline = "alphabetic";
    }

    renderBalls(context) {
      for (const ball of this.activeBalls) {
        context.fillStyle = ball.trailColor;

        for (let trailIndex = 1; trailIndex <= 5; trailIndex += 1) {
          const trailX = ball.x - ball.speedX * 0.01 * trailIndex;
          const trailY = ball.y - ball.speedY * 0.01 * trailIndex;
          const radius = ball.radius - trailIndex * 1.4;

          context.globalAlpha = 0.15;
          context.beginPath();
          context.arc(trailX, trailY, Math.max(1.5, radius), 0, Math.PI * 2);
          context.fill();
        }

        context.globalAlpha = 1;
        context.fillStyle = ball.color;
        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(255, 255, 255, 0.58)";
        context.beginPath();
        context.arc(ball.x - 3, ball.y - 4, ball.radius * 0.35, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    }

    renderParticles(context) {
      for (const particle of this.particles) {
        context.globalAlpha = particle.life / particle.maxLife;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
    }
  }

  window.GeppleGame = GeppleGame;
})();
