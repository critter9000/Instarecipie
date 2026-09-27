import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Ingredient = { name: string; quantity: string; aisle: string };

export type Recipe = {
  id: string;
  household_id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: string;
  tags: string[];
  servings: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: Ingredient[];
  steps: string[];
  translated_from: string | null;
  source_url: string | null;
  source_type: string;
  created_by: string | null;
  created_at: string;
};

export type Member = { id: string; name: string; color: string };
export type Household = {
  id: string;
  code: string;
  name: string;
  members: Member[];
};

export type MealPlanEntry = {
  id: string;
  date: string;
  meal_type: string;
  recipe_id: string;
  recipe_title: string;
  recipe_image: string | null;
};

export type GroceryItem = {
  id: string;
  name: string;
  quantity: string;
  aisle: string;
  checked: boolean;
  added_by: string | null;
  recipe_id: string | null;
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------
async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------
export function createHousehold(name: string, member_name: string) {
  return req<{ household: Household; member_id: string }>("/households", {
    method: "POST",
    body: JSON.stringify({ name, member_name }),
  });
}

export function joinHousehold(code: string, member_name: string) {
  return req<{ household: Household; member_id: string }>("/households/join", {
    method: "POST",
    body: JSON.stringify({ code, member_name }),
  });
}

export function useHousehold(hid?: string) {
  return useQuery({
    queryKey: ["household", hid],
    queryFn: () => req<Household>(`/households/${hid}`),
    enabled: !!hid,
  });
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------
export function useRecipes(hid?: string, category = "All", q = "") {
  return useQuery({
    queryKey: ["recipes", hid, category, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      return req<Recipe[]>(`/households/${hid}/recipes?${params.toString()}`);
    },
    enabled: !!hid,
  });
}

export function useRecipe(rid?: string) {
  return useQuery({
    queryKey: ["recipe", rid],
    queryFn: () => req<Recipe>(`/recipes/${rid}`),
    enabled: !!rid,
  });
}

export function useImportRecipe(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { source: string; member_id?: string }) =>
      req<Recipe>(`/households/${hid}/recipes/import`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rid: string) => req(`/recipes/${rid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

// ---------------------------------------------------------------------------
// Meal plan
// ---------------------------------------------------------------------------
export function useMealPlan(hid?: string, start?: string, end?: string) {
  return useQuery({
    queryKey: ["mealplan", hid, start, end],
    queryFn: () =>
      req<MealPlanEntry[]>(
        `/households/${hid}/mealplan?start=${start}&end=${end}`,
      ),
    enabled: !!hid && !!start && !!end,
  });
}

export function useAddMeal(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { date: string; meal_type: string; recipe_id: string }) =>
      req<MealPlanEntry>(`/households/${hid}/mealplan`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mealplan"] }),
  });
}

export function useDeleteMeal(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mid: string) => req(`/mealplan/${mid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mealplan"] }),
  });
}

// ---------------------------------------------------------------------------
// Grocery
// ---------------------------------------------------------------------------
export function useGrocery(hid?: string) {
  return useQuery({
    queryKey: ["grocery", hid],
    queryFn: () => req<GroceryItem[]>(`/households/${hid}/grocery`),
    enabled: !!hid,
  });
}

export function useAddGrocery(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      quantity?: string;
      aisle?: string;
      added_by?: string;
    }) =>
      req<GroceryItem>(`/households/${hid}/grocery`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }),
  });
}

export function useGroceryFromRecipe(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { recipe_id: string; member_id?: string }) =>
      req<{ added: number }>(`/households/${hid}/grocery/from-recipe`, {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }),
  });
}

export function useToggleGrocery(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; checked: boolean }) =>
      req<GroceryItem>(`/grocery/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checked: vars.checked }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }),
  });
}

export function useDeleteGrocery(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => req(`/grocery/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }),
  });
}

export function useClearCompleted(hid?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      req(`/households/${hid}/grocery/completed`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grocery"] }),
  });
}

export const CATEGORIES = [
  "All",
  "Dinner",
  "Lunch",
  "Breakfast",
  "Quick",
  "Healthy",
  "Vegan",
  "Vegetarian",
  "Dessert",
  "Baking",
  "Snack",
];

export const AISLE_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy",
  "Bakery",
  "Pantry",
  "Spices",
  "Frozen",
  "Beverages",
  "Other",
];
