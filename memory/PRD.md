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

## Backlog (prioritized)
- P1: Photo-scan of paper recipes (OpenAI vision) — "digitize grandma's recipes".
- P1: Audio/video import (Whisper) for spoken recipes.
- P1: Auto-generate a grocery list from the whole week's meal plan in one tap.
- P2: Servings scaler that recalculates ingredient quantities & nutrition.
- P2: Cook mode (step-by-step full screen with keep-awake).
- P2: Favorites / collections & recently viewed.
- P2: Pro tier (RevenueCat) — unlimited imports, ad-free.

## Next tasks
- Add weekly-plan -> grocery one-tap generation.
- Add photo-scan import path.
