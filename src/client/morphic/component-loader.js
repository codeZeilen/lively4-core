import * as scriptManager from  "../script-manager.js";

export function loadUnresolved(root) {
  // this function loads all unregistered elements, starts looking in root,
  // does not go into shadow roots, but you can call it with a shadow root as root

  // helper set to filter for unique tags
  var unique = new Set();
  var $uniqueUnresolvedTags = $(root.querySelectorAll(":unresolved")).map(function() {
    return this.nodeName.toLowerCase();
  }).filter(function() {
    // filter for unique tags
    return !unique.has(this) && unique.add(this);
  });
  
  $uniqueUnresolvedTags.each(function() {
    loadByName(this);
  });
}

export function loadByName(name) {
  // loads a template by name and registeres the corresponding component

  var $loader = $(document.createElement("div"));
  $loader.load("../templates/" + name + ".html", function(responseText, status) {
    var templates = $loader.children("template");
    if (templates.length === 0) {
      throw new Error(name + " not found!");
    }

    register(name, templates[0]);
  });
}

function register(componentName, template) {
  // registeres a component with given template

  // Morph is default prototype, if nothing is set in data-class
  var prototypeName = template.getAttribute("data-class") || "Morph";

  // load the prototype
  System.import("/lively4-core/templates/classes/" + prototypeName + ".js")
  .then(protoClass => {
    var proto = Object.create(protoClass.prototype);

    // this is called when a new component of this type is created
    proto.createdCallback = function() {
      var shadowRoot = this.createShadowRoot();
      // clone the template's content
      var clone = document.importNode(template.content, true);
      shadowRoot.appendChild(clone);

      // attach lively4scripts from the shadow root to this
      scriptManager.attachScriptsFromShadowDOM(this);
      // call the initialize script, if it exists
      if (typeof this.initialize === "function") {
        this.initialize();
      }

      // load missing components of the shadow root
      loadUnresolved(shadowRoot);
    }

    try {
      // if the element is already registered, this operation fails
      document.registerElement(componentName, {
        prototype: proto
      });
    } catch (e) {
      console.log(componentName + " already registered");
    }
  })
  .catch(err => {
    console.error(err);
  });
}
