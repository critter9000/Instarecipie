# All My Meals — Product Requirements (PRD)

## Original problem statement
Mobile app to save recipes from social media (TikTok, Instagram, YouTube, websites)
by pasting a link/text; AI auto-organizes into ingredients & steps, translates foreign
recipes to English, calculates nutrition. Smart meal planner + shared household grocery list.
User asked for a mascot character.

## Architecture
- Frontend: Expo Router (React Native), React Query, @gorhom/bottom-sheet, expo-image,
  Feather icons, Lora (serif display) + Plus Jakarta Sans (UI) fonts. Warm terracotta theme.
- Backend: FastAPI + MongoDB (motor). Recipe extraction via emergentintegrations LlmChat
  (OpenAI gpt-5.4) using EMERGENT_LLM_KEY.
- No login: device-based Household with a 6-char share code; all data scoped by household_id.
  Soft deletes throughout (deleted_at).

## User personas
- Home cooks / families / students who collect viral recipes and want them organized,
  planned for the week, and turned into a shared grocery list.

## Core requirements (static)
- Import recipe from pasted link or text -> structured (title, description, category, tags,
  servings, times, per-serving nutrition, ingredients w/ grocery aisle, steps, translation).
- Recipe library with search + category chips; recipe detail with ingredients/steps segmented view.
- Weekly meal planner (14-day selector, 4 meal slots/day, add via recipe picker, remove).
- Shared grocery list grouped by aisle, check/complete, add custom item, add all from recipe,
  clear completed, contributor avatars.
- Household sharing via code (create/join/copy/share/leave), member avatars.
- Mascot "Basil" across onboarding + empty states.

## Implemented (2026-09-27)
- Full MVP: onboarding (create/join kitchen), Library, Import (AI), Recipe Detail
  (add to grocery, add to plan sheet), Planner, Grocery, Kitchen/sharing tabs.
- Backend endpoints for households, recipes (import/create/list/get/delete),
  mealplan, grocery (incl. from-recipe & clear-completed).
- Tested: 16/16 backend pytest + full frontend e2e flow passed, no functional bugs.

## Current work — Original source recipe photos
- User report: recipes have no photo from their original videos. Confirmed scope:
  repair existing recipes and new imports. User example: https://www.youtube.com/shorts/ysaHg7qzoK0.
- Root cause: reader markdown sometimes returned a YouTube webpage as image_url;
  missing images fell back to random stock photos or website logos.
- Added exact-ID YouTube thumbnails (Shorts/watch/short links/embed/live), verified
  JSON-LD Recipe/VideoObject photos and Open Graph/Twitter metadata. Image decoding,
  dimensions, size/type limits and public-address checks reject invalid candidates.
- Photos are saved in managed object storage and served through household/recipe-scoped
  /api image endpoints. Credentials and storage paths remain server-only.
- Versioned background migration repairs existing photos without altering recipe text;
  new imports resolve photos in background. Retry original photo action on details.
- Shared SourcePhoto component across cards/details/planner handles loading and failed
  images without substituting unrelated food pictures. React Query polls pending photos.
- Verified: 17/17 targeted backend tests passed (iteration_3.json). Mobile preview
  tested exact user Short import, image decoding, refresh, library/planner images,
  neutral missing-photo fallback, servings and grocery. Main additionally visually
  confirmed original thumbnails on both legacy pasta recipe and new fried-chicken Short.
- Public/private/deleted image-route checks and parser edge cases passed. Migration
  completed without re-extracting recipe text. No requested photo-flow failures found.
- Limitations: private/blocked/removed sources may not provide an accessible photo;
  these show unavailable with a refresh action, never an unrelated stock photo.
  Native-device verification remains a follow-up; testing used the mobile web preview.
- Also already implemented: servings scaler, source-video links, authoritative JSON-LD
  values where available. Nutrition without source data remains estimated.

## Backlog (prioritized)
- P1: Photo-scan of paper recipes (OpenAI vision) — "digitize grandma's recipes".
- P1: Audio/video import (Whisper) for spoken recipes.
- P1: Auto-generate a grocery list from the whole week's meal plan in one tap.
- P2: Improve servings scaler to also scale parenthetical alternate units.
- P2: Cook mode (step-by-step full screen with keep-awake).
- P2: Favorites / collections & recently viewed.
- P2: Pro tier (RevenueCat) — unlimited imports, ad-free.

## Next tasks
- P0: None outstanding for original-source photo fix (verified).
- P1: Reduce long recipe text import latency; current LLM extraction may exceed ingress timeout.
- P1: Audit existing unreadable-source recipe synthesis behavior; do not claim unverified ingredients are exact.
- P2: Existing third-party web shadow/pointerEvents warnings; consider additional backend router refactoring.
- Add weekly-plan -> grocery one-tap generation.
- Add photo-scan import path.
