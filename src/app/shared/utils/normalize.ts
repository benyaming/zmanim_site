import { JsLibZmanimBasicZmanim } from '@shared/types/zmanim';
import { ZmanimZmanimRequestDto } from '@core/zmanim';
import { omit } from 'ramda';

export const normalizeJsZmanimToAppZmanim = (
  json: JsLibZmanimBasicZmanim,
): void => {
  const stripped = omit(
    [
      'BeginAstronomicalTwilight',
      'AlosHashachar',
      'BeginNauticalTwilight',
      'BeginCivilTwilight',
    ],
    json,
  );
};
