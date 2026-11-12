/** Taille d'un lot d'identifiants dans un filtre `in`, pour borner la longueur de l'URL. */
export const ID_BATCH_SIZE = 100;

/** Filtre PostgREST « colonne dans la liste » ; les valeurs sont encodées pour l'URL. */
export function inFilter(column: string, values: unknown[]): string {
  return `${column}=in.(${values.map((value) => encodeURIComponent(String(value))).join(",")})`;
}

export function uniqueIds(values: unknown[] | null | undefined): string[] {
  return [...new Set((values || []).map(String).filter(Boolean))];
}

/** Lit une liste filtrée par identifiants : les lots partent en parallèle. */
export async function selectByIdBatches<T>(
  ids: unknown[] | null | undefined,
  selectBatch: (batchIds: string[]) => Promise<T[]>
): Promise<T[]> {
  const unique = uniqueIds(ids);
  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += ID_BATCH_SIZE) {
    batches.push(unique.slice(index, index + ID_BATCH_SIZE));
  }
  return (await Promise.all(batches.map(selectBatch))).flat();
}
