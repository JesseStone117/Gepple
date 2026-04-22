(function () {
  const STAGE_WIDTH = 1600;
  const STAGE_HEIGHT = 900;
  const characters = window.GeppleCharacters;

  const dom = {
    stageWrap: document.getElementById("stage-wrap"),
    gameStage: document.getElementById("game-stage"),
    menuScreen: document.getElementById("menu-screen"),
    hudScreen: document.getElementById("hud-screen"),
    roundOverScreen: document.getElementById("round-over-screen"),
    systemMenuScreen: document.getElementById("system-menu-screen"),
    controllerStatus: document.getElementById("controller-status"),
    startGameButton: document.getElementById("start-game-button"),
    swapControllersButton: document.getElementById("swap-controllers-button"),
    playAgainButton: document.getElementById("play-again-button"),
    backToMenuButton: document.getElementById("back-to-menu-button"),
    systemResumeButton: document.getElementById("system-resume-button"),
    systemExitFullscreenButton: document.getElementById("system-exit-fullscreen-button"),
    systemExitGameButton: document.getElementById("system-exit-game-button"),
    systemMenuHeading: document.getElementById("system-menu-heading"),
    systemMenuCopy: document.getElementById("system-menu-copy"),
    turnBanner: document.querySelector(".turn-banner"),
    turnIndicator: document.getElementById("turn-indicator"),
    roundSubtitle: document.getElementById("round-subtitle"),
    hudPlayers: [document.getElementById("hud-player-0"), document.getElementById("hud-player-1")],
    portraitTargets: [document.getElementById("portrait-0"), document.getElementById("portrait-1")],
    characterNames: [document.getElementById("character-name-0"), document.getElementById("character-name-1")],
    characterTitles: [document.getElementById("character-title-0"), document.getElementById("character-title-1")],
    abilityLines: [document.getElementById("ability-line-0"), document.getElementById("ability-line-1")],
    assignmentPills: [document.getElementById("assignment-pill-0"), document.getElementById("assignment-pill-1")],
    winnerHeading: document.getElementById("winner-heading"),
    winnerSummary: document.getElementById("winner-summary"),
    resultReason: document.getElementById("result-reason"),
    scoreboard: document.getElementById("scoreboard"),
    toastStack: document.getElementById("toast-stack"),
  };

  const canvas = document.getElementById("game-canvas");
  const audioManager = new window.GeppleAudioManager();
  const controllerManager = new window.GeppleControllerManager();
  const game = new window.GeppleGame(canvas, audioManager);

  let selectedCharacterIndices = [0, 1];
  let lastFrameTime = performance.now();
  let lastScene = "";
  let isSystemMenuOpen = false;

  function resizeStage() {
    const scale = Math.max(0.1, Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT));

    dom.stageWrap.style.width = STAGE_WIDTH * scale + "px";
    dom.stageWrap.style.height = STAGE_HEIGHT * scale + "px";
    dom.gameStage.style.transform = "scale(" + scale + ")";
  }

  function cycleCharacter(playerIndex, direction) {
    const currentIndex = selectedCharacterIndices[playerIndex];
    const nextIndex = (currentIndex + direction + characters.length) % characters.length;

    selectedCharacterIndices[playerIndex] = nextIndex;
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
    game.startRound(buildPlayerConfigs());
    syncScreens();
  }

  function backToMenu() {
    game.returnToMenu();
    syncScreens();
    focusFirstMenuButton();
  }

  function focusFirstMenuButton() {
    if (dom.startGameButton) {
      dom.startGameButton.focus({ preventScroll: true });
    }
  }

  function focusRoundOverButton() {
    if (dom.playAgainButton) {
      dom.playAgainButton.focus({ preventScroll: true });
    }
  }

  function focusSystemMenuButton() {
    if (dom.systemResumeButton) {
      dom.systemResumeButton.focus({ preventScroll: true });
    }
  }

  function handleButtonAction(button) {
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const playerIndex = Number(button.dataset.player);

    if (action === "character-prev") {
      cycleCharacter(playerIndex, -1);
      return;
    }

    if (action === "character-next") {
      cycleCharacter(playerIndex, 1);
    }
  }

  function handleMenuInput(menuInput) {
    if (game.scene === "menu") {
      if (menuInput.swapPressed) {
        swapControllers();
      }

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

  function getVisibleMenuButtons() {
    if (isSystemMenuOpen) {
      return Array.from(document.querySelectorAll("#system-menu-screen:not(.is-hidden) .menu-button"));
    }

    let selector = "#menu-screen:not(.is-hidden) .menu-button";

    if (game.scene === "round-over") {
      selector = "#round-over-screen:not(.is-hidden) .menu-button";
    }

    return Array.from(document.querySelectorAll(selector));
  }

  function moveFocus(menuInput) {
    const buttons = getVisibleMenuButtons();

    if (buttons.length === 0) {
      return;
    }

    const currentIndex = buttons.indexOf(document.activeElement);
    let nextIndex = currentIndex === -1 ? 0 : currentIndex;

    if (menuInput.navLeftPressed || menuInput.navUpPressed) {
      nextIndex -= 1;
    }

    if (menuInput.navRightPressed || menuInput.navDownPressed) {
      nextIndex += 1;
    }

    if (nextIndex < 0) {
      nextIndex = buttons.length - 1;
    }

    if (nextIndex >= buttons.length) {
      nextIndex = 0;
    }

    buttons[nextIndex].focus({ preventScroll: true });
  }

  function renderSystemMenu() {
    const isPlaying = game.scene === "playing";

    dom.systemMenuHeading.textContent = isPlaying ? "Game Menu" : "System Menu";
    dom.systemMenuCopy.textContent = isPlaying
      ? "The board is paused. Leave full screen, or exit Gepple."
      : "Leave full screen, or exit Gepple.";
    dom.systemResumeButton.textContent = isPlaying ? "Resume Game" : "Close Menu";
  }

  function openSystemMenu() {
    isSystemMenuOpen = true;
    renderSystemMenu();
    syncScreens();
    focusSystemMenuButton();
  }

  function closeSystemMenu() {
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

  async function exitFullscreenMode() {
    if (!document.fullscreenElement || !document.exitFullscreen) {
      game.pushToast("Already out of full screen.");
      return;
    }

    try {
      await document.exitFullscreen();
      game.pushToast("Exited full screen.");
    } catch (error) {
      game.pushToast("Full screen could not be exited.");
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
    const keyboard = controllerManager.getKeyboardState();
    const cards = controllerManager.connectedPads.slice();

    if (cards.length === 0) {
      dom.controllerStatus.innerHTML =
        '<article class="controller-card"><div class="controller-card__title"><span>No controllers yet</span><span>Keyboard fallback ready</span></div><p class="controller-card__hint">Connect one or two Xbox pads. Gepple will auto-assign them, and you can swap assignments here.</p></article>';
      return;
    }

    dom.controllerStatus.innerHTML = cards
      .map(function renderCard(pad) {
        const ownerIndex = controllerManager.assignments.indexOf(pad.index);
        const ownerLabel = ownerIndex === -1 ? "Unassigned" : "Player " + (ownerIndex + 1);
        const isActive = performance.now() - pad.lastActivityAt < 220 ? " is-active" : "";

        return (
          '<article class="controller-card' +
          isActive +
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
          pad.label +
          "</p>" +
          "</article>"
        );
      })
      .join("");

    if (performance.now() - keyboard.lastActivityAt < 220) {
      dom.controllerStatus.insertAdjacentHTML(
        "beforeend",
        '<article class="controller-card is-active"><div class="controller-card__title"><span>Keyboard</span><span>Fallback</span></div><p class="controller-card__hint">Useful for quick browser testing on desktop.</p></article>'
      );
    }
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
        "url('" + character.portraitPath + "'), " + character.portraitGradient;
      dom.portraitTargets[playerIndex].style.backgroundColor = character.accentSoft;
    }
  }

  function renderHud(uiState) {
    const activePlayer = uiState.players[uiState.activePlayerIndex];

    if (!activePlayer) {
      return;
    }

    const activeAbilityReady = activePlayer.abilityCharged && !activePlayer.abilityUsedThisShot;

    dom.turnIndicator.textContent = activePlayer.name;
    dom.turnBanner.classList.toggle("is-ability-ready", activeAbilityReady);

    if (activeAbilityReady) {
      dom.roundSubtitle.textContent =
        "Orange pegs left: " + uiState.orangeRemaining + ". Special ready. Press X or RB now.";
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
      const abilityReady = isActive && player.abilityCharged && !player.abilityUsedThisShot;
      let abilityStatus = "Waiting for green peg";
      let abilityStatusClass = "status-pill status-pill--idle";

      if (abilityReady) {
        abilityStatus = "Ready - Press X / RB";
        abilityStatusClass = "status-pill status-pill--ready";
      }

      if (player.abilityUsedThisShot) {
        abilityStatus = "Spent this turn";
        abilityStatusClass = "status-pill status-pill--spent";
      }

      dom.hudPlayers[playerIndex].classList.toggle("is-active", isActive);
      dom.hudPlayers[playerIndex].classList.toggle("is-ready", abilityReady);
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
        character.portraitPath +
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

    dom.resultReason.textContent = uiState.roundReason;
    dom.winnerHeading.textContent = winner.name + " Wins";
    dom.winnerSummary.textContent =
      "Final orange clears: " +
      winner.orangeHits +
      ". Final score: " +
      winner.score.toLocaleString() +
      ".";

    dom.scoreboard.innerHTML = uiState.players
      .map(function renderRow(player) {
        const character = window.GeppleCharacterLookup[player.characterId];

        return (
          '<article class="score-row">' +
          "<div><strong>" +
          player.name +
          "</strong><p>" +
          character.name +
          "</p></div>" +
          "<div><strong>" +
          player.score.toLocaleString() +
          "</strong><p>" +
          player.orangeHits +
          " orange pegs</p></div>" +
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
    const startPressed = playerInputs.some(function checkInput(input) {
      return input && input.startPressed;
    });

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

    handleMenuInput(playerOneMenuInput);
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
  dom.systemExitFullscreenButton.addEventListener("click", exitFullscreenMode);
  dom.systemExitGameButton.addEventListener("click", exitGame);

  window.addEventListener("resize", resizeStage);

  resizeStage();
  renderMenu();
  syncScreens();
  focusFirstMenuButton();
  requestAnimationFrame(frame);
})();
