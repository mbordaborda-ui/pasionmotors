/**
 * Sonido del motor para la pantalla de encendido.
 *
 * Usa `/audio/engine-1.mp3` (grabación corta de arranque). Si el navegador
 * bloquea el audio o el archivo no está disponible, sintetiza un arranque
 * con la Web Audio API para que la experiencia nunca se rompa.
 */

const SOUND_KEY = 'pm-sound'

let engineAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null

export function getSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
  } catch {
    /* almacenamiento no disponible */
  }
}

function synthesizeEngine() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioContext?.close().catch(() => {})
    const ctx = new Ctor()
    audioContext = ctx
    const t = ctx.currentTime

    const low = ctx.createOscillator()
    const rumble = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    low.type = 'sawtooth'
    low.frequency.setValueAtTime(58, t)
    low.frequency.exponentialRampToValueAtTime(190, t + 0.55)
    low.frequency.exponentialRampToValueAtTime(96, t + 1.5)

    rumble.type = 'square'
    rumble.frequency.setValueAtTime(29, t)
    rumble.frequency.exponentialRampToValueAtTime(95, t + 0.55)
    rumble.frequency.exponentialRampToValueAtTime(48, t + 1.5)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, t)
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.5)
    filter.frequency.exponentialRampToValueAtTime(500, t + 1.5)

    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.18)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)

    low.connect(filter)
    rumble.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    low.start(t)
    rumble.start(t)
    low.stop(t + 1.7)
    rumble.stop(t + 1.7)
    low.onended = () => {
      ctx.close().catch(() => {})
      if (audioContext === ctx) audioContext = null
    }
  } catch {
    /* silencio: el audio es opcional */
  }
}

/** Reproduce el arranque del motor. Debe llamarse desde un gesto del usuario. */
export function playEngineStart() {
  if (typeof window === 'undefined') return
  if (!getSoundEnabled()) return
  try {
    if (!engineAudio) {
      engineAudio = new Audio('/audio/engine-1.mp3')
      engineAudio.preload = 'auto'
      engineAudio.volume = 0.8
    }
    engineAudio.currentTime = 0
    const playback = engineAudio.play()
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => synthesizeEngine())
    }
  } catch {
    synthesizeEngine()
  }
}
