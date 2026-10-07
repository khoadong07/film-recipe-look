// On-device subject detection — the one module under src/ai/ that's an
// actual trained ML model (MediaPipe's BlazeFace / EfficientDet-Lite0, run
// fully client-side via WASM), unlike colorMatch.ts/recipeRecommender.ts
// which are deterministic signal-processing heuristics.
//
// `@mediapipe/tasks-vision` is dynamically imported so its payload only
// loads when a caller actually asks for a detection (same lazy-load
// convention as src/raw/decodeRaw.ts). The WASM runtime and the .tflite
// model weights are both fetched at request time from public CDNs
// (jsdelivr / storage.googleapis.com) — first use requires network access;
// the browser's HTTP cache makes subsequent calls fast.

import type { Detection } from '@mediapipe/tasks-vision';

export interface DetectedSubject {
  kind: 'face' | 'object';
  label: string;
  score: number;
  /** Normalized 0..1, relative to the image's own width/height; x/y is the top-left corner. */
  box: { x: number; y: number; width: number; height: number };
}

type SourceImage = HTMLImageElement | ImageBitmap;

function sourceDimensions(image: SourceImage): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';
const OBJECT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite';

const UNAVAILABLE_MESSAGE = 'Subject detection unavailable (could not load the on-device model — check your connection).';

function toDetectedSubjects(detections: Detection[], kind: 'face' | 'object', imgW: number, imgH: number): DetectedSubject[] {
  const out: DetectedSubject[] = [];
  for (const d of detections) {
    const box = d.boundingBox;
    if (!box || imgW <= 0 || imgH <= 0) continue;
    const category = d.categories[0];
    out.push({
      kind,
      label: kind === 'face' ? 'face' : category?.categoryName || category?.displayName || 'object',
      score: category?.score ?? 1,
      box: {
        x: box.originX / imgW,
        y: box.originY / imgH,
        width: box.width / imgW,
        height: box.height / imgH,
      },
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function detectSubjects(image: SourceImage): Promise<DetectedSubject[]> {
  const { width, height } = sourceDimensions(image);

  let visionModule: typeof import('@mediapipe/tasks-vision');
  try {
    visionModule = await import('@mediapipe/tasks-vision');
  } catch {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
  const { FilesetResolver, FaceDetector, ObjectDetector } = visionModule;

  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    const faceDetector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL },
      runningMode: 'IMAGE',
    });
    let faceDetections: Detection[];
    try {
      faceDetections = faceDetector.detect(image).detections;
    } finally {
      faceDetector.close();
    }
    const faces = toDetectedSubjects(faceDetections, 'face', width, height);
    if (faces.length > 0) return faces;

    const objectDetector = await ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: OBJECT_MODEL_URL },
      runningMode: 'IMAGE',
      maxResults: 5,
    });
    let objectDetections: Detection[];
    try {
      objectDetections = objectDetector.detect(image).detections;
    } finally {
      objectDetector.close();
    }
    return toDetectedSubjects(objectDetections, 'object', width, height);
  } catch {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
}
