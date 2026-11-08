# Visual sources

The deck combines original wordless illustrations, generated railway and Magic 8 Ball illustrations, source screenshots, a historical newspaper scan, and photographs. Photos are illustrative cues, not evidence of a customer deployment. Original image URLs below link to the source files; photographs are subject to the [Unsplash License](https://unsplash.com/license). Some bundled photos remain available as alternatives rather than active slides.

`diagrams/*.svg` are original vector illustrations created for this deck: decisions, bottlenecks, bounded outputs, the three primitives, probability, scoring, choice, bounding boxes, and the demo. They use no external imagery or generated text.

`typesafe-home.png` is a browser screenshot of the [TypeSafe AI homepage](https://typesafe.ai/), captured November 1, 2026 (America/Chicago). It shows the public front page at a 2048 × 1152 viewport, with the cookie banner dismissed. TypeSafe retains rights to its site and branding. The screenshot is bundled for offline presentation on the JEV slide.

`signal-box-levers.png` was generated with the built-in image generation tool on November 6, 2026, for “How is it possible?” The prompt requested a traditional railway signal-box interior with mechanical levers confined to fixed guide slots and branching tracks visible through the window. This is a conceptual analogy for constrained outputs, not a depiction of model internals or a specific railway location. The prompt is saved in `output/imagegen/signal-box-levers-prompt.txt`. The former `diagrams/bounded.svg` remains bundled as an unused alternative.

`train-stop-hand.png` was edited from `train-waiting-signal.png` with the built-in image generation tool on November 6, 2026, for “Problems.” The edit adds an upright open palm giving a STOP gesture while preserving the waiting locomotive and red signal. The base and edit prompts are saved in `output/imagegen/train-waiting-signal-prompt.txt` and `output/imagegen/train-stop-hand-prompt.txt`. This is a generated conceptual image, not documentary photography. Retained as an unused alternative after reverting the hand edit.

`train-waiting-signal.png` was generated with the built-in image generation tool on November 6, 2026, for “Problems.” The prompt requested an idling steam freight locomotive waiting at a red signal, with a warm photographic palette, no text, and no infographic overlays. It illustrates delays and resource costs constraining capability. This is a generated conceptual visual, not a photograph of a specific railway location. The full prompt is saved in `output/imagegen/train-waiting-signal-prompt.txt`. The former `diagrams/bottleneck.svg` remains bundled as an unused alternative. The active slide uses this original train-and-signal image without the hand.

`magic-eight-ball-railway.png` was generated and edited with the built-in image generation tool on November 6, 2026, for “What a Decision Model Does.” The final composition places a Magic 8 Ball in the foreground, with its upward-facing answer window displaying YES and two railway routes behind it. This is a generated conceptual visual, not a photograph of a specific railway location. The base prompt is saved in `output/imagegen/railway-switch-prompt.txt`; intermediate and final edit prompts are saved in `output/imagegen/railway-switch-eight-ball-prompt.txt` and `output/imagegen/magic-eight-ball-railway-prompt.txt`.

`ouija-yes-no.png` was generated with the built-in image generation tool on November 1, 2026, for “What a Decision Model Does.” The prompt requested a 16:9 studio-style illustration of a wooden Ouija board with a hovering planchette over YES, readable through its window, and NO unobstructed beside it. This is a generated conceptual visual, not a photograph of a historical artifact. The full prompt is saved in `output/imagegen/ouija-yes-no-prompt.txt`. Retained as an unused alternative; the active slide now uses the Magic 8 Ball and railway switch.

`ouija-board.jpg` is [Ouija board – Kennard Novelty Company](https://commons.wikimedia.org/wiki/File:Ouija_board_-_Kennard_Novelty_Company.jpg), circa 1890, by Elijah Bond and Charles Kennard, reproduced from the [Museum of Talking Boards](https://museumoftalkingboards.com/factory.html) via Wikimedia Commons. The faithful reproduction is marked [public domain](https://creativecommons.org/publicdomain/mark/1.0/). Downloaded November 1, 2026, bundled unchanged, and retained as an unused alternative.

`pokemon-project.png` is a browser screenshot of [Christian Mathiesen / Frigade's Jev Plays Pokémon Red project](https://jev-pokemon.vercel.app/), captured October 31, 2026. [Source repository](https://github.com/christianmat/jev-pokemon). It shows the real project's highlights player, rather than a substitute arcade photo. Pokémon imagery belongs to its respective owners; the screenshot is used to discuss this specific project.

`pokemon-run-stats.png` is a browser capture of the same project's Run Stats section, captured November 1, 2026 (America/Chicago), retained as an unused alternative. Demo 2 shows the project's game player. Speed and Cost uses `railway.jpg` as a visual callback to Jevons and the wider use enabled by efficiency.

`meteorite-report.jpg` is the historical newspaper scan [reproduced by Jesse Waites](https://jessewaites.com/images/archives/captain-m-meteorite-1812.jpg) in [his archive investigation](https://jessewaites.com/blog/post/i-pointed-ai-at-400-years-of-archives/), downloaded November 1, 2026. The meteorite account appears in the second column under “Bombay Gazette, August 26, 1812,” reprinted in the Java Government Gazette, December 19, 1812, page 3. [Original record at Delpher, Royal Library of the Netherlands](https://resolver.kb.nl/resolve?urn=ddd:010247570:mpeg21:a0019). The slide crops the page around the report; it depicts the actual source document, not a generated historical scene.

`openai-decisions.png` is a browser capture of the question-type table in the [official OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions), captured November 1, 2026. `structured-outputs.png` captures the schema and parsing example in the [official Structured model outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs), captured the same day. These excerpts are used to discuss the documented APIs; the screenshots are not live API results. OpenAI retains rights to its documentation. Source links are available in the corresponding presenter notes.

`topik-accuracy.png` is a 1600 × 900 rendering of the editable accuracy chart in `topik-benchmark.html`, based on [Rick Carlino’s TOPIK Bench](https://rickcarlino.com/notes/korean-language/topik-bench-measuring-korean-ability-of-decision-models.html), captured November 1, 2026. All five accuracy values are transcribed unchanged from the published table. Bars run from zero to 100 percent. Timing, cost, hardware, and methodological details remain in the README speaker notes. This is a presentation of the published data, not an image-generated chart or a fresh benchmark run.

| File | Source |
| --- | --- |
| steam.jpg | [Axi Aimee, steam locomotive](https://unsplash.com/photos/PVcqofiUrZA) |
| software.jpg | [Software team photograph](https://images.unsplash.com/photo-1519389950473-47ba0277781c) |
| mixer.jpg | [Marc Fanelli-Isla, mixing console](https://unsplash.com/photos/xo4ValczbuA) |
| railway.jpg | [Railway photograph](https://images.unsplash.com/photo-1474487548417-781cb71495f3) |
| city.jpg | [City photograph](https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b) |

DM Sans by Colophon Foundry is distributed under the SIL Open Font License. Its license is bundled as `DM-Sans-OFL.txt`.

The finite gesture selector uses [Lucide](https://github.com/lucide-icons/lucide) icons: `hand`, `hand-fist`, `pointer`, and `circle-slash`. Their SVGs and license are bundled under `gestures/`.

`coin.jpg` is copied from the user-provided `coin.jpeg` in the repository for the live playground example.

`topik.png` is the user-provided `TOPIK.png` logo. `topik-bench-results.png` is rendered from `topik-benchmark.html` using the results in [Rick Carlino’s TOPIK benchmark](https://rickcarlino.com/notes/korean-language/topik-bench-measuring-korean-ability-of-decision-models.html).
