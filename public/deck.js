// Speaker notes and order come verbatim from README.md. Visuals follow headings,
// so moving a section cannot move the live demo onto another slide.
import { talk } from './talk-content.js';
export { defaults, rehearsals } from './demo-config.js';

const visuals = {
  'Conclusion': { id: 'conclusion', image: 'city.jpg', treatment: 'mono', alt: 'A city skyline suggesting new applications and possibilities ahead.' },
  'Questions?': { id: 'questions', image: 'questions.svg', alt: 'Closing slide inviting questions from the audience.' },
  'Self-intro': { id: 'self-intro', image: 'self-intro-dark.svg', alt: 'Decision Models. Rick Carlino.' },
  'Introduction': { id: 'coal', image: 'steam.jpg', treatment: 'mono', alt: 'Steam locomotive: efficiency opens the door to greater use.' },
  'JEV': { id: 'jev', image: 'typesafe-home.png', treatment: 'homepage', alt: 'TypeSafe AI’s homepage introducing Jev, its first public System One model.' },
  'Problems': { id: 'problems', image: 'train-waiting-signal.png', treatment: 'natural', alt: 'A steam freight locomotive waits at a red railway signal, illustrating capability constrained by delay and resource costs.' },
  'Enter Decision Models': { id: 'decision', image: 'magic-eight-ball-railway.png', treatment: 'natural', alt: 'A Magic 8 Ball shows YES in its upward-facing answer window in the foreground, with a railway switch and two fixed routes behind it.' },
  'Next: Live Demo': { id: 'speed', image: 'railway.jpg', treatment: 'mono', alt: 'A long freight train carries many tank wagons, echoing the Jevons connection and the wider use enabled by efficiency.' },
  'Demo': { id: 'demo', image: 'diagrams/demo.svg', kind: 'demo', alt: 'A camera frame connects to three bounded decisions.' },
  'Demo 3': { id: 'pokemon', label: 'Demo 3 · Pokémon', image: 'pokemon-project.png', treatment: 'project', alt: 'The Jev Plays Pokémon Red project, showing its highlights player and the completed game.' },
  'Demo 2': { id: 'archives', label: 'Demo 2 · Archives', image: 'meteorite-report.jpg', treatment: 'archive', position: '50% 27%', alt: 'The original 1812 newspaper page containing Captain M’s meteorite account in its second column.' },
  'The main show: JEV': { id: 'playground', label: 'Jev playground', image: 'coin.jpg', treatment: 'coin', alt: 'The coin photograph used in the live decision-model playground example.' },
  'How is it possible?': { id: 'bounds', image: 'signal-box-levers.png', treatment: 'natural', alt: 'Mechanical railway signal levers move within fixed guide slots, with branching tracks beyond the window, illustrating constrained outputs.' },
  'Can it explain why it chose an answer?': { id: 'explanation', label: 'Explaining a decision', image: 'software.jpg', treatment: 'mono', alt: 'People review a result together: a separate review can check a decision and discuss its justification.' },
  'Getting Started': { id: 'getting-started', image: 'diagrams/primitives.svg', alt: 'Three decision instruments: a probability dial, an ordered scale, and a fixed choice.' },
  'Noul: Is This True?': { id: 'noul', image: 'diagrams/noul.svg', alt: 'A probability dial points close to its positive end.' },
  'Score: Where Does This Fall on a Scale?': { id: 'score', image: 'diagrams/score.svg', alt: 'A marker sits on a scale of five ordered levels.' },
  'Choice: Which Option Fits?': { id: 'choice', image: 'diagrams/choice.svg', alt: 'One of four possible branches is selected.' },
  'Box: Where Is It?': { id: 'box', image: 'diagrams/box.svg', alt: 'An orange bounding box locates one object among several.' },
  'Understanding Input State': { id: 'input-state', label: 'Input state', image: 'mixer.jpg', treatment: 'natural', alt: 'A mixing console provides an analogy for evaluating a shared input through several independent channels.' },
  'Alternatives: OpenAI Decisions API': { id: 'openai', label: 'OpenAI Decisions API', image: 'openai-decisions-title.svg', alt: 'OpenAI Decisions Model, set in large type on the dark presentation background.' },
  'Alternatives: Self-Hosted': { id: 'local', label: 'Self-hosted · TOPIK', image: 'topik-bench-results.png', treatment: 'benchmark', alt: 'TOPIK Bench, 502 questions. Jev: 97.0%, 159 ms, 1.31 cents. OpenAI: 95.0%, 282 ms, 1.85 cents. Clef: 92.4%, 79 ms. Nimble: 91.2%, 95 ms. Tev1: 85.3%, 54 ms. Local hardware and electricity excluded.' },
  'Why not just use an LLM with JSON output': { id: 'json', label: 'Small models and JSON', image: 'structured-outputs.png', treatment: 'screenshot', alt: 'An official structured-output code example defines a schema and parses a language model response.' }
};
const sources = {
  coal: [['Jev and the Jevons connection', 'https://typesafe.ai/blog/introducing-system-one-models-and-jev']],
  jev: [['TypeSafe homepage', 'https://typesafe.ai/'], ['Introducing Jev', 'https://typesafe.ai/blog/introducing-system-one-models-and-jev']],
  decision: [['What Jev returns', 'https://docs.typesafe.ai/introduction']],
  speed: [['Jev and the Jevons connection', 'https://typesafe.ai/blog/introducing-system-one-models-and-jev'], ['System One models', 'https://docs.typesafe.ai/introduction']],
  pokemon: [['Project & highlights', 'https://jev-pokemon.vercel.app/'], ['Source code', 'https://github.com/christianmat/jev-pokemon']],
  archives: [['Jesse Waites’s archive investigation', 'https://jessewaites.com/blog/post/i-pointed-ai-at-400-years-of-archives/'], ['Original meteorite report · Delpher', 'https://resolver.kb.nl/resolve?urn=ddd:010247570:mpeg21:a0019']],
  explanation: [['Atomic questions, composed in code', 'https://docs.typesafe.ai/introduction#atomic-questions-composed-in-code']],
  'getting-started': [['TypeSafe introduction', 'https://docs.typesafe.ai/introduction']],
  noul: [['Noul reference', 'https://docs.typesafe.ai/primitives/noul']],
  score: [['Score reference', 'https://docs.typesafe.ai/primitives/score']],
  choice: [['Choice reference', 'https://docs.typesafe.ai/primitives/choice']],
  box: [['Box reference', 'https://docs.typesafe.ai/primitives/box']],
  'input-state': [['Shared state and parallel questions', 'https://docs.typesafe.ai/introduction'], ['Questions reference', 'https://docs.typesafe.ai/primitives']],
  openai: [['OpenAI Decisions API', 'https://developers.openai.com/api/docs/guides/decisions']],
  local: [['My TOPIK benchmark · results and methodology', 'https://rickcarlino.com/notes/korean-language/topik-bench-measuring-korean-ability-of-decision-models.html']],
  json: [['Structured model outputs', 'https://developers.openai.com/api/docs/guides/structured-outputs']],
  demo: [['Images reference', 'https://docs.typesafe.ai/images']]
};

const livePages = {
  pokemon: [{ label: 'Pokémon highlights', url: 'https://jev-pokemon.vercel.app/' }, { label: 'Pokémon project', url: 'https://github.com/christianmat/jev-pokemon' }],
  archives: [{ label: 'Archive story', url: 'https://jessewaites.com/blog/post/i-pointed-ai-at-400-years-of-archives/' }, { label: 'Original newspaper', url: 'https://resolver.kb.nl/resolve?urn=ddd:010247570:mpeg21:a0019' }],
  playground: [{ label: 'Jev playground', url: 'https://console.typesafe.ai/playground?share=shr_1c340dfbc12dcc240d9ba27fb89cfec2ff6' }],
  openai: [{ label: 'OpenAI Decisions', url: 'https://platform.openai.com/decisions' }],
  local: [{ label: 'TOPIK benchmark', url: 'https://rickcarlino.com/notes/korean-language/topik-bench-measuring-korean-ability-of-decision-models.html' }]
};

export function buildSlides(sections) {
  return sections.map(section => {
    const visual = visuals[section.title] || { id: section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), image: 'diagrams/decision.svg', alt: section.title };
    return {
      ...section, treatment: 'natural', position: '50% 50%', chapter: 'Talk',
      label: section.title.split(':')[0], ...visual,
      livePages: livePages[visual.id] || [],
      coin: ['playground', 'openai'].includes(visual.id),
      sources: (sources[visual.id] || []).map(([label, url]) => ({label, url}))
    };
  });
}
export const slides = buildSlides(talk);
