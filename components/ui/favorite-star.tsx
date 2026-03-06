"use client";

import { Star } from "lucide-react";
import { useFavoritesStore, FavoriteItem } from "@/lib/favorites-store";
import { cn } from "@/lib/utils";

interface FavoriteStarProps {
  item: FavoriteItem;
  className?: string;
}

export function FavoriteStar({ item, className }: FavoriteStarProps) {
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  const starred = isFavorite(item.id);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleFavorite(item);
        }
      }}
      className={cn(
        "transition-all duration-200 hover:scale-110 cursor-pointer",
        starred ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400/70",
        className
      )}
      title={starred ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      <Star
        className={cn("h-3.5 w-3.5", starred && "fill-amber-400")}
      />
    </span>
  );
}