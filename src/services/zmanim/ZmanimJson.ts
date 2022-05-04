import { getZmanimJson, JsonOutput, Options } from 'kosher-zmanim';

export const zmanimJson = (options: Options): Promise<JsonOutput> =>
  new Promise((resolve, reject) => {
    try {
      const zmanim = getZmanimJson(options);
      resolve(zmanim);
    } catch (error) {
      reject(error);
    }
  });
