import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const places = require("../public/places.json");
export const choices = require("../public/choices.json");

const placeMap = new Map(places.map((item) => [item.country, new Set(item.places)]));
const nicheMap = new Map(choices.map((item) => [item.niche, new Set(item.products)]));

export function knownCountry(value) {
  return value === "" || placeMap.has(value);
}

export function knownPlace(country, place) {
  if (!place) return true;
  const set = placeMap.get(country);
  return Boolean(set && set.has(place));
}

export function knownNiche(value) {
  return value === "" || nicheMap.has(value);
}

export function knownProduct(niche, product) {
  if (!product) return true;
  const set = nicheMap.get(niche);
  return Boolean(set && set.has(product));
}
