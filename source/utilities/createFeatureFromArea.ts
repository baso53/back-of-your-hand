/*
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Project: Back Of Your Hand (https://backofyourhand.com)
 * Repository: https://github.com/adam-lynch/back-of-your-hand
 * Copyright © 2024 Adam Lynch (https://adamlynch.com)
 */

import * as turf from "@turf/turf";
import type * as GeoJSON from "geojson";
import type { Area } from "../api/resourceObjects";

export default function createFeatureFromArea(
  area: Area,
): GeoJSON.Feature<GeoJSON.Polygon> {
  return turf.feature(area.attributes.shape as unknown as GeoJSON.Feature);
}
