import { FIELD_STAGE } from './field-stage.js';
import { WIND_STAGE } from './wind-stage.js';
import { WATER_STAGE } from './water-stage.js';
import { CITY_STAGE } from './city-stage.js';
import { STAR_STAGE } from './star-stage.js';

export const STAGES = [FIELD_STAGE, WIND_STAGE, WATER_STAGE, CITY_STAGE, STAR_STAGE];
export function getStage(id) {
  return STAGES.find((s) => s.id === id) || STAGES[0];
}
