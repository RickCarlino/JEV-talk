export const defaults = {
  mode: 'rehearsal', camera: false, paused: true, interval: 1000, realtime: true,
  threshold: 0.7,
  noul: 'Is at least one human hand visible in the image?',
  score: 'How high is the most visible hand raised relative to the person?',
  levels: ['No hand visible, or hand below shoulder height', 'Hand around shoulder height', 'Hand clearly above the head'],
  choice: 'Which gesture best describes the most visible hand?',
  options: ['Open palm', 'Closed fist', 'Pointing', 'Other or no hand'],
  sample: 0
};

// Deliberately fixed samples. Never presented as model output.
export const rehearsals = [
  { name: 'Open palm', noul: 0.97, score: 1.68, confidence: 0.83, probabilities: [0.91, 0.03, 0.02, 0.04] },
  { name: 'Closed fist', noul: 0.96, score: 1.12, confidence: 0.78, probabilities: [0.04, 0.88, 0.03, 0.05] },
  { name: 'No hand', noul: 0.08, score: 0.06, confidence: 0.91, probabilities: [0.02, 0.02, 0.01, 0.95] }
];
