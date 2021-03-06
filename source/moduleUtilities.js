function valueType(value) {
  if (value === null)
    return "primitive";
  const type = typeof value;
  if ((type != "function") && (type != "object"))
    return "primitive";
  return type;
}

var ShadowKeyMap = new WeakMap();

/**
 * Define a shadow target, so we can manipulate the proxy independently of the
 * original target.
 *
 * @argument value {Object} The original target.
 *
 * @returns {Object} A shadow target to minimally emulate the real one.
 * @private
 */
function makeShadowTarget(value) {
  "use strict";
  var rv;
  if (typeof value == "object")
    rv = {};
  else if (typeof value == "function") {
    rv = function() {};
    /* ES7 specification says that functions in strict mode do not have their
     * own "arguments" or "length" properties naturally.  But in non-strict
     * code, V8 adds those properties.  (Mozilla adds them for both strict code
     * and non-strict code, which technically is a spec violation.)  So to make
     * the membrane code work correctly with shadow targets, we start with the
     * minimalist case (strict mode explicitly on), and add missing properties.
     */
    let keys = Reflect.ownKeys(value);
    keys.forEach(function(key) {
      if (Reflect.getOwnPropertyDescriptor(rv))
        return;
      let desc = Reflect.getOwnPropertyDescriptor(value, key);
      Reflect.defineProperty(rv, key, desc);
    });
  }
  else
    throw new Error("Unknown value for makeShadowTarget");
  ShadowKeyMap.set(rv, value);
  return rv;
}

function getRealTarget(target) {
  return ShadowKeyMap.has(target) ? ShadowKeyMap.get(target) : target;
}

function inGraphHandler(trapName, callback) {
  return function() {
    let mayLog = this.membrane.__mayLog__();

    this.membrane.handlerStack.unshift(trapName);
    if (mayLog) {
      this.logger.trace(
        trapName + " inGraphHandler++",
        this.membrane.handlerStack.length - 2
      );
    }

    var rv;
    try {
      rv = callback.apply(this, arguments);
    }

    // We might have a catch block here to wrap exceptions crossing the membrane.

    finally {
      this.membrane.handlerStack.shift();
      if (mayLog) {
        this.logger.trace(
          trapName + " inGraphHandler--",
          this.membrane.handlerStack.length - 2
        );
      }
    }

    return rv;
  };
}

const NOT_YET_DETERMINED = {};
Object.defineProperty(
  NOT_YET_DETERMINED,
  "not_yet_determined",
  new DataDescriptor(true)
);

/**
 * Helper function to determine if anyone may log.
 * @private
 *
 * @returns {Boolean} True if logging is permitted.
 */
// This function is here because I can blacklist moduleUtilities during debugging.
function MembraneMayLog() {
  return (typeof this.logger == "object") && Boolean(this.logger);
}

function AssertIsPropertyKey(propName) {
  var type = typeof propName;
  if ((type != "string") && (type != "symbol"))
    throw new Error("propName is not a symbol or a string!");
}
