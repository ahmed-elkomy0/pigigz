declare module "*.css";
declare module "*.webp";
declare module "*.png";
declare module "*.jpg";
declare module "*.js";

declare module "*.mjs" {
  export function mountMap(
    container: HTMLElement,
    options: Record<string, unknown>,
    onUnavailable: () => void,
  ): { selectPlace: (index: number | null) => void } | null;
  export function mountPlaceListMap(
    container: HTMLElement,
    options: Record<string, unknown>,
    onUnavailable: () => void,
  ): { selectPlace: (index: number | null) => void } | null;
}
