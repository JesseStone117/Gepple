(function () {
  const GAME_WIDTH = 1600;
  const GAME_HEIGHT = 900;
  const BALL_RADIUS = 12;
  const BALL_SPEED = 860;
  const GRAVITY = 690;
  const MAX_PARTICLES = 220;
  const TURN_DELAY = 0.9;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
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

      this.scene = "menu";
      this.turnState = "idle";
      this.players = [];
      this.activePlayerIndex = 0;
      this.activeBalls = [];
      this.pegs = [];
      this.orangeRemaining = 0;
      this.turnAim = -Math.PI / 2;
      this.turnDelay = 0;
      this.seed = 0;
      this.roundReason = "";
      this.winnerIndex = 0;

      this.bucket = {
        x: 240,
        y: this.height - 54,
        width: 180,
        height: 28,
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

    startRound(playerConfigs) {
      this.scene = "playing";
      this.turnState = "aiming";
      this.turnAim = -Math.PI / 2;
      this.turnDelay = 0;
      this.seed = Date.now();
      this.roundReason = "";
      this.winnerIndex = 0;

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
      this.pushToast("Fresh board loaded. Orange pegs decide the pace.");
    }

    returnToMenu() {
      this.scene = "menu";
      this.turnState = "idle";
      this.activeBalls = [];
      this.particles = [];
      this.toasts = [];
    }

    generateNewMap() {
      const map = window.GeppleMap.generateMap(this.width, this.height, this.seed);

      this.pegs = map.pegs;
      this.orangeRemaining = map.orangeCount;
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

      if (this.scene !== "playing") {
        this.render();
        return;
      }

      const step = 1 / 120;
      let remaining = Math.min(deltaTime, 1 / 24);

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

    updatePlayingStep(deltaTime, playerInputs) {
      this.screenFlash = Math.max(0, this.screenFlash - deltaTime * 2.3);
      this.cameraShake = Math.max(0, this.cameraShake - deltaTime * 2.6);
      this.updateBucket(deltaTime);
      this.updateParticles(deltaTime);

      if (this.turnState === "aiming") {
        this.updateAim(deltaTime, playerInputs[this.activePlayerIndex]);
      }

      if (this.turnState === "in-flight") {
        this.updateBalls(deltaTime, playerInputs[this.activePlayerIndex]);
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

      this.turnAim += input.aimX * deltaTime * 2.4;
      this.turnAim = clamp(this.turnAim, -Math.PI + 0.32, -0.14);

      if (!input.launchPressed) {
        return;
      }

      const activePlayer = this.getActivePlayer();

      if (!activePlayer || activePlayer.ballsRemaining <= 0) {
        return;
      }

      activePlayer.ballsRemaining -= 1;
      activePlayer.currentShotHits = 0;
      activePlayer.abilityCharged = false;
      activePlayer.abilityUsedThisShot = false;

      const character = window.GeppleCharacterLookup[activePlayer.characterId];
      const launchX = this.width / 2;
      const launchY = 102;
      const speedX = Math.cos(this.turnAim) * BALL_SPEED;
      const speedY = Math.sin(this.turnAim) * BALL_SPEED;

      this.activeBalls.push({
        x: launchX,
        y: launchY,
        radius: BALL_RADIUS,
        speedX,
        speedY,
        ownerIndex: activePlayer.index,
        trailColor: character.trailColor,
        color: character.ballColor,
        homingTimer: 0,
        scoreScale: 1,
      });

      this.turnState = "in-flight";
      this.audioManager.playLaunch();
      this.pushToast(activePlayer.name + " launched " + character.name + "'s shot.");
    }

    updateBalls(deltaTime, activeInput) {
      if (activeInput && activeInput.abilityPressed) {
        this.useAbility();
      }

      for (let index = this.activeBalls.length - 1; index >= 0; index -= 1) {
        const ball = this.activeBalls[index];

        this.updateSingleBall(ball, deltaTime);

        if (ball.isRemoved || ball.y - ball.radius > this.height + 80) {
          this.activeBalls.splice(index, 1);
        }
      }

      if (this.activeBalls.length === 0 && this.turnState === "in-flight") {
        this.turnState = "switching";
        this.turnDelay = TURN_DELAY;
      }
    }

    updateSingleBall(ball, deltaTime) {
      if (ball.homingTimer > 0) {
        this.applyHoming(ball, deltaTime);
        ball.homingTimer -= deltaTime;
      }

      ball.speedY += GRAVITY * deltaTime;
      ball.x += ball.speedX * deltaTime;
      ball.y += ball.speedY * deltaTime;

      this.handleWallBounce(ball);
      this.handleBucketCatch(ball);
      this.handlePegCollisions(ball);
    }

    applyHoming(ball, deltaTime) {
      let target = null;
      let bestDistance = Infinity;

      for (const peg of this.pegs) {
        if (peg.isHit || peg.type !== "orange") {
          continue;
        }

        const dx = peg.x - ball.x;
        const dy = peg.y - ball.y;
        const distance = Math.hypot(dx, dy);

        if (distance < bestDistance) {
          bestDistance = distance;
          target = peg;
        }
      }

      if (!target) {
        return;
      }

      const desiredAngle = Math.atan2(target.y - ball.y, target.x - ball.x);
      const currentAngle = Math.atan2(ball.speedY, ball.speedX);
      const nextAngle = lerp(currentAngle, desiredAngle, deltaTime * 2.6);
      const speed = Math.max(420, Math.hypot(ball.speedX, ball.speedY));

      ball.speedX = Math.cos(nextAngle) * speed;
      ball.speedY = Math.sin(nextAngle) * speed;
    }

    handleWallBounce(ball) {
      if (ball.x - ball.radius < 20) {
        ball.x = 20 + ball.radius;
        ball.speedX = Math.abs(ball.speedX) * 0.98;
      }

      if (ball.x + ball.radius > this.width - 20) {
        ball.x = this.width - 20 - ball.radius;
        ball.speedX = -Math.abs(ball.speedX) * 0.98;
      }

      if (ball.y - ball.radius < 40) {
        ball.y = 40 + ball.radius;
        ball.speedY = Math.abs(ball.speedY) * 0.96;
      }
    }

    handleBucketCatch(ball) {
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

      player.ballsRemaining += 1;
      ball.isRemoved = true;
      this.audioManager.playBucketCatch();
      this.spawnBurst(ball.x, bucketTop, "#7df2c5", 16, 160);
      this.pushToast(player.name + " landed the moving bucket and earned one more ball.");
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

    handlePegHit(peg, ball) {
      const player = this.players[ball.ownerIndex];

      if (!player) {
        return;
      }

      let points = 100;
      let particleColor = "#69d1ff";

      if (peg.type === "orange") {
        points = 500;
        this.orangeRemaining -= 1;
        player.orangeHits += 1;
        particleColor = "#ff8f5a";
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
      player.score += Math.round(points * comboBonus * ball.scoreScale);

      this.audioManager.playPegHit(peg.type);
      this.screenFlash = Math.min(1, this.screenFlash + 0.1);
      this.cameraShake = Math.min(1, this.cameraShake + 0.12);
      this.spawnBurst(peg.x, peg.y, particleColor, peg.type === "orange" ? 18 : 12, 190);
    }

    useAbility() {
      const player = this.getActivePlayer();

      if (!player || !player.abilityCharged || player.abilityUsedThisShot || this.activeBalls.length === 0) {
        return;
      }

      const character = window.GeppleCharacterLookup[player.characterId];
      const primaryBall = this.activeBalls[0];

      player.abilityUsedThisShot = true;
      player.abilityCharged = false;

      if (character.id === "luna-hare") {
        for (const ball of this.activeBalls) {
          ball.homingTimer = 1.9;
        }

        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 20, 180);
        this.pushToast(character.abilityName + " is bending the shot into the orange cluster.");
      }

      if (character.id === "tempo-fox") {
        this.resolveShockwave(primaryBall, 116);
        primaryBall.speedY = Math.min(primaryBall.speedY, -340);
        this.spawnBurst(primaryBall.x, primaryBall.y, character.accent, 22, 220);
        this.pushToast(character.abilityName + " rattled the nearby pegs.");
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
        this.pushToast(character.abilityName + " split the shot into a wider spread.");
      }

      this.audioManager.playAbilityUse();
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
      this.bucket.x += this.bucket.direction * this.bucket.speed * deltaTime;

      if (this.bucket.x < 170) {
        this.bucket.x = 170;
        this.bucket.direction = 1;
      }

      if (this.bucket.x > this.width - 170) {
        this.bucket.x = this.width - 170;
        this.bucket.direction = -1;
      }
    }

    advanceTurn() {
      if (this.scene !== "playing") {
        return;
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

      if (this.orangeRemaining <= 0) {
        this.finishRound("Cleared the last orange peg");
        return;
      }

      const hasBallsLeft = this.players.some(function checkBalls(player) {
        return player.ballsRemaining > 0;
      });

      if (!hasBallsLeft && this.activeBalls.length === 0 && this.turnState !== "switching") {
        this.finishRound("Both players ran out of balls");
      }
    }

    finishRound(reason) {
      this.scene = "round-over";
      this.turnState = "complete";
      this.roundReason = reason;
      this.activeBalls = [];

      let bestScore = -Infinity;
      let winnerIndex = 0;

      for (const player of this.players) {
        if (player.score > bestScore) {
          bestScore = player.score;
          winnerIndex = player.index;
        }
      }

      this.winnerIndex = winnerIndex;
      this.audioManager.playRoundWin();
      this.pushToast(this.players[winnerIndex].name + " takes the round.");
    }

    getUiState() {
      return {
        scene: this.scene,
        players: this.players,
        activePlayerIndex: this.activePlayerIndex,
        orangeRemaining: this.orangeRemaining,
        turnState: this.turnState,
        roundReason: this.roundReason,
        winnerIndex: this.winnerIndex,
        toasts: this.toasts,
      };
    }

    render() {
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      context.save();

      if (this.cameraShake > 0) {
        const shakeAmount = this.cameraShake * 8;
        context.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
      }

      this.renderBackground(context);
      this.renderLauncher(context);
      this.renderTrajectory(context);
      this.renderPegs(context);
      this.renderBucket(context);
      this.renderBalls(context);
      this.renderParticles(context);

      if (this.screenFlash > 0) {
        context.fillStyle = "rgba(255, 255, 255, " + this.screenFlash * 0.12 + ")";
        context.fillRect(0, 0, this.width, this.height);
      }

      context.restore();
    }

    renderBackground(context) {
      const gradient = context.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#08111f");
      gradient.addColorStop(0.52, "#102645");
      gradient.addColorStop(1, "#1a4b74");

      context.fillStyle = gradient;
      context.fillRect(0, 0, this.width, this.height);

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

    renderLauncher(context) {
      const launcherX = this.width / 2;
      const launcherY = 80;

      context.save();
      context.translate(launcherX, launcherY);
      context.rotate(this.turnAim + Math.PI / 2);

      context.fillStyle = "rgba(255, 255, 255, 0.18)";
      context.fillRect(-18, -12, 36, 74);

      context.fillStyle = "rgba(255, 226, 122, 0.8)";
      context.fillRect(-8, -24, 16, 28);
      context.restore();
    }

    renderTrajectory(context) {
      if (this.scene !== "playing" || this.turnState !== "aiming") {
        return;
      }

      let x = this.width / 2;
      let y = 102;
      let speedX = Math.cos(this.turnAim) * 18;
      let speedY = Math.sin(this.turnAim) * 18;

      context.fillStyle = "rgba(255, 255, 255, 0.48)";

      for (let index = 0; index < 28; index += 1) {
        x += speedX;
        y += speedY;
        speedY += 0.32;

        if (x < 20 || x > this.width - 20) {
          speedX *= -1;
        }

        context.beginPath();
        context.arc(x, y, Math.max(1.6, 5 - index * 0.14), 0, Math.PI * 2);
        context.fill();
      }
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
        context.arc(peg.x, peg.y, peg.radius + 10, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = fillStyle;
        context.beginPath();
        context.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(255, 255, 255, 0.44)";
        context.beginPath();
        context.arc(peg.x - 4, peg.y - 5, peg.radius * 0.35, 0, Math.PI * 2);
        context.fill();
      }
    }

    renderBucket(context) {
      const left = this.bucket.x - this.bucket.width / 2;
      const top = this.bucket.y - this.bucket.height;

      context.fillStyle = "rgba(255, 255, 255, 0.18)";
      context.fillRect(left, top, this.bucket.width, this.bucket.height);
      context.fillStyle = "rgba(125, 242, 197, 0.34)";
      context.fillRect(left + 18, top + 4, this.bucket.width - 36, this.bucket.height - 8);
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
