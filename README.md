# Recipe Book

A personal recipe app for saving recipes you find on Instagram. Paste the post link and its caption (and optionally upload the video), click **Parse with AI**, and it extracts a title, category, ingredient list, and steps automatically (via the Claude API, using vision to read on-screen text in video frames). Recipes sync across your devices through Firebase.

No build step, no server — plain HTML/CSS/JS, deployable straight to GitHub Pages.

## One-time setup

### 1. Create a Firebase project (for cross-device sync)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (free "Spark" plan is enough).
2. In the project, go to **Build → Firestore Database → Create database** (start in production mode, pick any region).
3. Go to **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**. This lets the app authenticate silently without a login screen.
4. Go to **Project settings (gear icon) → General → Your apps → Add app → Web (</>)**. Register the app (no hosting needed) and copy the config values shown (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
5. Go to **Firestore Database → Rules** and set:

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

   This means only signed-in (even anonymously) requests from your app can read/write — not the whole internet.

### 2. Get an Anthropic API key (for AI parsing)

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an API key.
2. Parsing a caption costs a fraction of a cent per recipe.

### 3. Configure the app

Open the site, click the ⚙ **Settings** button, and paste in the Firebase config values and your Anthropic API key. These are stored only in your browser's local storage — they are never written to any file in this repo, so it's safe to make the repo public.

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

Each device you use it from (phone, laptop) needs the Settings filled in once — after that, recipes sync automatically through Firestore.

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
