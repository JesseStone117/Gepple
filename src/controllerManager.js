(function () {
  const DEAD_ZONE = 0.22;

  function clampAxis(value) {
    if (Math.abs(value) < DEAD_ZONE) {
      return 0;
    }

    return Math.max(-1, Math.min(1, value));
  }

  function shortId(id) {
    if (!id) {
      return "Unknown Controller";
    }

    const trimmed = id.replace(/\(.*?\)/g, "").trim();

    if (trimmed.length <= 28) {
      return trimmed;
    }

    return trimmed.slice(0, 25) + "...";
  }

  class GeppleControllerManager {
    constructor() {
      this.assignments = [null, null];
      this.connectedPads = [];
      this.previousPadStates = new Map();
      this.connectionEvents = [];
      this.lastSeenIndices = new Set();

      this.keysDown = new Set();
      this.currentKeysDown = new Set();
      this.previousKeysDown = new Set();
      this.keyboardPulseAt = 0;

      window.addEventListener("keydown", this.handleKeyDown.bind(this));
      window.addEventListener("keyup", this.handleKeyUp.bind(this));
      window.addEventListener("blur", this.handleBlur.bind(this));
    }

    handleKeyDown(event) {
      this.keysDown.add(event.code);
      this.keyboardPulseAt = performance.now();

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(event.code)) {
        event.preventDefault();
      }
    }

    handleKeyUp(event) {
      this.keysDown.delete(event.code);
    }

    handleBlur() {
      this.keysDown.clear();
      this.currentKeysDown.clear();
      this.previousKeysDown.clear();
    }

    update(now) {
      this.previousKeysDown = new Set(this.currentKeysDown);
      this.currentKeysDown = new Set(this.keysDown);

      const rawPads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const connectedPads = [];
      const seenIndices = new Set();

      for (const rawPad of rawPads) {
        if (!rawPad || !rawPad.connected) {
          continue;
        }

        seenIndices.add(rawPad.index);
        connectedPads.push(this.readPad(rawPad, now));
      }

      this.detectConnectionChanges(seenIndices);
      this.connectedPads = connectedPads;
      this.ensureAssignments();
      this.lastSeenIndices = seenIndices;
    }

    detectConnectionChanges(seenIndices) {
      for (const index of seenIndices) {
        if (!this.lastSeenIndices.has(index)) {
          this.connectionEvents.push({ type: "connected", index });
        }
      }

      for (const index of this.lastSeenIndices) {
        if (!seenIndices.has(index)) {
          this.connectionEvents.push({ type: "disconnected", index });
        }
      }
    }

    readPad(rawPad, now) {
      const previous = this.previousPadStates.get(rawPad.index) || {
        buttons: {},
        nav: { left: false, right: false, up: false, down: false },
      };

      const buttons = {
        a: Boolean(rawPad.buttons[0] && rawPad.buttons[0].pressed),
        b: Boolean(rawPad.buttons[1] && rawPad.buttons[1].pressed),
        x: Boolean(rawPad.buttons[2] && rawPad.buttons[2].pressed),
        y: Boolean(rawPad.buttons[3] && rawPad.buttons[3].pressed),
        lb: Boolean(rawPad.buttons[4] && rawPad.buttons[4].pressed),
        rb: Boolean(rawPad.buttons[5] && rawPad.buttons[5].pressed),
        start: Boolean(rawPad.buttons[9] && rawPad.buttons[9].pressed),
        dpadUp: Boolean(rawPad.buttons[12] && rawPad.buttons[12].pressed),
        dpadDown: Boolean(rawPad.buttons[13] && rawPad.buttons[13].pressed),
        dpadLeft: Boolean(rawPad.buttons[14] && rawPad.buttons[14].pressed),
        dpadRight: Boolean(rawPad.buttons[15] && rawPad.buttons[15].pressed),
      };

      const axisX = clampAxis(rawPad.axes[0] || 0);
      const axisY = clampAxis(rawPad.axes[1] || 0);
      const nav = {
        left: axisX < -0.55 || buttons.dpadLeft,
        right: axisX > 0.55 || buttons.dpadRight,
        up: axisY < -0.55 || buttons.dpadUp,
        down: axisY > 0.55 || buttons.dpadDown,
      };

      const isActive =
        buttons.a ||
        buttons.b ||
        buttons.x ||
        buttons.y ||
        buttons.lb ||
        buttons.rb ||
        buttons.start ||
        buttons.dpadUp ||
        buttons.dpadDown ||
        buttons.dpadLeft ||
        buttons.dpadRight ||
        Math.abs(axisX) > DEAD_ZONE ||
        Math.abs(axisY) > DEAD_ZONE;

      const lastActivityAt = isActive ? now : previous.lastActivityAt || 0;

      const state = {
        index: rawPad.index,
        id: rawPad.id,
        label: shortId(rawPad.id),
        aimX: nav.left ? -1 : nav.right ? 1 : axisX,
        aimY: nav.up ? -1 : nav.down ? 1 : axisY,
        launchPressed: buttons.a && !previous.buttons.a,
        abilityPressed: (buttons.x || buttons.rb) && !(previous.buttons.x || previous.buttons.rb),
        confirmPressed: buttons.a && !previous.buttons.a,
        backPressed: (buttons.b || buttons.start) && !(previous.buttons.b || previous.buttons.start),
        swapPressed: buttons.y && !previous.buttons.y,
        navLeftPressed: nav.left && !previous.nav.left,
        navRightPressed: nav.right && !previous.nav.right,
        navUpPressed: nav.up && !previous.nav.up,
        navDownPressed: nav.down && !previous.nav.down,
        isActive,
        lastActivityAt,
      };

      this.previousPadStates.set(rawPad.index, {
        buttons,
        nav,
        lastActivityAt,
      });

      return state;
    }

    ensureAssignments() {
      const availableIndices = this.connectedPads.map(function mapPad(pad) {
        return pad.index;
      });

      for (let playerIndex = 0; playerIndex < this.assignments.length; playerIndex += 1) {
        const current = this.assignments[playerIndex];

        if (current !== null && availableIndices.includes(current)) {
          continue;
        }

        this.assignments[playerIndex] = null;
      }

      for (const index of availableIndices) {
        if (this.assignments.includes(index)) {
          continue;
        }

        const firstOpen = this.assignments.indexOf(null);

        if (firstOpen === -1) {
          break;
        }

        this.assignments[firstOpen] = index;
      }
    }

    getAssignedPad(playerIndex) {
      const assignment = this.assignments[playerIndex];

      if (assignment === null) {
        return null;
      }

      return this.connectedPads.find(function findPad(pad) {
        return pad.index === assignment;
      }) || null;
    }

    getKeyboardState() {
      const isDown = this.currentKeysDown.has.bind(this.currentKeysDown);
      const wasDown = this.previousKeysDown.has.bind(this.previousKeysDown);
      const axisLeft = isDown("ArrowLeft") || isDown("KeyA");
      const axisRight = isDown("ArrowRight") || isDown("KeyD");
      const axisUp = isDown("ArrowUp") || isDown("KeyW");
      const axisDown = isDown("ArrowDown") || isDown("KeyS");

      return {
        index: "keyboard",
        label: "Keyboard",
        aimX: axisLeft ? -1 : axisRight ? 1 : 0,
        aimY: axisUp ? -1 : axisDown ? 1 : 0,
        launchPressed: (isDown("Space") || isDown("Enter")) && !(wasDown("Space") || wasDown("Enter")),
        abilityPressed: isDown("ShiftLeft") && !wasDown("ShiftLeft"),
        confirmPressed: (isDown("Enter") || isDown("Space")) && !(wasDown("Enter") || wasDown("Space")),
        backPressed: isDown("Escape") && !wasDown("Escape"),
        swapPressed: isDown("Tab") && !wasDown("Tab"),
        navLeftPressed: axisLeft && !(wasDown("ArrowLeft") || wasDown("KeyA")),
        navRightPressed: axisRight && !(wasDown("ArrowRight") || wasDown("KeyD")),
        navUpPressed: axisUp && !(wasDown("ArrowUp") || wasDown("KeyW")),
        navDownPressed: axisDown && !(wasDown("ArrowDown") || wasDown("KeyS")),
        isActive:
          axisLeft ||
          axisRight ||
          axisUp ||
          axisDown ||
          isDown("Space") ||
          isDown("Enter") ||
          isDown("ShiftLeft") ||
          isDown("Escape"),
        lastActivityAt: this.keyboardPulseAt,
      };
    }

    getPlayerInput(playerIndex) {
      const assignedPad = this.getAssignedPad(playerIndex);

      if (assignedPad) {
        return assignedPad;
      }

      if (this.connectedPads.length > 0) {
        return this.connectedPads[0];
      }

      return this.getKeyboardState();
    }

    getMenuInput() {
      const keyboard = this.getKeyboardState();
      const merged = Object.assign({}, keyboard);

      for (const pad of this.connectedPads) {
        if (pad.navLeftPressed) {
          merged.navLeftPressed = true;
        }

        if (pad.navRightPressed) {
          merged.navRightPressed = true;
        }

        if (pad.navUpPressed) {
          merged.navUpPressed = true;
        }

        if (pad.navDownPressed) {
          merged.navDownPressed = true;
        }

        if (pad.confirmPressed) {
          merged.confirmPressed = true;
        }

        if (pad.backPressed) {
          merged.backPressed = true;
        }

        if (pad.swapPressed) {
          merged.swapPressed = true;
        }
      }

      return merged;
    }

    getAssignmentLabel(playerIndex) {
      const assignedPad = this.getAssignedPad(playerIndex);

      if (assignedPad) {
        return "Controller " + (assignedPad.index + 1);
      }

      if (this.connectedPads.length > 0) {
        return "Shared controller fallback";
      }

      return "Keyboard fallback";
    }

    swapAssignments() {
      const first = this.assignments[0];
      this.assignments[0] = this.assignments[1];
      this.assignments[1] = first;
    }

    takeConnectionEvents() {
      const events = this.connectionEvents.slice();
      this.connectionEvents.length = 0;
      return events;
    }
  }

  window.GeppleControllerManager = GeppleControllerManager;
})();
