import type { ManagedJudokaScope } from "../../types";

export function createManagedJudokaScope(judokaIds: unknown[] = []): ManagedJudokaScope {
  const ids = judokaIds.map((id) => String(id));

  return {
    ids,
    includes(judokaId: unknown): boolean {
      return ids.includes(String(judokaId));
    },
    toIds(): string[] {
      return [...ids];
    }
  };
}
