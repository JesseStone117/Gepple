(function () {
  class GeppleAudioManager {
    constructor() {
      this.context = null;
      this.unlocked = false;
      this.musicTracks = [
        this.createMusicTrack("audio/soundtrack1.mp3"),
        this.createMusicTrack("audio/soundtrack2.mp3"),
      ];
      this.currentMusicIndex = 0;
      this.isGameMusicPlaying = false;

      for (const track of this.musicTracks) {
        track.addEventListener("ended", this.playNextMusicTrack.bind(this));
      }
    }

    createMusicTrack(source) {
      const trackSource = window.GeppleAssetPath ? window.GeppleAssetPath(source) : source;
      const track = new Audio(trackSource);
      track.preload = "auto";
      track.volume = 0.14;
      return track;
    }

    unlock() {
      if (this.unlocked) {
        if (this.context && this.context.state === "suspended") {
          this.context.resume();
        }

        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      this.context = new AudioContextClass();
      this.unlocked = true;
    }

    playGameMusic() {
      if (this.musicTracks.length === 0) {
        return;
      }

      this.isGameMusicPlaying = true;
      this.playCurrentMusicTrack();
    }

    stopGameMusic() {
      this.isGameMusicPlaying = false;
      this.currentMusicIndex = 0;

      for (const track of this.musicTracks) {
        track.pause();
        track.currentTime = 0;
      }
    }

    playCurrentMusicTrack() {
      const track = this.musicTracks[this.currentMusicIndex];

      if (!track) {
        return;
      }

      const playPromise = track.play();

      if (!playPromise || !playPromise.catch) {
        return;
      }

      playPromise.catch(
        function ignoreAutoplayBlock() {
          this.isGameMusicPlaying = false;
        }.bind(this)
      );
    }

    playNextMusicTrack() {
      if (!this.isGameMusicPlaying) {
        return;
      }

      this.currentMusicIndex = (this.currentMusicIndex + 1) % this.musicTracks.length;
      this.musicTracks[this.currentMusicIndex].currentTime = 0;
      this.playCurrentMusicTrack();
    }

    playTone(options) {
      if (!this.context) {
        return;
      }

      const settings = Object.assign(
        {
          frequency: 440,
          duration: 0.16,
          type: "sine",
          gain: 0.06,
          slideTo: null,
        },
        options
      );

      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = settings.type;
      oscillator.frequency.setValueAtTime(settings.frequency, now);

      if (settings.slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(settings.slideTo, now + settings.duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(settings.gain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);

      oscillator.connect(gain);
      gain.connect(this.context.destination);

      oscillator.start(now);
      oscillator.stop(now + settings.duration + 0.02);
    }

    playLaunch() {
      this.playTone({ frequency: 240, slideTo: 520, duration: 0.18, type: "triangle", gain: 0.07 });
    }

    playPegHit(type) {
      if (type === "orange") {
        this.playTone({ frequency: 560, slideTo: 780, duration: 0.16, type: "triangle", gain: 0.07 });
        return;
      }

      if (type === "green") {
        this.playTone({ frequency: 420, slideTo: 660, duration: 0.22, type: "sawtooth", gain: 0.08 });
        return;
      }

      this.playTone({ frequency: 320, slideTo: 420, duration: 0.09, type: "square", gain: 0.035 });
    }

    playAbilityReady() {
      this.playTone({ frequency: 520, slideTo: 820, duration: 0.24, type: "triangle", gain: 0.08 });
    }

    playAbilityUse() {
      this.playTone({ frequency: 220, slideTo: 660, duration: 0.26, type: "sawtooth", gain: 0.085 });
    }

    playBucketCatch() {
      this.playTone({ frequency: 380, slideTo: 760, duration: 0.2, type: "triangle", gain: 0.08 });
    }

    playControllerConnect() {
      this.playTone({ frequency: 340, slideTo: 620, duration: 0.16, type: "triangle", gain: 0.055 });
    }

    playRoundWin() {
      this.playTone({ frequency: 460, slideTo: 920, duration: 0.32, type: "triangle", gain: 0.1 });
      window.setTimeout(
        function followUp() {
          this.playTone({ frequency: 680, slideTo: 1080, duration: 0.22, type: "triangle", gain: 0.08 });
        }.bind(this),
        90
      );
    }

    playFinalShotWin() {
      this.playTone({ frequency: 220, slideTo: 640, duration: 0.28, type: "sawtooth", gain: 0.1 });

      window.setTimeout(
        function firstFollowUp() {
          this.playTone({ frequency: 520, slideTo: 960, duration: 0.28, type: "triangle", gain: 0.095 });
        }.bind(this),
        80
      );

      window.setTimeout(
        function secondFollowUp() {
          this.playTone({ frequency: 780, slideTo: 1240, duration: 0.34, type: "triangle", gain: 0.11 });
        }.bind(this),
        170
      );
    }
  }

  window.GeppleAudioManager = GeppleAudioManager;
})();
