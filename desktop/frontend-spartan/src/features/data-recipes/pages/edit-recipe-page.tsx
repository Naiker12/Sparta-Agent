import { useT as useUiT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { type RecipePayload, RecipeStudioPage } from "@/features/recipe-studio";
import { useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  getCachedRecipe,
  getRecipe,
  primeRecipeCache,
  saveRecipe,
} from "../data/recipes-db";
import type { RecipeRecord } from "../types";

type EditRecipePageProps = {
  recipeId: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; record: RecipeRecord };

function RecipeLoadState({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}): ReactElement {
  const uiT = useUiT();

  return (
    <div className="min-h-[calc(100dvh-var(--studio-titlebar-height,0px))] bg-background">
      <main className="mx-auto flex min-h-[70dvh] w-full max-w-4xl items-center justify-center px-6 py-8">
        <div className="w-full rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={onBack}
          >
            {uiT("ui.back_to_recipes")}</Button>
        </div>
      </main>
    </div>
  );
}

export function EditRecipePage({
  recipeId,
}: EditRecipePageProps): ReactElement {
  const uiT = useUiT();

  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>(() => {
    const cachedRecipe = getCachedRecipe(recipeId);
    if (cachedRecipe) {
      return { status: "ready", record: cachedRecipe };
    }
    return { status: "loading" };
  });

  useEffect(() => {
    let active = true;
    const cachedRecipe = getCachedRecipe(recipeId);
    if (cachedRecipe) {
      setLoadState({ status: "ready", record: cachedRecipe });
    } else {
      setLoadState({ status: "loading" });
    }

    void getRecipe(recipeId).then((record) => {
      if (!active) {
        return;
      }
      if (!record) {
        setLoadState({ status: "missing" });
        return;
      }
      primeRecipeCache(record);
      setLoadState({ status: "ready", record });
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  const handlePersist = useCallback(
    async (input: {
      id: string | null;
      name: string;
      payload: RecipePayload;
    }) => {
      const record = await saveRecipe({
        id: input.id ?? recipeId,
        name: input.name,
        payload: input.payload,
      });
      primeRecipeCache(record);
      return { id: record.id, updatedAt: record.updatedAt };
    },
    [recipeId],
  );

  if (loadState.status === "loading") {
    return (
      <RecipeLoadState
        title={uiT("ui.loading_recipe")}
        description={uiT("ui.please_wait_while_we_load_your_recipe")}
        onBack={() => void navigate({ to: "/data-recipes" })}
      />
    );
  }

  if (loadState.status === "missing") {
    return (
      <RecipeLoadState
        title={uiT("ui.recipe_not_found")}
        description={uiT("ui.this_recipe_may_have_been_deleted")}
        onBack={() => void navigate({ to: "/data-recipes" })}
      />
    );
  }

  return (
    <RecipeStudioPage
      key={loadState.record.id}
      recipeId={loadState.record.id}
      initialRecipeName={loadState.record.name}
      initialPayload={loadState.record.payload}
      initialSavedAt={loadState.record.updatedAt}
      onPersistRecipe={handlePersist}
    />
  );
}
