export function enumKeys<T>(e: T): (keyof T)[] {
  return Object.keys(e).filter((key) => !(parseInt(key) >= 0)) as (keyof T)[];
}
