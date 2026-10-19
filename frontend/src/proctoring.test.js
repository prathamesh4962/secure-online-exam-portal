import assert from 'node:assert/strict'
import test from 'node:test'
import {
  consumeTabSwitch,
  createFaceDetectionState,
  detectFaceWarning,
  detectMicrophoneWarning,
} from './proctoring.js'

const frameSize = { width: 640, height: 480 }
const centeredFace = { x: 270, y: 190, width: 100, height: 100 }
const detectedFace = (faceBox = centeredFace) => ({
  face_count: 1,
  face_detected: true,
  face_box: faceBox,
})

test('missing face counts once until a face returns', () => {
  const state = createFaceDetectionState()
  const missing = { face_count: 0, face_detected: false }

  assert.equal(detectFaceWarning(missing, state, frameSize.width, frameSize.height).category, 'face_missing')
  assert.equal(detectFaceWarning(missing, state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(detectedFace(), state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(missing, state, frameSize.width, frameSize.height).category, 'face_missing')
})

test('unavailable face analysis does not count as a missing face', () => {
  const state = createFaceDetectionState()

  assert.equal(
    detectFaceWarning({ face_detected: false, status: 'warning' }, state, frameSize.width, frameSize.height),
    null,
  )
})

test('multiple faces count once until only one face remains', () => {
  const state = createFaceDetectionState()
  const multiple = { face_count: 2, face_detected: true }

  assert.equal(detectFaceWarning(multiple, state, frameSize.width, frameSize.height).category, 'multiple_faces')
  assert.equal(detectFaceWarning(multiple, state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(detectedFace(), state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(multiple, state, frameSize.width, frameSize.height).category, 'multiple_faces')
})

test('significant face movement counts once and rearms after stable frames', () => {
  const state = createFaceDetectionState()

  assert.equal(detectFaceWarning(detectedFace(), state, frameSize.width, frameSize.height), null)
  assert.equal(
    detectFaceWarning(detectedFace({ ...centeredFace, x: centeredFace.x + 120 }), state, frameSize.width, frameSize.height).category,
    'face_movement',
  )
  assert.equal(
    detectFaceWarning(detectedFace({ ...centeredFace, x: centeredFace.x + 240 }), state, frameSize.width, frameSize.height),
    null,
  )
  assert.equal(detectFaceWarning(detectedFace({ ...centeredFace, x: centeredFace.x + 240 }), state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(detectedFace({ ...centeredFace, x: centeredFace.x + 240 }), state, frameSize.width, frameSize.height), null)
  assert.equal(detectFaceWarning(detectedFace({ ...centeredFace, x: centeredFace.x + 400 }), state, frameSize.width, frameSize.height).category, 'face_movement')
})

test('microphone requires sustained sound and counts once during its cooldown', () => {
  const state = { startedAt: null, latched: false, cooldownUntil: 0 }

  assert.equal(detectMicrophoneWarning(0.1, 1000, state, 0.08, 1500, 10000), false)
  assert.equal(detectMicrophoneWarning(0.1, 2499, state, 0.08, 1500, 10000), false)
  assert.equal(detectMicrophoneWarning(0.1, 2500, state, 0.08, 1500, 10000), true)
  assert.equal(detectMicrophoneWarning(0.1, 13000, state, 0.08, 1500, 10000), false)
  assert.equal(detectMicrophoneWarning(0, 13001, state, 0.08, 1500, 10000), false)
  assert.equal(detectMicrophoneWarning(0.1, 14000, state, 0.08, 1500, 10000), false)
  assert.equal(detectMicrophoneWarning(0.1, 25500, state, 0.08, 1500, 10000), true)
})

test('tab blur and visibility signals consume one away event, while later switches count again', () => {
  const state = { current: false }

  state.current = true
  assert.equal(consumeTabSwitch(state), true)
  assert.equal(consumeTabSwitch(state), false)
  state.current = true
  assert.equal(consumeTabSwitch(state), true)
})
