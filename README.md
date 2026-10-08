# Story2Video AI — hosted deployment (Render, no terminal needed)

Files: `index.html` (the app) · `server.js` (serves the app + image API, holds the key) · `package.json` · `render.yaml` · `e2e-test.js` (optional)

## Deploy (about 10 minutes)
1. **GitHub:** github.com → New repository → name it `story2video-ai`, set **Private** → "uploading an existing file" → drag in these 5 files: `index.html`, `server.js`, `package.json`, `render.yaml` (and this README) → Commit. Do NOT add any key to these files.
2. **Render:** render.com → sign up with GitHub → **New + → Blueprint** → pick the repo → Render reads `render.yaml`.
3. **Add your secrets here (the only place the key goes):** Render shows a form asking for two values before it deploys:
   - `OPENAI_API_KEY` → paste your OpenAI key (platform.openai.com → API keys)
   - `ACCESS_PASSWORD` → choose a strong password (protects the site so strangers can't spend your credits)
   Later you can change them at: Render dashboard → your service → **Environment**.
4. Click **Apply**. When the deploy shows "Live", open the URL Render gives you (`https://story2video-ai-xxxx.onrender.com`).
5. **Check:** open `<your URL>/health` → should show `"keyConfigured":true,"model":"gpt-image-2.5-sunburst"`.
6. The browser asks for a login: any username, the `ACCESS_PASSWORD` you set.

## The one real test (in the app)
1. Story page → paste: *Kaashi and Vrinda were playing in the courtyard. Their grandmother, whom Kaashi called Nani, came outside and called them for lunch. Later, Vrinda went to Nani and asked her for a story. Grandmother smiled and told both girls a story.* → **Analyze Story**.
2. Production page → on scene 1 press **Generate Image**. The button shows "Reference: Kaashi…", "Reference: Vrinda…", then "Generating…".
3. Success = an image appears in the scene preview. Then generate scene 2 and compare the characters.

## Notes
- Free Render services sleep after ~15 min idle (first request is slow) and may lose saved images on restart; the app regenerates missing portraits automatically.
- Change model: Environment → `IMAGE_MODEL` (e.g. `gpt-image-2.5-flare` for faster/cheaper). Spend guard: `MAX_IMAGES_PER_HOUR` (default 60).
- If a request fails, the error names a category (invalid_api_key, organization_not_verified, quota_or_billing, rate_limited, model_not_found, content_policy, invalid_request…).
