/**
 * Game audio — plays the real asset files in /public.
 *  - ambient: bgmusic.mp3, looped (the bed behind the game)
 *  - cheer():  crowdcheer.wav, one-shot (fired on game over)
 *
 * Browsers block audio until a user gesture, so call startAmbient() from a
 * real interaction (e.g. the first tap). Everything no-ops on the server.
 */

const AMBIENT_VOL = 0.35;
const CHEER_VOL = 0.8;

let ambientEl: HTMLAudioElement | null = null;
let muted = false;

export const gameAudio = {
  get muted() {
    return muted;
  },

  /** Read the persisted mute preference (client only). */
  initFromStorage() {
    if (typeof window === "undefined") return;
    muted = window.localStorage.getItem("td_muted") === "1";
  },

  setMuted(m: boolean) {
    muted = m;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("td_muted", m ? "1" : "0");
    }
    if (ambientEl) ambientEl.volume = m ? 0 : AMBIENT_VOL;
  },

  /** Start (or resume) the looping background music. */
  startAmbient() {
    if (typeof window === "undefined") return;
    if (!ambientEl) {
      ambientEl = new Audio("/bgmusic.mp3");
      ambientEl.loop = true;
      ambientEl.preload = "auto";
    }
    ambientEl.volume = muted ? 0 : AMBIENT_VOL;
    void ambientEl.play().catch(() => {
      /* blocked until a user gesture — retried on the next call */
    });
  },

  stopAmbient() {
    if (ambientEl) ambientEl.pause();
  },

  /** One-shot crowd roar. A fresh element each time so it can overlap. */
  cheer() {
    if (typeof window === "undefined" || muted) return;
    const el = new Audio("/crowdcheer.wav");
    el.volume = CHEER_VOL;
    void el.play().catch(() => {
      /* ignore autoplay rejection */
    });
  },
};
