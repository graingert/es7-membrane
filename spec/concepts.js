"use strict"
/*
import "../dist/es6-modules/Membrane.js";
import "../dist/es6-modules/MembraneMocks.js";
*/

if (typeof MembraneMocks != "function") {
  if (typeof require == "function") {
    var { MembraneMocks } = require("../dist/node/mocks.js");
  }
}

if (typeof MembraneMocks != "function") {
  throw new Error("Unable to run tests");
}

describe("basic concepts: ", function() {
  var wetDocument, dryDocument;
  
  beforeEach(function() {
    let parts = MembraneMocks();
    wetDocument = parts.wet.doc;
    dryDocument = parts.dry.doc;
  });

  afterEach(function() {
    wetDocument = null;
    dryDocument = null;
  });
  
  it("dryDocument and wetDocument should not be the same", function() {
    expect(dryDocument === wetDocument).toBe(false);
  });

  it("Looking up a primitive on a directly defined value works", function() {
    expect(dryDocument.nodeType).toBe(9);
  });
  
  it("Looking up null through a property name works", function() {
    expect(dryDocument.ownerDocument).toBe(null);
  });

  it("Looking up null through a property getter works", function() {
    expect(dryDocument.firstChild).toBe(null);
  });

  it("Looking up an object twice returns the same object", function() {
    var root1 = dryDocument.rootElement;
    var root2 = dryDocument.rootElement;
    expect(root1 === root2).toBe(true);
    expect(root1 !== wetDocument.rootElement).toBe(true);
    expect(typeof root1).toBe("object");
    expect(root1 !== null).toBe(true);
  });

  it("Looking up an cyclic object (a.b.c == a)", function() {
    var root = dryDocument.rootElement;
    var owner = root.ownerDocument;
    expect(dryDocument === owner).toBe(true);
  });

  it("Looking up a method twice returns the same method", function() {
    var method1 = dryDocument.insertBefore;
    var method2 = dryDocument.insertBefore;

    expect(method1 === method2).toBe(true);
    expect(method1 !== wetDocument.insertBefore).toBe(true);
    expect(typeof method1).toBe("function");
  });

  it("Looking up an accessor descriptor works", function() {
    var desc = Object.getOwnPropertyDescriptor(dryDocument, "firstChild");
    expect(desc.configurable).toBe(true);
    expect(desc.enumerable).toBe(true);
    expect(typeof desc.get).toBe("function");
    expect("set" in desc).toBe(true);
    expect(typeof desc.set).toBe("undefined");


    desc = Object.getOwnPropertyDescriptor(dryDocument, "baseURL");
    expect(desc.configurable).toBe(true);
    expect(desc.enumerable).toBe(true);
    expect(typeof desc.get).toBe("function");
    expect(typeof desc.set).toBe("function");

    dryDocument.baseURL = "https://www.ecmascript.org/";
    expect(dryDocument.baseURL).toBe("https://www.ecmascript.org/");
  });

  it("Executing a method returns a properly wrapped object", function() {
    var rv;
    expect(function() {
      rv = dryDocument.insertBefore(dryDocument.rootElement, null);
    }).not.toThrow();
    expect(rv == dryDocument.firstChild).toBe(true);
    expect(dryDocument.firstChild == dryDocument.rootElement).toBe(true);
  });

  it("ElementDry and NodeDry respect Object.getPrototypeOf", function() {
    let wetRoot, ElementWet, NodeWet;
    let dryRoot, ElementDry, NodeDry;

    let parts = MembraneMocks();
    wetRoot     = parts.wet.doc.rootElement;
    ElementWet  = parts.wet.Element;
    NodeWet     = parts.wet.Node;

    let e, eP, proto, p2;

    e = new ElementWet({}, "test");
    eP = Object.getPrototypeOf(e);
    proto = ElementWet.prototype;
    expect(eP === proto).toBe(true);

    proto = Object.getPrototypeOf(proto);
    p2 = NodeWet.prototype;
    expect(proto === p2).toBe(true);
    
    dryRoot     = parts.dry.doc.rootElement;
    ElementDry  = parts.dry.Element;
    NodeDry     = parts.dry.Node;

    e = new ElementDry({}, "test");
    eP = Object.getPrototypeOf(e);
    proto = ElementDry.prototype;
    expect(eP === proto).toBe(true);

    proto = Object.getPrototypeOf(proto);
    p2 = NodeDry.prototype;
    expect(proto === p2).toBe(true);

    expect(dryRoot instanceof ElementDry).toBe(true);

    expect(dryRoot instanceof NodeDry).toBe(true);
  });

  it("ElementDry as a constructor reflects assigned properties", function() {
    let parts = MembraneMocks();
    
    let ElementDry = parts.dry.Element;
    let ElementWet = parts.wet.Element;
    let proto1 = ElementDry.prototype;
    let owner = {
      isFakeDoc: true,
      root: null
    };
    let k = new ElementDry(owner, "k");
    expect(typeof k).not.toBe("undefined");

    let proto2 = Object.getPrototypeOf(k);
    expect(proto1 === proto2).toBe(true);
    let kOwner = k.ownerDocument;
    expect(kOwner === owner).toBe(true);
    owner.root = k;

    /* This might be cheating, since on the "wet" object graph, there's no
     * reason to look up owner.root.  On the other hand, if k is passed back to
     * the "wet" object graph, being able to find the root property is allowed.
     */
    let dryWetMB = parts.membrane;

    let [found, wetK] = dryWetMB.getMembraneValue("wet", k);
    expect(found).toBe(true);
  
    expect(Object.getPrototypeOf(wetK) === ElementWet.prototype);
    let wetKOwner = wetK.ownerDocument;
    expect(wetKOwner !== owner).toBe(true);
    let wetKRoot = wetKOwner.root;
    expect(wetKRoot === wetK).toBe(true);
  });

  // XXX ajvincent Be sure to retest this via frames, sandboxes.
  it(
    "Executing a function via .apply() returns a properly wrapped object",
    function() {
      var method1 = dryDocument.insertBefore;
      var rv;
      expect(function() {
        rv = method1.apply(dryDocument, [dryDocument.rootElement, null]);
      }).not.toThrow();
      expect(rv == dryDocument.firstChild).toBe(true);
      expect(dryDocument.firstChild == dryDocument.rootElement).toBe(true);
    }
  );

  it("Looking up a proxy-added property works", function() {
    [
      dryDocument,
      dryDocument.rootElement,
      dryDocument.insertBefore
    ].forEach(function(dryObj) {
      var keys = Object.getOwnPropertyNames(dryObj);
      expect(keys.indexOf("membraneGraphName")).not.toBe(-1);
      expect(dryDocument.membraneGraphName).toBe("dry");
    });
  });

  it("Looking up Object.isExtensible() works", function() {
    let wetExtensible = Object.isExtensible(wetDocument);
    let dryExtensible = Object.isExtensible(dryDocument);

    expect(wetExtensible).toBe(true);
    expect(dryExtensible).toBe(true);

    Object.preventExtensions(wetDocument);

    wetExtensible = Object.isExtensible(wetDocument);
    dryExtensible = Object.isExtensible(dryDocument);

    expect(wetExtensible).toBe(false);
    expect(dryExtensible).toBe(false);
  });

  it("The in operator works", function() {
    let checkHas = function(value, valueName, propName, index, array) {
      expect(propName in value).toBe(index !== array.length - 1);
    };
    let propList = [
        "nodeType",
        "nodeName",
        "childNodes",
        "ownerDocument",
        "firstChild",
        "unknownProperty"
    ];

    propList.forEach(checkHas.bind(null, dryDocument, "dryDocument"));

    // root follows inheritance patterns.
    let root = dryDocument.rootElement;
    propList.forEach(checkHas.bind(null, root, "root"));
  });

  describe("The delete operator works as expected", function() {
    it("on dryDocument.rootElement", function() {
      let wasDeleted = delete dryDocument.rootElement;
      expect(typeof dryDocument.rootElement).toBe("undefined");
      expect("rootElement" in dryDocument).toBe(false);
      expect(wasDeleted).toBe(true);
    });

    it("on dryDocument.rootElement.nodeName", function() {
      let root = dryDocument.rootElement;
      let wasDeleted = delete root.nodeName;
      expect(typeof root.nodeName).toBe("undefined");
      expect("nodeName" in root).toBe(false);
      expect(wasDeleted).toBe(true);
    });

    it("on dryDocument.rootElement.insertBefore", function() {
      let root = dryDocument.rootElement;
      let wasDeleted = delete root.insertBefore;

      // This is because insertBefore is inherited from NodeWet.prototype.
      expect(typeof root.insertBefore).toBe("function");
      expect("insertBefore" in root).toBe(true);
      expect(wasDeleted).toBe(true);
    });
  });

  it("Defining a property via Object.defineProperty(...) works as expected", function() {
    Object.defineProperty(dryDocument, "screenWidth", {
      value: 200,
      writable: true,
      enumerable: true,
      configurable: true
    });
    expect(dryDocument.screenWidth).toBe(200);
    expect(wetDocument.screenWidth).toBe(200);

    let localHeight = 150;
    Object.defineProperty(dryDocument, "screenHeight", {
      get: function() { return localHeight; },
      set: function(val) { localHeight = val; },
      enumerable: true,
      configurable: true
    });
    expect(dryDocument.screenHeight).toBe(150);
    expect(wetDocument.screenHeight).toBe(150);

    let location = {
      name: "location"
    };
    Object.defineProperty(dryDocument, "location", {
      value: location,
      writable: true,
      enumerable: true,
      configurable: true
    });
    expect(dryDocument.location === location).toBe(true);
    expect(typeof dryDocument.location.membraneGraphName).toBe("undefined");
    expect(wetDocument.location !== location).toBe(true);
    expect(wetDocument.location.name === "location").toBe(true);
    expect(wetDocument.location.membraneGraphName === "wet").toBe(true);

    /* XXX ajvincent There is an obvious temptation to just call:
     * dryDocument.screenWidth = 200;
     *
     * But we're not testing that yet, nor (at the time of this writing) have we
     * implemented that proxy handler trap.
     *
     * On the other hand, we've just tested that setting a property from the
     * "dry" side retains its identity with the "dry" object graph.
     */

    // Additional test for configurable: false
    Object.defineProperty(dryDocument, "extra", {
      value: 1,
      writable: true,
      enumerable: false,
      configurable: false
    });
    let extra = dryDocument.extra;
    expect(extra).toBe(1);
  });

  it("Defining a property directly works as expected", function() {
    dryDocument.screenWidth = 200;
    expect(dryDocument.screenWidth).toBe(200);
    expect(wetDocument.screenWidth).toBe(200);

    let localHeight = 150;
    Object.defineProperty(dryDocument, "screenHeight", {
      get: function() { return localHeight; },
      set: function(val) { localHeight = val; },
      enumerable: true,
      configurable: true
    });
    wetDocument.screenHeight = 200;
    expect(dryDocument.screenHeight).toBe(200);
    expect(wetDocument.screenHeight).toBe(200);

    let location = {
      name: "location"
    };
    dryDocument.location = location;
    expect(dryDocument.location === location).toBe(true);
    expect(typeof dryDocument.location.membraneGraphName).toBe("undefined");
    expect(wetDocument.location !== location).toBe(true);
    expect(wetDocument.location.name === "location").toBe(true);
    expect(wetDocument.location.membraneGraphName === "wet").toBe(true);    
  });

  it("Setting a prototype works as expected", function() {
    let wetRoot, ElementWet, NodeWet;
    let dryRoot, ElementDry, NodeDry;

    let parts = MembraneMocks();
    wetRoot     = parts.wet.doc.rootElement;
    ElementWet  = parts.wet.Element;
    NodeWet     = parts.wet.Node;

    dryRoot     = parts.dry.doc.rootElement;
    ElementDry  = parts.dry.Element;
    NodeDry     = parts.dry.Node;

    let XHTMLElementDryProto = {
      namespaceURI: "http://www.w3.org/1999/xhtml"
    };
    let eProto = ElementDry.prototype;
    Object.setPrototypeOf(XHTMLElementDryProto, eProto);
    Object.setPrototypeOf(dryRoot, XHTMLElementDryProto);

    expect(dryRoot.namespaceURI).toBe(XHTMLElementDryProto.namespaceURI);
    expect(dryRoot.membraneGraphName).toBe("dry");
    expect(dryRoot instanceof ElementDry).toBe(true);
    expect(dryRoot instanceof NodeDry).toBe(true);

    expect(wetRoot.namespaceURI).toBe(XHTMLElementDryProto.namespaceURI);

    /* This is because wetRoot inherits for Wet(XHTMLDryElementProto),
     * which automatically is a proxy in the "wet" object graph.
     */
    expect(wetRoot.membraneGraphName).toBe("wet");
    expect(wetRoot instanceof ElementWet).toBe(true);
    expect(wetRoot instanceof NodeWet).toBe(true);

    let XHTMLElementDry = function(ownerDoc, name) {
      // this takes care of ownerDoc, name
      ElementDry.apply(this, [ownerDoc, name]);
    };
    XHTMLElementDry.prototype = XHTMLElementDryProto;

    let x = new XHTMLElementDry(dryDocument, "test");
    expect(x instanceof XHTMLElementDry).toBe(true);
    expect(x instanceof ElementDry).toBe(true);
    expect(x instanceof NodeDry).toBe(true);
    expect(x.namespaceURI).toBe(XHTMLElementDryProto.namespaceURI);
    expect(x.nodeType).toBe(1);
  });

  it("Calling Object.preventExtensions(...) works as expected", function() {
    expect(Object.isExtensible(dryDocument)).toBe(true);
    Object.preventExtensions(dryDocument);
    expect(Object.isExtensible(dryDocument)).toBe(false);

    // this line is NOT expected to throw an exception
    Object.preventExtensions(dryDocument);
    expect(Object.isExtensible(dryDocument)).toBe(false);
  });

  it(
    "MembraneHandler.revokeEverything() breaks all proxy access on an object graph",
    function() {
      function lookup(obj, propName) {
        return function() {
          return obj[propName];
        };
      }
      let root = lookup(dryDocument, "rootElement")();

      wetDocument.dispatchEvent("unload");
      expect(lookup(dryDocument, "nodeType")).toThrow();
      expect(lookup(dryDocument, "nodeName")).toThrow();
      expect(lookup(dryDocument, "childNodes")).toThrow();
      expect(lookup(dryDocument, "insertBefore")).toThrow();
      expect(lookup(dryDocument, "rootElement")).toThrow();
      expect(lookup(dryDocument, "parentNode")).toThrow();
      expect(lookup(dryDocument, "ownerDocument")).toThrow();
      expect(lookup(dryDocument, "membraneGraphName")).toThrow();

      expect(lookup(root, "nodeType")).toThrow();
      expect(lookup(root, "nodeName")).toThrow();
      expect(lookup(root, "childNodes")).toThrow();
      expect(lookup(root, "insertBefore")).toThrow();
      expect(lookup(root, "rootElement")).toThrow();
      expect(lookup(root, "parentNode")).toThrow();
      expect(lookup(root, "ownerDocument")).toThrow();
      expect(lookup(root, "membraneGraphName")).toThrow();
  });
});

it("More than one object graph can be available", function() {
  let parts = MembraneMocks(true);
  let wetDocument = parts.wet.doc;
  let dryDocument = parts.dry.doc;
  let dampDocument = parts.damp.doc;

  wetDocument.dispatchEvent("unload");

  expect(function() {
    void(dryDocument.rootElement);
  }).toThrow();

  expect(function() {
    dampDocument.insertBefore(dampDocument.rootElement, null);
  }).not.toThrow();
});

