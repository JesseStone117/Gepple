(function () {
  const STAGE_WIDTH = 1600;
  const STAGE_HEIGHT = 900;
  const characters = window.GeppleCharacters;
  const mapOptions = window.GeppleMap.getMapOptions();

  const dom = {
    stageWrap: document.getElementById("stage-wrap"),
    gameStage: document.getElementById("game-stage"),
    menuScreen: document.getElementById("menu-screen"),
    menuShellWrap: document.getElementById("menu-shell-wrap"),
    menuShell: document.getElementById("menu-shell"),
    hudScreen: document.getElementById("hud-screen"),
    roundOverScreen: document.getElementById("round-over-screen"),
    systemMenuScreen: document.getElementById("system-menu-screen"),
    controllerStatus: document.getElementById("controller-status"),
    startGameButton: document.getElementById("start-game-button"),
    swapControllersButton: document.getElementById("swap-controllers-button"),
    playAgainButton: document.getElementById("play-again-button"),
    backToMenuButton: document.getElementById("back-to-menu-button"),
    systemResumeButton: document.getElementById("system-resume-button"),
    systemMainMenuButton: document.getElementById("system-main-menu-button"),
    systemExitFullscreenButton: document.getElementById("system-exit-fullscreen-button"),
    systemExitGameButton: document.getElementById("system-exit-game-button"),
    systemMenuHeading: document.getElementById("system-menu-heading"),
    systemMenuCopy: document.getElementById("system-menu-copy"),
    turnBanner: document.querySelector(".turn-banner"),
    turnIndicator: document.getElementById("turn-indicator"),
    roundSubtitle: document.getElementById("round-subtitle"),
    orangeProgressCount: document.getElementById("orange-progress-count"),
    scoreMultiplier: document.getElementById("score-multiplier"),
    orangeProgressTrack: document.getElementById("orange-progress-track"),
    orangeProgressFill: document.getElementById("orange-progress-fill"),
    orangeProgressMarkers: document.getElementById("orange-progress-markers"),
    orangeProgressDetail: document.getElementById("orange-progress-detail"),
    orangeProgressCard: document.querySelector(".orange-progress-card"),
    hudPlayers: [document.getElementById("hud-player-0"), document.getElementById("hud-player-1")],
    portraitTargets: [document.getElementById("portrait-0"), document.getElementById("portrait-1")],
    characterNames: [document.getElementById("character-name-0"), document.getElementById("character-name-1")],
    characterTitles: [document.getElementById("character-title-0"), document.getElementById("character-title-1")],
    abilityLines: [document.getElementById("ability-line-0"), document.getElementById("ability-line-1")],
    assignmentPills: [document.getElementById("assignment-pill-0"), document.getElementById("assignment-pill-1")],
    mapButtons: Array.from(document.querySelectorAll('[data-action="map-select"]')),
    resultPanel: document.getElementById("result-panel"),
    winnerHeading: document.getElementById("winner-heading"),
    winnerSummary: document.getElementById("winner-summary"),
    winnerPortrait: document.getElementById("winner-portrait"),
    winnerBadge: document.getElementById("winner-badge"),
    winnerFlair: document.getElementById("winner-flair"),
    resultReason: document.getElementById("result-reason"),
    scoreboard: document.getElementById("scoreboard"),
    toastStack: document.getElementById("toast-stack"),
  };

  const canvas = document.getElementById("game-canvas");
  const audioManager = new window.GeppleAudioManager();
  const controllerManager = new window.GeppleControllerManager();
  const game = new window.GeppleGame(canvas, audioManager);
  window.GeppleGameInstance = game;

  let selectedCharacterIndices = [0, 1];
  let selectedMapId = "random";
  let lastFrameTime = performance.now();
  let lastScene = "";
  let isSystemMenuOpen = false;
  let ignoreGameplayInputOnce = false;
  let menuLayoutFrame = 0;
  let focusRetryFrame = 0;
  let focusRetryTimeout = 0;

  function getAssetPath(path) {
    if (window.GeppleAssetPath) {
      return window.GeppleAssetPath(path);
    }

    return path;
  }

  function getViewportSize() {
    if (window.visualViewport) {
      return {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function fitMenuShell() {
    if (!dom.menuShell || !dom.menuShellWrap) {
      return;
    }

    dom.menuShell.style.transform = "scale(1)";

    const availableWidth = dom.menuShellWrap.clientWidth;
    const availableHeight = dom.menuShellWrap.clientHeight;

    if (!availableWidth || !availableHeight) {
      return;
    }

    const naturalWidth = dom.menuShell.scrollWidth;
    const naturalHeight = dom.menuShell.scrollHeight;
    const widthScale = availableWidth / Math.max(1, naturalWidth);
    const heightScale = availableHeight / Math.max(1, naturalHeight);
    const scale = Math.min(1, widthScale, heightScale);

    dom.menuShell.style.transform = "scale(" + scale + ")";
  }

  function scheduleMenuLayoutFit() {
    if (menuLayoutFrame) {
      cancelAnimationFrame(menuLayoutFrame);
    }

    menuLayoutFrame = requestAnimationFrame(function runMenuFit() {
      menuLayoutFrame = 0;
      fitMenuShell();
    });
  }

  function isFullscreenSupported() {
    return Boolean(
      document.fullscreenEnabled ||
      document.documentElement.requestFullscreen ||
      document.exitFullscreen
    );
  }

  function isFullscreenActive() {
    return Boolean(document.fullscreenElement);
  }

  function resizeStage() {
    const viewport = getViewportSize();
    const safeMargin = 12;
    const safeWidth = Math.max(320, viewport.width - safeMargin * 2);
    const safeHeight = Math.max(240, viewport.height - safeMargin * 2);
    const scale = Math.max(0.1, Math.min(safeWidth / STAGE_WIDTH, safeHeight / STAGE_HEIGHT));

    dom.stageWrap.style.width = STAGE_WIDTH * scale + "px";
    dom.stageWrap.style.height = STAGE_HEIGHT * scale + "px";
    dom.gameStage.style.transform = "scale(" + scale + ")";
    scheduleMenuLayoutFit();
  }

  function cycleCharacter(playerIndex, direction) {
    const currentIndex = selectedCharacterIndices[playerIndex];
    const nextIndex = (currentIndex + direction + characters.length) % characters.length;

    selectedCharacterIndices[playerIndex] = nextIndex;
    renderMenu();
  }

  function setSelectedMap(mapId) {
    const mapExists = mapOptions.some(function hasMap(option) {
      return option.id === mapId;
    });

    if (!mapExists) {
      return;
    }

    selectedMapId = mapId;
    renderMenu();
  }

  function swapControllers() {
    controllerManager.swapAssignments();
    renderMenu();
  }

  function buildPlayerConfigs() {
    return [0, 1].map(function mapPlayer(playerIndex) {
      const character = characters[selectedCharacterIndices[playerIndex]];

      return {
        name: "Player " + (playerIndex + 1),
        characterId: character.id,
        controllerLabel: controllerManager.getAssignmentLabel(playerIndex),
      };
    });
  }

  function startRound() {
    audioManager.unlock();
    audioManager.playGameMusic();
    ignoreGameplayInputOnce = true;
    game.startRound(buildPlayerConfigs(), {
      mapId: selectedMapId,
    });
    syncScreens();
  }

  function backToMenu() {
    game.returnToMenu();
    syncScreens();
    focusFirstMenuButton();
  }

  function exitToMainMenu() {
    isSystemMenuOpen = false;
    backToMenu();
  }

  function cancelPendingFocusWork() {
    if (focusRetryFrame) {
      cancelAnimationFrame(focusRetryFrame);
      focusRetryFrame = 0;
    }

    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout);
      focusRetryTimeout = 0;
    }
  }

  function focusElementNow(element) {
    if (!element || element.disabled) {
      return false;
    }

    element.focus({ preventScroll: true });
    return document.activeElement === element;
  }

  function scheduleStableFocus(getTarget, attemptsLeft) {
    const target = getTarget();

    if (!target) {
      return;
    }

    if (focusElementNow(target) || attemptsLeft <= 0) {
      return;
    }

    focusRetryFrame = requestAnimationFrame(function retryFocusOnNextFrame() {
      focusRetryFrame = 0;
      scheduleStableFocus(getTarget, attemptsLeft - 1);
    });
  }

  function queueStableFocus(getTarget) {
    cancelPendingFocusWork();
    scheduleStableFocus(getTarget, 3);

    focusRetryTimeout = window.setTimeout(function retryFocusAfterPaint() {
      focusRetryTimeout = 0;
      scheduleStableFocus(getTarget, 2);
    }, 90);
  }

  function getDefaultMenuButton() {
    return (
      document.querySelector('[data-action="map-select"][data-map-id="' + selectedMapId + '"]') || dom.startGameButton
    );
  }

  function getFirstEnabledSystemMenuButton() {
    return dom.systemMenuScreen.querySelector(".menu-button:not(:disabled)");
  }

  function focusFirstMenuButton() {
    queueStableFocus(getDefaultMenuButton);
  }

  function focusRoundOverButton() {
    queueStableFocus(function getPlayAgainButton() {
      return dom.playAgainButton;
    });
  }

  function focusSystemMenuButton() {
    queueStableFocus(getFirstEnabledSystemMenuButton);
  }

  function handleButtonAction(button) {
    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === "map-select") {
      setSelectedMap(button.dataset.mapId);
    }
  }

  function handleMenuInput(menuInput) {
    if (game.scene === "menu") {
      if (menuInput.confirmPressed && document.activeElement && document.activeElement.matches(".menu-button")) {
        document.activeElement.click();
      }

      if (menuInput.navLeftPressed || menuInput.navRightPressed || menuInput.navUpPressed || menuInput.navDownPressed) {
        moveFocus(menuInput);
      }
    }

    if (game.scene === "round-over") {
      if (menuInput.confirmPressed && document.activeElement && document.activeElement.matches(".menu-button")) {
        document.activeElement.click();
      }

      if (menuInput.navLeftPressed || menuInput.navRightPressed || menuInput.navUpPressed || menuInput.navDownPressed) {
        moveFocus(menuInput);
      }
    }
  }

  function getCharacterSelectInput(playerIndex) {
    const assignedPad = controllerManager.getAssignedPad(playerIndex);

    if (assignedPad) {
      return assignedPad;
    }

    if (playerIndex === 0 && controllerManager.connectedPads.length === 0) {
      return controllerManager.getKeyboardState();
    }

    return null;
  }

  function handleCharacterSelectShortcuts() {
    if (game.scene !== "menu") {
      return;
    }

    const playerOneInput = getCharacterSelectInput(0);
    const playerTwoInput = getCharacterSelectInput(1);

    if (playerOneInput && playerOneInput.changeCharacterPressed) {
      cycleCharacter(0, 1);
    }

    if (playerTwoInput && playerTwoInput.changeCharacterPressed) {
      cycleCharacter(1, 1);
    }
  }

  function getVisibleMenuButtons() {
    if (isSystemMenuOpen) {
      return Array.from(document.querySelectorAll("#system-menu-screen:not(.is-hidden) .menu-button:not(:disabled)"));
    }

    let selector = "#menu-screen:not(.is-hidden) .menu-button:not(:disabled)";

    if (game.scene === "round-over") {
      selector = "#round-over-screen:not(.is-hidden) .menu-button:not(:disabled)";
    }

    return Array.from(document.querySelectorAll(selector));
  }

  function getFocusDirection(menuInput) {
    if (menuInput.navLeftPressed) {
      return "left";
    }

    if (menuInput.navRightPressed) {
      return "right";
    }

    if (menuInput.navUpPressed) {
      return "up";
    }

    if (menuInput.navDownPressed) {
      return "down";
    }

    return "";
  }

  function isCandidateInDirection(direction, dx, dy) {
    if (direction === "left") {
      return dx < -8;
    }

    if (direction === "right") {
      return dx > 8;
    }

    if (direction === "up") {
      return dy < -8;
    }

    if (direction === "down") {
      return dy > 8;
    }

    return false;
  }

  function getDirectionalScore(direction, dx, dy, wrapAround) {
    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);

    if (wrapAround) {
      return primary * 2 + secondary;
    }

    return primary + secondary * 0.45;
  }

  function findNextFocusButton(buttons, currentButton, direction) {
    const currentRect = currentButton.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;

    function pickCandidate(wrapAround) {
      let bestButton = null;
      let bestScore = Infinity;

      for (const button of buttons) {
        if (button === currentButton) {
          continue;
        }

        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = centerX - currentCenterX;
        const dy = centerY - currentCenterY;

        if (!wrapAround && !isCandidateInDirection(direction, dx, dy)) {
          continue;
        }

        const score = getDirectionalScore(direction, dx, dy, wrapAround);

        if (score >= bestScore) {
          continue;
        }

        bestScore = score;
        bestButton = button;
      }

      return bestButton;
    }

    return pickCandidate(false) || pickCandidate(true);
  }

  function moveFocus(menuInput) {
    const buttons = getVisibleMenuButtons();
    const direction = getFocusDirection(menuInput);

    if (buttons.length === 0 || !direction) {
      return;
    }

    const currentButton = buttons.includes(document.activeElement) ? document.activeElement : null;

    if (!currentButton) {
      buttons[0].focus({ preventScroll: true });
      return;
    }

    const nextButton = findNextFocusButton(buttons, currentButton, direction);

    if (!nextButton) {
      return;
    }

    nextButton.focus({ preventScroll: true });
  }

  function renderSystemMenu() {
    const isPlaying = game.scene === "playing";
    const canExitToMainMenu = game.scene !== "menu";
    const fullscreenSupported = isFullscreenSupported();
    const fullscreenActive = isFullscreenActive();

    dom.systemMenuHeading.textContent = isPlaying ? "Game Menu" : "System Menu";
    dom.systemMenuCopy.textContent = isPlaying
      ? "The board is paused. Resume, jump back to the main menu, or adjust full screen."
      : "Jump back to the main menu, adjust full screen, or exit Gepple.";
    dom.systemResumeButton.textContent = isPlaying ? "Resume Game" : "Close Menu";
    dom.systemMainMenuButton.disabled = !canExitToMainMenu;
    dom.systemMainMenuButton.textContent = canExitToMainMenu ? "Exit To Main Menu" : "Already On Main Menu";
    dom.systemExitFullscreenButton.disabled = !fullscreenSupported;

    if (!fullscreenSupported) {
      dom.systemExitFullscreenButton.textContent = "Full Screen Unavailable";
      return;
    }

    dom.systemExitFullscreenButton.textContent = fullscreenActive ? "Exit Full Screen" : "Enter Full Screen";
  }

  function openSystemMenu() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    isSystemMenuOpen = true;
    renderSystemMenu();
    syncScreens();
    focusSystemMenuButton();
  }

  function closeSystemMenu() {
    cancelPendingFocusWork();
    isSystemMenuOpen = false;
    syncScreens();

    if (game.scene === "round-over") {
      focusRoundOverButton();
      return;
    }

    if (game.scene === "menu") {
      focusFirstMenuButton();
    }
  }

  function handleSystemMenuInput(menuInput) {
    if (!dom.systemMenuScreen.contains(document.activeElement)) {
      focusSystemMenuButton();
    }

    if (menuInput.backPressed) {
      closeSystemMenu();
      return;
    }

    if (menuInput.confirmPressed && document.activeElement && document.activeElement.matches(".menu-button")) {
      document.activeElement.click();
    }

    if (menuInput.navLeftPressed || menuInput.navRightPressed || menuInput.navUpPressed || menuInput.navDownPressed) {
      moveFocus(menuInput);
    }
  }

  function refreshSystemMenuForFullscreenChange() {
    if (!isSystemMenuOpen) {
      return;
    }

    renderSystemMenu();
    focusSystemMenuButton();
  }

  async function toggleFullscreenMode() {
    if (!isFullscreenSupported()) {
      game.pushToast("Full screen is unavailable here.");
      return;
    }

    try {
      if (isFullscreenActive()) {
        await document.exitFullscreen();
        game.pushToast("Exited full screen.");
      } else {
        await document.documentElement.requestFullscreen();
        game.pushToast("Entered full screen.");
      }

      renderSystemMenu();
    } catch (error) {
      game.pushToast("Full screen could not be changed.");
    }
  }

  async function exitGame() {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (error) {
      }
    }

    try {
      window.close();
    } catch (error) {
    }

    if (window.closed) {
      return;
    }

    try {
      window.open("", "_self");
      window.close();
    } catch (error) {
    }

    if (window.closed) {
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.replace("about:blank");
  }

  function renderControllerStatus() {
    const cards = controllerManager.connectedPads.slice();

    if (cards.length === 0) {
      dom.controllerStatus.innerHTML =
        '<article class="controller-card"><div class="controller-card__title"><span>No controllers yet</span><span>Xbox pads welcome</span></div><p class="controller-card__hint">Connect one or two Xbox pads. Gepple will highlight the Player 1 primary controller here.</p></article>';
      return;
    }

    dom.controllerStatus.innerHTML = cards
      .map(function renderCard(pad) {
        const ownerIndex = controllerManager.assignments.indexOf(pad.index);
        const ownerLabel = ownerIndex === -1 ? "Unassigned" : "Player " + (ownerIndex + 1);
        const primaryClass = ownerIndex === 0 ? " is-primary" : "";
        const primaryText = ownerIndex === 0 ? "Primary controller" : pad.label;

        return (
          '<article class="controller-card' +
          primaryClass +
          '">' +
          '<div class="controller-card__title">' +
          "<span>Controller " +
          (pad.index + 1) +
          "</span>" +
          "<span>" +
          ownerLabel +
          "</span>" +
          "</div>" +
          '<p class="controller-card__hint">' +
          primaryText +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderMenu() {
    renderControllerStatus();

    for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
      const character = characters[selectedCharacterIndices[playerIndex]];

      dom.characterNames[playerIndex].textContent = character.name;
      dom.characterTitles[playerIndex].textContent = character.title;
      dom.abilityLines[playerIndex].textContent = character.abilityName + ": " + character.abilityDescription;
      dom.assignmentPills[playerIndex].textContent = controllerManager.getAssignmentLabel(playerIndex);
      dom.portraitTargets[playerIndex].style.backgroundImage =
        "url('" + getAssetPath(character.portraitPath) + "'), " + character.portraitGradient;
      dom.portraitTargets[playerIndex].style.backgroundColor = character.accentSoft;
    }

    for (const button of dom.mapButtons) {
      const isSelected = button.dataset.mapId === selectedMapId;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }

    scheduleMenuLayoutFit();
  }

  function renderOrangeProgressMarks(uiState, orangeTotal) {
    const claimed = uiState.orangeClaimed;
    const steps = Array.isArray(uiState.scoreMultiplierSteps) ? uiState.scoreMultiplierSteps : [];

    dom.orangeProgressMarkers.innerHTML = steps
      .map(function renderMarker(step) {
        const percent = Math.max(0, Math.min(100, (step.orangeHits / orangeTotal) * 100));
        const reachedClass = step.orangeHits <= claimed ? " is-reached" : "";

        return (
          '<span class="orange-progress-marker' +
          reachedClass +
          '" style="left: ' +
          percent +
          '%;"><span>' +
          step.multiplier +
          "x</span></span>"
        );
      })
      .join("");
  }

  function renderOrangeProgress(uiState) {
    const orangeTotal = Math.max(1, uiState.orangeTotal);
    const claimed = Math.max(0, Math.min(orangeTotal, uiState.orangeClaimed));
    const progressPercent = (claimed / orangeTotal) * 100;
    const nextStep = uiState.nextScoreMultiplier;
    const claimedText = claimed + " of " + orangeTotal + " orange pegs claimed";

    dom.orangeProgressCount.textContent = claimed + " / " + orangeTotal + " orange pegs";
    dom.scoreMultiplier.textContent = uiState.scoreMultiplier + "x score";
    dom.orangeProgressFill.style.width = progressPercent + "%";
    dom.orangeProgressTrack.setAttribute("aria-valuemax", orangeTotal);
    dom.orangeProgressTrack.setAttribute("aria-valuenow", claimed);
    dom.orangeProgressTrack.setAttribute("aria-valuetext", claimedText);
    dom.orangeProgressCount.title = claimedText;
    renderOrangeProgressMarks(uiState, orangeTotal);

    if (!nextStep) {
      dom.orangeProgressDetail.textContent = "Max multiplier locked in.";
      return;
    }

    dom.orangeProgressDetail.textContent =
      uiState.orangeNeededForNextMultiplier +
      " orange " +
      (uiState.orangeNeededForNextMultiplier === 1 ? "peg" : "pegs") +
      " to " +
      nextStep.multiplier +
      "x.";
  }

  function renderHud(uiState) {
    const activePlayer = uiState.players[uiState.activePlayerIndex];

    if (!activePlayer) {
      return;
    }

    const activeAbilityReady = activePlayer.abilityCharged && uiState.turnState === "aiming";

    dom.turnIndicator.textContent = activePlayer.name;
    dom.turnBanner.classList.toggle("is-ability-ready", activeAbilityReady);
    dom.orangeProgressCard.classList.toggle("is-hidden", Boolean(uiState.finalShotActive));
    renderOrangeProgress(uiState);

    if (activeAbilityReady) {
      dom.roundSubtitle.textContent = "Orange pegs left: " + uiState.orangeRemaining + ". Power stores for the next shot.";
    } else if (uiState.turnState === "aiming") {
      dom.roundSubtitle.textContent = "Orange pegs left: " + uiState.orangeRemaining + ". Line up the launch.";
    } else {
      dom.roundSubtitle.textContent = "Orange pegs left: " + uiState.orangeRemaining + ". Cash in the ricochets.";
    }

    for (let playerIndex = 0; playerIndex < uiState.players.length; playerIndex += 1) {
      const player = uiState.players[playerIndex];
      const character = window.GeppleCharacterLookup[player.characterId];
      const isActive = playerIndex === uiState.activePlayerIndex;
      const assignmentLabel = controllerManager.getAssignmentLabel(playerIndex);
      const abilityReady = player.abilityCharged;
      let abilityStatus = "Waiting for green peg";
      let abilityStatusClass = "status-pill status-pill--idle";

      if (abilityReady) {
        abilityStatus = isActive && uiState.turnState === "aiming" ? "Auto on next shot" : "Stored for next shot";
        abilityStatusClass = "status-pill status-pill--ready";
      }

      if (!abilityReady && player.abilityUsedThisShot) {
        abilityStatus = "Spent this shot";
        abilityStatusClass = "status-pill status-pill--spent";
      }

      dom.hudPlayers[playerIndex].classList.toggle("is-active", isActive);
      dom.hudPlayers[playerIndex].classList.toggle("is-ready", abilityReady && isActive && uiState.turnState === "aiming");
      dom.hudPlayers[playerIndex].innerHTML =
        '<div class="hud-topline">' +
        '<span class="hud-label">' +
        player.name +
        "</span>" +
        '<span class="assignment-pill">' +
        assignmentLabel +
        "</span>" +
        "</div>" +
        '<div class="portrait-frame portrait-frame--hud">' +
        '<div class="portrait-art" style="background-image: url(\'' +
        getAssetPath(character.portraitPath) +
        "'), " +
        character.portraitGradient +
        "; background-color: " +
        character.accentSoft +
        ';"></div>' +
        "</div>" +
        "<div>" +
        "<h3>" +
        character.name +
        "</h3>" +
        '<p class="hud-title">' +
        character.title +
        "</p>" +
        "</div>" +
        '<p class="hud-ability-copy"><strong>' +
        character.abilityName +
        "</strong> " +
        character.abilityDescription +
        "</p>" +
        '<div class="stat-line"><span>Score</span><strong>' +
        player.score.toLocaleString() +
        "</strong></div>" +
        '<div class="stat-line"><span>Balls Left</span><strong>' +
        player.ballsRemaining +
        "</strong></div>" +
        '<div class="stat-line"><span>Ability</span><strong class="' +
        abilityStatusClass +
        '">' +
        abilityStatus +
        "</strong></div>" +
        '<div class="stat-line"><span>Status</span><strong>' +
        (isActive ? "Shooting now" : "Waiting turn") +
        "</strong></div>";
    }

    dom.toastStack.innerHTML = uiState.toasts
      .map(function renderToast(toast) {
        return '<article class="toast-card">' + toast.text + "</article>";
      })
      .join("");
  }

  function renderRoundOver(uiState) {
    const winner = uiState.players[uiState.winnerIndex];
    const winnerCharacter = window.GeppleCharacterLookup[winner.characterId];
    const finalShotWin = Boolean(uiState.finalShotWin);
    const finalBucketOwner = uiState.players[uiState.finalBucketOwnerIndex];
    const hasFinalBucketBonus = Boolean(uiState.finalBucketBonus);
    const finalBucketCopy = finalBucketOwner
      ? finalBucketOwner.name + " landed +" + uiState.finalBucketLabel + " in the final bucket."
      : "The final bucket bonus was scored.";

    dom.resultPanel.classList.toggle("is-final-shot", finalShotWin);
    dom.resultReason.textContent = hasFinalBucketBonus ? "Final Bucket Bonus" : uiState.roundReason;
    dom.winnerHeading.textContent = winner.name + " Wins";
    dom.winnerPortrait.style.backgroundImage =
      "url('" + getAssetPath(winnerCharacter.portraitPath) + "'), " + winnerCharacter.portraitGradient;
    dom.winnerPortrait.style.backgroundColor = winnerCharacter.accentSoft;
    dom.winnerBadge.textContent = hasFinalBucketBonus ? "Final Score Leader" : winnerCharacter.abilityName;
    dom.winnerFlair.textContent = hasFinalBucketBonus
      ? finalBucketCopy
      : winnerCharacter.name + " claims the couch crown in style.";
    dom.winnerSummary.textContent = hasFinalBucketBonus
      ? "No reserve balls left. " + winner.name + " wins with " + winner.score.toLocaleString() + "."
      : "Final orange clears: " + winner.orangeHits + ". Final score: " + winner.score.toLocaleString() + ".";

    dom.scoreboard.innerHTML = uiState.players
      .map(function renderRow(player) {
        const character = window.GeppleCharacterLookup[player.characterId];
        const winnerClass = player.index === uiState.winnerIndex ? " is-winner" : "";
        const finalBucketText =
          player.index === uiState.finalBucketOwnerIndex ? " + " + uiState.finalBucketLabel + " final bucket" : "";

        return (
          '<article class="score-row' +
          winnerClass +
          '">' +
          "<div><strong>" +
          player.name +
          "</strong><p>" +
          character.name +
          "</p></div>" +
          "<div><strong>" +
          player.score.toLocaleString() +
          "</strong><p>" +
          player.orangeHits +
          " orange pegs" +
          finalBucketText +
          "</p></div>" +
          "</article>"
        );
      })
      .join("");
  }

  function syncScreens() {
    const uiState = game.getUiState();
    const isMenu = uiState.scene === "menu";
    const isPlaying = uiState.scene === "playing";
    const isRoundOver = uiState.scene === "round-over";
    const sceneChanged = uiState.scene !== lastScene;

    dom.menuScreen.classList.toggle("is-hidden", !isMenu);
    dom.hudScreen.classList.toggle("is-hidden", !isPlaying);
    dom.roundOverScreen.classList.toggle("is-hidden", !isRoundOver);
    dom.systemMenuScreen.classList.toggle("is-hidden", !isSystemMenuOpen);

    if (isRoundOver) {
      renderRoundOver(uiState);

      if (sceneChanged && !isSystemMenuOpen) {
        focusRoundOverButton();
      }
    }

    if (isPlaying) {
      renderHud(uiState);
    }

    if (isMenu) {
      renderMenu();

      if (sceneChanged) {
        focusFirstMenuButton();
      }
    }

    if (isSystemMenuOpen) {
      renderSystemMenu();
    }

    lastScene = uiState.scene;
  }

  function handleConnectionEvents() {
    const events = controllerManager.takeConnectionEvents();

    for (const event of events) {
      audioManager.unlock();
      audioManager.playControllerConnect();

      if (event.type === "connected") {
        game.pushToast("Controller " + (event.index + 1) + " connected.");
      }

      if (event.type === "disconnected") {
        game.pushToast("Controller " + (event.index + 1) + " disconnected.");
      }
    }
  }

  function frame(now) {
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    controllerManager.update(now);
    handleConnectionEvents();
    const playerInputs = [controllerManager.getPlayerInput(0), controllerManager.getPlayerInput(1)];
    const playerOneMenuInput = controllerManager.getMenuInput();
    const startPressed = Boolean(playerOneMenuInput && playerOneMenuInput.startPressed);

    if (startPressed) {
      if (isSystemMenuOpen) {
        closeSystemMenu();
      } else {
        openSystemMenu();
      }
    }

    if (isSystemMenuOpen) {
      handleSystemMenuInput(playerOneMenuInput);
      game.render();
      syncScreens();
      requestAnimationFrame(frame);
      return;
    }

    handleCharacterSelectShortcuts();
    handleMenuInput(playerOneMenuInput);

    if (ignoreGameplayInputOnce && game.scene === "playing") {
      ignoreGameplayInputOnce = false;
      game.update(deltaTime, [null, null]);
      syncScreens();
      requestAnimationFrame(frame);
      return;
    }

    game.update(deltaTime, playerInputs);
    syncScreens();

    requestAnimationFrame(frame);
  }

  document.addEventListener("click", function onClick(event) {
    audioManager.unlock();

    const button = event.target.closest(".menu-button");

    if (!button) {
      return;
    }

    handleButtonAction(button);
  });

  dom.swapControllersButton.addEventListener("click", swapControllers);
  dom.startGameButton.addEventListener("click", startRound);
  dom.playAgainButton.addEventListener("click", startRound);
  dom.backToMenuButton.addEventListener("click", backToMenu);
  dom.systemResumeButton.addEventListener("click", closeSystemMenu);
  dom.systemMainMenuButton.addEventListener("click", exitToMainMenu);
  dom.systemExitFullscreenButton.addEventListener("click", toggleFullscreenMode);
  dom.systemExitGameButton.addEventListener("click", exitGame);

  window.addEventListener("resize", resizeStage);
  document.addEventListener("fullscreenchange", refreshSystemMenuForFullscreenChange);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeStage);
    window.visualViewport.addEventListener("scroll", resizeStage);
  }

  resizeStage();
  renderMenu();
  syncScreens();
  focusFirstMenuButton();
  requestAnimationFrame(frame);
})();
