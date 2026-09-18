# Recipe Book

A personal recipe app for saving recipes you find on Instagram. Paste the post link and its caption (and optionally upload the video), click **Parse with AI**, and it extracts a title, category, ingredient list, and steps automatically (via the Claude API, using vision to read on-screen text in video frames). Recipes sync across your devices through Firebase.

No build step, no server — plain HTML/CSS/JS, deployable straight to GitHub Pages.

## One-time setup

Firebase is already wired up and baked into the app (config in [app.js](app.js) — this is safe to commit; Firebase's web config isn't a secret, access is controlled by the Firestore security rules below, not by hiding it). Nothing to configure there.

The only thing each device needs is an Anthropic API key, for the AI parsing step:

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an API key.
2. Open the site, click the ⚙ **Settings** button, and paste it in. It's stored only in that browser's local storage — never written to the repo.
3. Parsing a recipe costs a fraction of a cent.

### Firestore security rules (already applied)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recipes/{recipeId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This means only signed-in (even anonymously, which the app does automatically) requests can read/write — not the whole internet. If you ever fork this for your own Firebase project, swap the `FIREBASE_CONFIG` object in `app.js` and re-apply this rule.

## Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "Initial recipe book"
git branch -M main
git remote add origin https://github.com/<your-username>/recipe-book.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from branch → main / (root)**. Your app will be live at `https://<your-username>.github.io/recipe-book/`.

Each device you use it from (phone, laptop) needs its Anthropic key entered in Settings once — after that, recipes sync automatically through Firestore, no further setup needed.

## How adding a recipe works

1. Click **+ Add Recipe**.
2. Paste the Instagram post/reel link.
3. Paste the caption text (open the post → "more" → copy the caption). Most recipe accounts put the ingredient list and steps right in the caption.
4. Optionally, upload the video file itself (save/download it from Instagram first). The app pulls a handful of frames from it and sends them to Claude's vision so it can read any on-screen ingredient/step text. The video file is only used in your browser for this — it isn't uploaded anywhere or stored.
5. Click **✨ Parse with AI** — it fills in the title, category, ingredients, and steps from whichever of caption/video you provided.
6. Review and correct anything before saving (AI parsing isn't perfect, especially for captions/videos that don't spell out quantities or steps clearly).
7. Save. It appears in your grid, filterable by category and searchable by title/ingredient.

## Notes / limitations

- There's no way to auto-fetch the caption or video from the link itself — Instagram doesn't provide a public API for that, so pasting the caption / uploading the video manually is the reliable step.
- Video support only reads **on-screen text** in frames (via Claude's vision) — it does not transcribe spoken narration. If a recipe is only spoken aloud with no on-screen text or caption, you'll need to type it in manually. (Audio transcription is possible but needs a backend proxy since transcription APIs block direct browser calls — not included here to keep this a pure static site with no billing setup.)
- The Anthropic API key is used directly from the browser. Keep this app private to yourself (don't share the URL with the key pre-filled) since anyone with access to your browser's local storage on a shared device could see it.
