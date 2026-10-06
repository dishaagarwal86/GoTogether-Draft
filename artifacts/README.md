# GoTogether landing-page concept

Open `gotogether-landing.html` directly in a browser. Photos, fonts, styles, and JavaScript are embedded. The interactive design runs without a server. Account, Explore, and planning links open the local app at `http://localhost:5173` when the artifact is opened as a local file.

The design is now the application homepage at `/`, and remains available at `/landing-concept`.

## Design direction

Preserve the existing coastal imagery, warm serif typography, and “The world feels better shared” idea. Give visitors a complete story: the desire to travel together, destination inspiration, the planning workflow, and the shared Travel DNA that differentiates the product.

- **Hero:** three manually selected landscapes, subtle pointer movement, a dimensional destination card, and a clear planning action.
- **Discovery:** mood filters and destination previews drawn from the existing itinerary collection.
- **Workflow:** start a quest, collect individual preferences, compare directions together.
- **Travel DNA:** an explicitly labelled sample crew, editable mood and budget, and a shared-fit result calculated by the existing `getScoredItineraries` helper. This is a demonstration, not a signed-in visitor’s personalised recommendation. The displayed fit includes the existing fairness weighting.
- **Closing sections:** a travel story, practical FAQs, and a final planning action. No fabricated testimonials or customer totals.

The layout adapts for mobile, includes a working menu, uses native modal dialogs and FAQ disclosures, and respects reduced-motion preferences.

## References

- [Seesaw](https://www.seesaw.website/): visual browsing and clear separation between image, title, and supporting information. Reviewed the live page and a browser capture.
- [MotionSites](https://motionsites.ai/): expressive hero composition and motion as a design layer. Reviewed the live page and a browser capture; some gallery previews did not load.
- [Tripo Studio](https://studio.tripo3d.ai/): a reference for dimensional objects and exploratory interaction. Public gallery content was accessible; the direct browser visit stopped at its verification screen. This concept uses lightweight CSS depth, not a Tripo-generated 3D model.

Destination photographs reuse the app’s existing image sources. The coast illustration is the repository’s existing `coast-hero.png`. Alpine imagery is destination inspiration, not a verified photograph of Interlaken. Fonts: DM Sans and Fraunces, from Google Fonts.

## Scope and current product boundaries

Source review covered the home, Explore, quest creation, preference persistence, overview, Group DNA, plan paths, authentication, and recommendation helper. The current recommendation flow uses demo travellers. This branch preserves the invitation and quest-detail routes already present on remote main; email delivery has not been exercised in this work. The landing-page artifact adds no booking, payment, invitation delivery, or AI API calls. Account and planning actions lead into the existing application.

## Rebuild

```sh
npm --prefix frontend install
node frontend/tools/build-landing-artifact.mjs
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

The editable implementation is in `frontend/src/pages/LandingConcept.tsx` and `frontend/src/css/LandingConcept.css`. `frontend/src/landing-artifact.tsx` is the standalone entry point. The artifact build leaves the ordinary application build unchanged.

## Verification

Frontend production build passed. Lint completed with existing warnings in `AuthContext.tsx` and `QuestionsPage.tsx`; no warnings were reported for the new files. Headless Chrome checks passed for destination filtering, preview open/close and Escape, mood and budget changes, landscape controls, FAQs, the mobile menu, and reduced motion. No horizontal overflow was found at 1440px, 390px, or 320px. No broken images or browser JavaScript errors were observed. The standalone HTML was opened through a file URL with external requests blocked; its embedded images, fonts, filters, and dialogs worked.

`landing-desktop.png`, `landing-mobile.png`, and `landing-hero.png` provide visual previews. Authentication, preference persistence, email delivery, and external integrations were not exercised.
