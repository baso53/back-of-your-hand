import convertOverpassLatLngtoLatLng from "./convertOverpassLatLngtoLatLng";
import getRandomItem from "./getRandomItem";
import type { LatLng, Overpass, Question } from "./types";

import ignoreError from "./ignoreError";
import exclusions from "./exclusions";

// Return a value between 180 and 180
const capLng = (input: number): number => {
  let result = input;
  while (result < -180) {
    result += 360;
  }
  while (result > 180) {
    result -= 360;
  }
  return result;
};

// Convert to our type, join with other streets of the same name, etc.
const adjustStreetDetails = (
  streetElement: Overpass.Element,
  allStreetElements: Overpass.Element[]
): Question["street"] => {
  // Group all streets with the same name
  const points = [
    streetElement,
    ...allStreetElements.filter(
      (element) =>
        element.id !== streetElement.id &&
        element.tags.name === streetElement.tags.name
    ),
  ].map(({ geometry }) => geometry.map(convertOverpassLatLngtoLatLng));

  return {
    // `name:ga` is the Irish name (ga = "Gaeilge")
    alternativeName: streetElement.tags["name:ga"]
      ? streetElement.tags.name
      : null,
    name: streetElement.tags["name:ga"] || streetElement.tags.name,
    points,
  };
};

// Actually get the data. Try localStorage, fallback to hitting OpenStreetMap's Overpass API
const load = async (areaBounds, centerLatLng: LatLng, radius: number) => {
  // Setting the bounding box is important. It massively speeds up the query
  let bboxValue = [
    areaBounds.getNorthWest().lat,
    capLng(areaBounds.getNorthWest().lng),
    areaBounds.getSouthEast().lat,
    capLng(areaBounds.getSouthEast().lng),
  ].join(",");

  // We don't want highway=bus_stop, for example
  const highwayValuesAllowed = [
    "cycleway",
    "living_street",
    "motorway",
    "pedestrian",
    "primary",
    "residential",
    "secondary",
    "service",
    "steps",
    "tertiary",
    "trunk",
    "unclassified",
  ];
  const highwayRegex = `^(${highwayValuesAllowed.join("||")})$`;

  /*
    This queries Overpass using the Overpass query lanaguage. It's basically saying give me all
    streets with a name within N metres around M center point. It also specifies the minimal
    properties we need in the response.
  */
  const urlPath = `api/interpreter?data=[out:json][bbox:${bboxValue}];(way(around:${radius},${
    centerLatLng.lat
  },${capLng(
    centerLatLng.lng
  )})[highway~"${highwayRegex}"][name];);out%20tags%20geom;`;

  // If the query changes, the "cache" is automatically skipped
  const localStorageKey = `overpass-response__${urlPath})`;
  const responseFromLocalStorage = ignoreError(() =>
    localStorage.getItem(localStorageKey)
  );

  // Prune localStorage
  Object.entries(localStorage)
    .map(([key]) => key)
    .filter(
      (key) => key !== localStorageKey && key.startsWith("overpass-response__")
    )
    .forEach((key) => ignoreError(() => localStorage.removeItem(key)));

  if (responseFromLocalStorage) {
    try {
      return JSON.parse(responseFromLocalStorage);
    } catch (e) {
      // Ignore and continue to query API
    }
  }

  const response = await fetch(`https://www.overpass-api.de/${urlPath}`);
  let result;
  try {
    result = await response.json();
  } catch (e) {
    throw new Error("Cannot parse Overpass API response");
  }
  ignoreError(() =>
    localStorage.setItem(localStorageKey, JSON.stringify(result))
  );
  return result;
};

export default async (
  areaBounds,
  centerLatlng: LatLng,
  radius: number,
  getRandomNumber: () => number,
  numberOfStreets: number
): Promise<Question["street"][]> => {
  // Get the data
  const { elements } = (await load(
    areaBounds,
    centerLatlng,
    radius
  )) as Overpass.Response;

  const results = [];
  const namesToExclude = exclusions;

  // Pot for drawing streets from.
  const pot = {};

  // Iterate through all items, filter them based on the exclusion criteria
  // and add them to the pot without duplicates.
  for (let element of elements) {
    const key = element.tags.name?.toLowerCase();

    if (!namesToExclude.includes(key)) {
      pot[key] = element;
    }
  }

  for (let i = 0; i < numberOfStreets; i++) {
    // Pick a random street from the pot.
    const key = getRandomItem(Object.keys(pot), getRandomNumber);

    /*
      This will happen if there are less than the desired amount of (uniquely named) streets in the area.
      It's the caller's responsibility to handle this case.
    */
    if (!key) {
      break;
    }

    // Add the street to the results.
    results.push(pot[key]);

    // Remove the street from the pot.
    delete pot[key];
  }

  // Convert to our type, join with other streets of the same name, etc.
  return results.map((result) => adjustStreetDetails(result, elements));
};
