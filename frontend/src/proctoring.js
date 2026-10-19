const FACE_MOVEMENT_THRESHOLD = 0.15
const FACE_STABLE_SAMPLES_TO_RESET = 2

export function createFaceDetectionState() {
  return {
    faceMissingLatched: false,
    multipleFacesLatched: false,
    faceMovementLatched: false,
    stableFaceSamples: 0,
    previousFaceBox: null,
  }
}

export function detectFaceWarning(data, state, frameWidth, frameHeight) {
  const faceCount = Number.isInteger(data.face_count)
    ? data.face_count
    : data.face_detected ? 1 : null
  if (faceCount === null) return null

  if (faceCount === 0) {
    state.previousFaceBox = null
    state.stableFaceSamples = 0
    state.faceMovementLatched = false
    if (state.faceMissingLatched) return null
    state.faceMissingLatched = true
    return {
      category: 'face_missing',
      message: 'No face was detected in the camera frame.',
    }
  }

  state.faceMissingLatched = false
  if (faceCount > 1) {
    state.previousFaceBox = null
    state.stableFaceSamples = 0
    state.faceMovementLatched = false
    if (state.multipleFacesLatched) return null
    state.multipleFacesLatched = true
    return {
      category: 'multiple_faces',
      message: 'Multiple faces were detected in the camera frame.',
    }
  }

  state.multipleFacesLatched = false
  const faceBox = data.face_box
  if (!faceBox || frameWidth <= 0 || frameHeight <= 0) {
    state.previousFaceBox = null
    state.stableFaceSamples = 0
    return null
  }

  const previousFaceBox = state.previousFaceBox
  state.previousFaceBox = faceBox
  if (!previousFaceBox) return null

  const previousCenterX = previousFaceBox.x + previousFaceBox.width / 2
  const previousCenterY = previousFaceBox.y + previousFaceBox.height / 2
  const centerX = faceBox.x + faceBox.width / 2
  const centerY = faceBox.y + faceBox.height / 2
  const normalizedMovement = Math.hypot(
    (centerX - previousCenterX) / frameWidth,
    (centerY - previousCenterY) / frameHeight,
  )

  if (normalizedMovement >= FACE_MOVEMENT_THRESHOLD) {
    state.stableFaceSamples = 0
    if (state.faceMovementLatched) return null
    state.faceMovementLatched = true
    return {
      category: 'face_movement',
      message: 'Significant face movement was detected during the exam.',
    }
  }

  if (state.faceMovementLatched) {
    state.stableFaceSamples += 1
    if (state.stableFaceSamples >= FACE_STABLE_SAMPLES_TO_RESET) {
      state.faceMovementLatched = false
      state.stableFaceSamples = 0
    }
  }
  return null
}

export function detectMicrophoneWarning(audioLevel, now, state, threshold, sustainedMs, cooldownMs) {
  if (audioLevel < threshold) {
    state.startedAt = null
    state.latched = false
    return false
  }

  if (state.startedAt === null) state.startedAt = now
  if (state.latched || now - state.startedAt < sustainedMs || now < state.cooldownUntil) return false

  state.latched = true
  state.cooldownUntil = now + cooldownMs
  return true
}

export function consumeTabSwitch(state) {
  if (!state.current) return false
  state.current = false
  return true
}
