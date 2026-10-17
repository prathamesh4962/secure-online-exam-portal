import base64

import numpy as np

try:
    import cv2
except ImportError:  # pragma: no cover - handled by fallback logic.
    cv2 = None


def analyze_frame(frame_data):
    if not frame_data:
        return {
            'face_detected': False,
            'face_confidence': 0,
            'status': 'warning',
            'detail': 'No frame was provided for analysis.',
        }

    if cv2 is None:
        return {
            'face_detected': False,
            'face_confidence': 0,
            'status': 'warning',
            'detail': 'OpenCV is not available in this environment.',
        }

    try:
        if isinstance(frame_data, str):
            if frame_data.startswith('data:image'):
                frame_data = frame_data.split(',', 1)[1]
            encoded = frame_data.encode('utf-8')
            raw = base64.b64decode(encoded, validate=True)
        elif isinstance(frame_data, (bytes, bytearray)):
            raw = bytes(frame_data)
        else:
            raw = base64.b64decode(str(frame_data), validate=True)

        arr = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError('Could not decode frame image.')

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        classifier = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = classifier.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        if len(faces) == 0:
            return {
                'face_detected': False,
                'face_confidence': 0,
                'status': 'warning',
                'detail': 'No face was detected in the frame.',
            }

        x, y, width, height = max(faces, key=lambda box: box[2] * box[3])
        area = width * height
        total_area = image.shape[0] * image.shape[1]
        confidence = max(0, min(100, round((area / total_area) * 120 + len(faces) * 10, 2)))
        return {
            'face_detected': True,
            'face_confidence': confidence,
            'status': 'ok' if confidence >= 45 else 'warning',
            'detail': 'Face detected with acceptable confidence.' if confidence >= 45 else 'Face detected but confidence is low.',
            'face_box': {'x': int(x), 'y': int(y), 'width': int(width), 'height': int(height)},
        }
    except Exception:
        return {
            'face_detected': False,
            'face_confidence': 0,
            'status': 'warning',
            'detail': 'The frame could not be analyzed reliably.',
        }
