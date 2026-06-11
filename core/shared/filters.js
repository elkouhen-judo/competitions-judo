function eqFilter(column, value) {
  return `${column}=eq.${encodeURIComponent(String(value))}`;
}

module.exports = {
  eqFilter
};
