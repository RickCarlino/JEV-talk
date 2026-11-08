# Run the talk

Requires Node.js 22 or newer. No dependencies to install.

```bash
cp .env.example .env
# Set TYPESAFE_API_KEY in .env.
npm run dev
```

Open the presenter URL printed in the terminal. **Open audience view** opens the audience deck in a browser tab. Drag that tab into its own window on the projector. Keep the presenter console on your screen.

## Edit your talk

Write in **README.md**. Section titles, paragraphs, examples, and WIP placeholders become speaker notes verbatim and in their original order. `npm run dev` watches the README and refreshes the notes automatically. `npm run sync-talk` also syncs them manually.

Images are mapped by section title in `public/deck.js`, so reordering sections preserves their visuals and the live demo. Add a mapping when introducing or renaming a heading; unknown headings receive a wordless fallback. Layout and controls are in `public/style.css` and `public/app.js`. Saved frontend edits reload browser windows automatically, except during a recording. Restart after changing `.env`; server restarts reset the scene, timer, and remote link.

## Present live webpages

Open the audience deck in a normal browser window on the projected display. If it opens beside the presenter tab, drag the audience tab into its own window and move that window to the projector. Pin the deck as the first tab.

Before the talk, move the mouse over the audience view and click **Live pages** at the top right (or press **L**). Open each site once, sign in, verify the shared Jev example, and leave the tabs open. This is a manual preflight: the deck cannot inspect logins or guarantee a third-party site is available. The coin image is bundled locally, even without internet.

During the talk, switch to the already-open site tab. The relevant slides also have a small live-page link if you need to reopen a site. Click those links on the **audience display**; links in speaker notes open on the presenter display. Native tabs allow login redirects, uploads, and interactive pages without iframe restrictions. Repeated link clicks open more tabs, so reuse the preopened tabs to preserve your playground state.

Return to the pinned deck with **Ctrl+1** (Windows/Linux) or **Cmd+1** (Mac); then advance the slide. **Ctrl+Tab** / **Ctrl+Shift+Tab** cycle through browser tabs. Remote presenter navigation continues updating the deck behind the site, but cannot switch browser tabs or control external pages. The deck's B blackout and arrow keys apply only when the deck is active.

Use **F11 browser fullscreen** (or the browser's View menu on Mac) for tab-based presentation. The deck's F key uses page fullscreen; press Esc before switching tabs. If a live site fails or internet drops, return to the deck and continue with its local fallback image.

The Jev and OpenAI speaker notes include **Copy coin image**, **Download coin.jpg**, and **Open image**. Copy pastes an actual PNG image into the playground. If the browser blocks clipboard access, download the JPEG and drag it into the page. The main-show notes retain your State → Questions → Response sequence and the JSON-view reminder.

For a recording that includes live sites, capture the **audience browser window or projected display**, not just the deck tab. The built-in recording settings now offer that choice. Neither the camera bubble nor slide blackout overlays external browser tabs.

## Record a video draft

1. Click **Video draft** in the presenter console. It opens the audience window's recording settings. You can also press **V** in the audience window.
2. Enable **Show my camera on slides** and allow camera access. Choose either bottom corner and check your framing. This is a circular camera crop, including your background.
3. Leave **Include my microphone** checked for narration. Click **Start recording**, choose the **audience browser window or display** for a talk with live webpages (or **this audience tab** for slides only), and allow the microphone. Use a desktop browser that supports tab capture and MediaRecorder, such as Chrome or Edge. Keep the audience tab visible on a second monitor or in its own window while navigating from the presenter console.
4. Run through the talk. Ordinary slides dissolve; the camera bubble fades out when entering Demo, which has its own reveal. Click **Start demo** from the presenter console to run inference. The demo shares the camera already in use by your bubble; after leaving Demo, the bubble returns. Navigation alone does not start paid calls.
5. Click **Stop recording** in the presenter console, press **Shift + R** in the audience window, or use the browser's stop-sharing control. The take downloads as MP4 when supported, otherwise WebM. **Download last take** remains available until the audience page is closed or reloaded. Check the downloaded file before sending it to your friend.

Recording includes the selected surface and microphone; choose the audience browser window or display for live webpages, or the audience tab for slides only. Keep the presenter console on a separate display. The recording controls hide during the take. Camera, microphone, and draft video remain in your browser; only live demo frames go to Jev. Recording keeps the take in memory until you stop, so use it for short drafts. Deck edits are deferred during recording; reload before another take if you edited files. Stopping a recording releases screen sharing and the microphone; uncheck the camera option to release the overlay camera too. For a long recording or an edited final video, the same audience view can be captured in OBS.

## Use the demo

1. Select **Demo**.
2. Click **Start demo**. With your configured key, this starts live Jev and the camera in the audience window.
3. Allow camera access. Show an open palm, a fist, or point.

**Pause** stops model calls. **Stop** releases the camera. Prompt editing and sample data are under **Settings** in the presenter console. Sample data is separate from the live start button.

The audience screen is a presentation slide: large cents and FPS readouts, the camera, and one large answer for Noul, Score, and Choice. Prompt editing, request counts, and controls stay in the presenter console. Use the presenter controls to Pause/Stop and F in the audience window for fullscreen.

Choice shows the whole finite option set as a fixed selector: palm, fist, pointing, and other. All four pictograms remain visible, with the selected stop lit orange and its exact answer below. Edited option sets stay in their configured order; unfamiliar labels use numbered positions rather than an incorrect gesture icon.

**Realtime** is enabled by default: each frame request starts as soon as the preceding request finishes, with one upstream request in flight across all tabs. Uncheck Realtime in the presenter’s Demo controls to use the previous 1 FPS cadence. The audience header displays measured FPS and estimated cents. Keep the audience window open; it hosts the camera and inference loop.

The server stops after **10,000 outbound Jev attempts**, including failed requests, timeouts, and retries. All tabs share this counter. Refreshing, Pause/Start, and mode changes do not reset it. At the limit, the camera stops and Start is disabled. A server restart resets the counter.

Provider `Retry-After` (seconds or HTTP date), `retry-after-ms`, and exhausted quota/reset headers delay the next attempt, including when returned with a successful response. HTTP 429, 529, and 503 responses retry after the required cooldown, with exponential backoff when no longer delay is specified. The server enforces cooldowns across tabs; blocked local attempts never call Jev or consume the request budget. See [TypeSafe retry policy](https://docs.typesafe.ai/sdk/python/api/retries).

The app sends 640 × 480 JPEG frames to Jev with Noul, Score, Choice, and a hand Box in one request. The last hand box stays over the mirrored video between results. It is shown only when the hand-visible Noul probability is above 50%, and clears on a missing hand or invalid box. The presenter camera preview shows it too. Image input is experimental. The API key stays on the server; frames are not saved to disk. Ordinary slides work offline with bundled photos and fonts.

The cents counter is estimated USD spend since the server started. It sums the API's reported billable input tokens, including image tokens, at Jev's published $0.042 per million input tokens; output tokens are free. It updates in both views, survives browser refreshes, and keeps counting across Pause/Start. Restarting the server resets it. Override `TYPESAFE_INPUT_USD_PER_MILLION` in `.env` if your rate differs. Hover over the counter for token and request totals. Missing usage is shown as unavailable or a lower bound, never counted as a free request. Sources: [usage](https://docs.typesafe.ai/api/system-one), [pricing](https://typesafe.ai/), [image tokens](https://docs.typesafe.ai/images).

## Controls

- Left / right arrows, Page Up / Page Down, Space: navigate.
- Home / End: first / last scene.
- B: audience blackout.
- F: fullscreen.
- Footer: talk timer.

For phone controls, set `HOST=0.0.0.0` in `.env`, restart, and copy the **Remote control** link. Use the same network. Keep the camera audience window on the host computer: camera access needs localhost or HTTPS.

## Checks

```bash
npm run check
npm test
```

Checks include exact agreement with the README, slide assets, session authorization, navigation synchronization, settings validation, no-key sample mode, and the Jev image request format. Tests use fake model responses and incur no API charges.

Photo and font sources are in `public/assets/CREDITS.md`.

## Local files and source control

Keep `.env` private; use `.env.example` for configuration defaults. Recordings, browser-test output, caches, and local drafts under `output/` are ignored. Bundled assets in `public/assets/` are the canonical slide files; their attribution and third-party licenses are kept alongside them.
