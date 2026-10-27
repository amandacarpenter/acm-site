// Preview-only dependency adapter: warn once, without browser persistence.
module.exports = function deprecate(fn, message) {
  let warned = false;
  return function (...args) {
    if (!warned) {
      console.warn(message);
      warned = true;
    }
    return fn.apply(this, args);
  };
};
