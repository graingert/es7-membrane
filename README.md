[![Build Status](https://travis-ci.org/ajvincent/es7-membrane.svg?branch=master)](https://travis-ci.org/ajvincent/es7-membrane)

# The concepts driving a membrane

Suppose you have a set of JavaScript-based constructors and prototypes.  You've built it out, tested it, and ensured it works correctly.  But you don't necessarily trust that other people will use your API as you intended.  They might try to access or overwrite member properties you want to keep private, for example.  Or they might replace some of your methods with others.  While you can't keep people from forking your code base, at runtime you have some options.

The simplest option is to **freeze** what you can, so that certain values can't be changed:

```javascript
Object.freeze(MyBase.prototype);
```

Another, older technique would be to return one object that maps to another:

```javascript
function PrivateFoo() {
  // ...
}
PrivateFoo.prototype = {
  // ...
}

function Foo(arg0, arg1, arg2) {
  var pFoo = new PrivateFoo(arg0, arg1, arg2);
  return {
    method1: function() { return pFoo.method1.apply(pFoo, arguments); },
    get property2: () {
      return pFoo.property2;
    },
    // etc., etc.
  };
}
```

This is called a **closure**, but it's a painful way of hiding data, plus it's not very scalable.  You could make it work, at great effort...

What people really wanted, though, begins with the concept of a **proxy**.  By this, I do not mean a networking proxy, but a proxy to a JavaScript object or function.  This type of proxy allows you to represent an object, but change the rules for looking up properties, setting them, or executing functions on-the-fly.  For example, if I wanted an object to _appear_ to have an extra property "id", but not actually give that object the property, I could use a proxy, as follows:

```javascript
var handler = {
  getOwnPropertyDescriptor: (target, propName) {
    if (propName === "id")
      return {
        value: 3,
        writable: false,
        enumerable: true,
        configurable: true
      };

    return Reflect.getOwnPropertyDescriptor(target, propName);
  }
}

var x = {}; // a vanilla object

var p = new Proxy(x, handler);

p.id // returns 3
x.id // returns undefined
```

All well and good.  Next, suppose you want to return a reference to an object from x:
```javascript
// ...
var x = new xConstructor();
x.y = { x: x };

var p = new Proxy(x, handler);
p.y; // returns x.y
```

Uh-oh.  x.y is not in a proxy at all:  we (and everyone else) has full access through y to whatever y implements.  We'd be better off if p.y was itself a proxy.

The good news is that a proxy can easily return another proxy.  In this case, the getOwnPropertyDescriptor "trap" implemented on the handler would replace the value property of the object with a proxy.

So let's suppose that we did that.  All right:

```javascript
// ...
var x = new xConstructor();
x.y = { x: x };

var p = new Proxy(x, handler);
p.y; // returns Proxy(x.y, handler);
p.y.x; // returns Proxy(x.y.x, handler);
p.y.x === p; // returns false
p.y.x === p.y.x; // returns false

x.y.x === x; // returns true
```

Uh-oh again.  The x.y.x value is a cyclic reference that refers back to the original x.  But that identity property is _not_ preserved for p, which is a proxy of x... at least, not with the simplest "getOwnPropertyDescriptor" trap.  No, we need something that stores a one-to-one relationship between p and x... and for that matter defines one-to-one relationships between each natural object reachable from x and their corresponding proxy reachable from p.

This is where a **WeakMap** comes in.  A WeakMap is an object that holds references from key objects (non-primitives) to other values.  The important distinction between a WeakMap and an ordinary JavaScript object `{}` is that the keys in a WeakMap can be objects, but an ordinary JS object only allows strings for its keys.

At this point, logically, you have two related sets, called "object graphs".  The first object graph, starting with x, is a set of objects which are related to each other, and reachable from x.  The second object graph, starting with p, is a set of proxies, each of which matches in a one-to-one relationship with an object found in that first object graph.

The "membrane" is the collection of those two object graphs, along with the rules that determine how to transform a value from one object graph to another.

So a WeakMap can establish that one-to-one relationship.  But you still need a little more information.  You might think this would suffice:

```javascript
var map = new WeakMap();
map.set(x, p);
map.set(p, x);
```

Not quite.  All this tells you is that x refers to p, and p refers to x.  But
you don't know from this alone which object graph x belongs to, and which object
graph p belongs to.  So there's one more concept to introduce, where both x and
p point to a _shared, common_ object that references each by the name of their
respective object graphs:

```javascript
var map = new WeakMap();
var subMapFor_x = {
  "original": x,
  "proxy": p
};
map.set(x, subMapFor_x);
map.set(p, subMapFor_x);
```

Finally, you have enough information to uniquely identify x by both its object graph and by how we got there.  Likewise, we can, through the WeakMap and the "sub-map" it stores, identify an unique proxy p in the "proxy" object graph that matches to x in the "original" object graph.

(In this module's implementation, the "sub-map" is called a ProxyMapping, and has a ProxyMapping constructor and prototype implementation.)

# Additional reading

* [Tom van Cutsem's original article, "Membranes in JavaScript"](http://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes)
* [A StackOverflow question on why we might want a Membrane](http://stackoverflow.com/questions/36368363/what-would-be-a-use-case-for-identity-preserving-membrane-proxies/)
* [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) and [ProxyHandler](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) documentation on developer.mozilla.org
* The ECMAScript specifications, [6th Edition, aka "2015 Edition"](http://www.ecma-international.org/ecma-262/6.0/) and [7th Edition, aka "2016 Edition"](http://www.ecma-international.org/ecma-262/7.0/)

# How to use the es7-membrane module

1. Define the object graphs by name you wish to use.  Examples:
  * [ "wet", "dry" ] or [ "wet", "dry", "damp"], per Tom van Cutsem
  * [ "trusted", "sandboxed" ]
  * [ "private", "public" ]
2. Create an instance of Membrane.
3. Ask for an ObjectGraphHandler from the membrane, by a name as a string.  This will be where "your" objects live.
4. Ask for another ObjectGraphHandler from the membrane, by a different object graph name.  This will be where "their" objects live.
5. Add a "top-level" object to "your" ObjectGraphHandler instance.
6. Ask the membrane to get a proxy for the original object from "their" object graph, based on the graph name.
7. (Optional) Replace that proxy with another, for custom handling, through "their" ObjectGraphHandler.
8. Repeat steps 5 through 7 for any additional objects that need special handling.
  * Example:  Prototypes of constructors, which is where most property lookups go.
9. Return "top-level" proxies to objects, from "their" object graph, to the end-user.
  * **DO NOT** return the Membrane, or any ObjectGraphHandler.  Returning those allows others to change the rules you so carefully crafted.

Example code:
```javascript
/* 1.  The object graph names I want are "dry" and "wet".
 * "wet" is what I own.
 * "dry" is what I don't trust.
 */

// 2. Establish the Membrane.
var dryWetMB = new Membrane({
  // These are configuration options.
});

// 3. Establish "wet" ObjectGraphHandler.
var wetHandler = dryWetMB.getHandlerByField("wet", true);

// 4. Establish "dry" ObjectGraphHandler.
var dryHandler = dryWetMB.getHandlerByField("dry", true);

// 5. Establish "wet" view of an object.
// 6. Get a "dry" view of the same object.
var dryDocument = dryWetMB.convertArgumentToProxy(
  wetHandler,
  dryHandler,
  wetDocument
);
// dryDocument is a Proxy whose target is wetDocument, and whose handler is dryHandler.

// 7. (optional, skipped for now)
// 8. (skipped for this example)

// 9. Return "top-level" document proxy.
return dryDocument;
```

This will give the end-user a very basic proxy in the "dry" object graph, which also implements the identity and property lookup rules of the object graph and the membrane.  In fact, it is a _perfect_ one-to-one correspondence:  because no special proxy traps are established in steps 7 and 8 above, _any and all_ operations on the "dry" document proxy, or objects and functions retrieved through that proxy (directly or indirectly) will be reflected and repeated on the corresponding "wet" document objects _exactly_ with no side effects. (Except possibly those demanded through the Membrane's configuration options, such as providing a logger.)

Such a membrane is, for obvious reasons, useless.  But this perfect mirroring has to be established first before anyone can customize the membrane's various proxies, and thus, rules for accessing and manipulating objects.  It is through custom proxies whose handlers inherit from ObjectGraphHandler instances in the membrane that you can achieve proper hiding of properties, expose new properties, and so on.

# How the Membrane actually works

* The Membrane's prototype methods provide API for getting unique
ObjectGraphHandler instances:
  * .getHandlerByField(graphName, mustCreate = false)
  * .ownsHandler(handler)
* The Membrane's prototype also manages access to ProxyMapping instances, which as we stated above match proxies to original values in an one-to-one relationship.
  * .hasProxyForValue(field, value)
  * .buildMapping(field, value, options)
  * .convertArgumentToProxy(originHandler, targetHandler, arg, options)
  * .getMembraneValue(field, value) _(private method)_
  * .getMembraneProxy(field, value) _(private method)_
  * .wrapArgumentByHandler(handler, arg, options) _(private method)_
  * .wrapArgumentByProxyMapping(mapping, arg, options) _(private method)_
  * .wrapDescriptor(originField, targetField, desc) _(private method)_
* The Membrane also maintains a WeakMap(object or proxy -> ProxyMapping) member.
* Each ObjectGraphHandler is a [handler for a Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler) implementing all the traps.
  * For simple operations that don't need a Membrane, such as .isExtensible(), the handler forwards the request directly to [Reflect](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect), which also implements the Proxy handler traps.
  * (An exception to this rule is the .has() trap, which uses this.getOwnPropertyDescriptor and this.getPrototypeOf to walk the prototype chain, without the .has trap itself crossing the object graph's borders.)
  * When getting a property descriptor from a proxy by the property name, there are several steps:
    1. Look up the ProxyMapping object matching the proxy's target in the membrane's WeakMap.
    2. Look up the original "this" object from the ProxyMapping, and call it originalThis.  (This is the object the proxy corresponds to.)
    3. Set rv = Reflect.getOwnPropertyDescriptor(originalThis, propertyName);
    4. Wrap the non-primitive properties of rv as objects in the membrane, just like originalThis is wrapped in the membrane.
      * This includes the .get(), .set() methods of accessor descriptors, and the .value of a data descriptor.
    5. Return rv.
  * When getting the prototype of a proxy,
    1. Look up the ProxyMapping object matching the proxy's target in the membrane's WeakMap.
    2. If the retrieved ProxyMapping object doesn't have a valid "protoMapping" property,
      1. Look up the original "this" object from the ProxyMapping, and call it originalThis.
      2. Set proto = Reflect.getPrototypeOf(originalThis).
      3. Wrap proto, and a new Proxy for proto in the desired object graph, in the membrane via a second ProxyMapping.
      4. Set the second ProxyMapping object as the "protoMapping" property of the first ProxyMapping object.
    3. Return the proxy belonging to both the object graph and the "protoMapping" object.
  * The .get() trap follows the ECMAScript 7th Edition specification for .get(), calling its .getOwnPropertyDescriptor() and .getPrototypeOf() traps respectively.  It then wraps whatever return value it gets from those methods.
  * When I say 'wrap a value', what I mean is:
    1. If the value is a primitive, just return the value as-is.
    2. If there isn't a ProxyMapping in the owning Membrane's WeakMap for the value,
      1. Create a ProxyMapping and set it in the membrane's WeakMap.
      2. Let origin be the ObjectGraphHandler that the value came from, and target be this.
      3. Set the value as a property of the ProxyMapping with the name of the origin object graph.
      4. Let parts = Proxy.revocable(value, this).
      5. Set parts as a property of the ProxyMapping with this object graph's name.
    3. Get the ProxyMapping for the value from the owning Membrane's WeakMap.
    4. Get the property of the ProxyMapping with this object's graph name.
    5. Return the property (which should be a Proxy).
  * There is an algorithm for "counter-wrap a value", which we use for passing in arguments to a wrapped function, defining a property, or setting a prototype.  The algorithm is similar to the "wrap a value" algorithm, except that the "origin" ObjectGraphHandler and the "target" ObjectGraphHandler are reversed.
  * For executing a function proxy via .apply(),
    1. Counter-wrap the "this" value and all arguments.
    2. Look up the original function.
    3. Let rv = Reflect.apply(original function, counterWrapped this, counterWrapped arguments);
    4. Wrap rv and return the wrapped value.
  * For executing a function proxy as a constructor via .construct(target, argumentList, newTarget),
    1. Get the ObjectGraphHandler representing the original function,
    2. Counter-wrap all the members of argumentList.
    3. Let rv = Reflect.construct(target, wrappedArgumentList, newTarget).
    4. Wrap rv.
    5. Get the prototype property of target (which is our constructor function).
    6. Wrap the prototype property.
    7. this.setPrototypeOf(rv, wrappedProto).
    8. Return rv.

Each object graph's objects and functions, then, only see three different types of values:
1. Primitive values
2. Objects and functions passed into the membrane from that object graph's objects and functions
3. Proxies from other object graphs, representing native objects and functions belonging to those other object graphs.

For instance, if I have a "dry" proxy to a function from the "wet" object graph and I call the proxy as a function, the "wet" function will be invoked only with primitives, objects and functions known to the "wet" graph, and "dry" proxies.  Each argument (and the "this" object) is counter-wrapped in this way, so that the "wet" function only sees values it can rely on being in the "wet" object graph (including "wet" proxies to "dry" objects and callback functions).

As long as all the proxies (and their respective handlers) follow the above rules, in addition to how they manipulate the appearance (or disappearance) of properties of those proxies, the membrane will be able to correctly preserve each object graph's integrity.  Which is the overall goal of the membrane:  keep objects and functions from accidentally crossing from one object graph to another.
