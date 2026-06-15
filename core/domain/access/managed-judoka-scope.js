function createManagedJudokaScope(judokaIds = []) {
  const ids = judokaIds.map((id) => String(id));

  return {
    ids,
    includes(judokaId) {
      return ids.includes(String(judokaId));
    },
    toIds() {
      return [...ids];
    }
  };
}

module.exports = {
  createManagedJudokaScope
};
