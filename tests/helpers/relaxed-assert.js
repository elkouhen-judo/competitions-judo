const assert = require("node:assert/strict");

// Bundler/formatter reflows can turn a single space into a line break, which would
// otherwise break literal-space regexes without any real behavior change.
function toWhitespaceTolerantRegex(pattern) {
  if (!(pattern instanceof RegExp)) {
    return pattern;
  }
  return new RegExp(pattern.source.replace(/ +/g, "\\s+"), pattern.flags);
}

module.exports = Object.assign(Object.create(assert), {
  match(value, pattern, message) {
    assert.match(value, toWhitespaceTolerantRegex(pattern), message);
  },
  doesNotMatch(value, pattern, message) {
    assert.doesNotMatch(value, toWhitespaceTolerantRegex(pattern), message);
  }
});
