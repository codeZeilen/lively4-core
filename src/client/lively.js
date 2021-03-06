'use strict';

window.lively = this;

import * as scripts from './script-manager.js';
import * as messaging from './messaging.js';
import * as preferences from './preferences.js';
import * as persistence from './persistence.js';


import files from './files.js';
import html from './html.js';
import paths from './paths.js';

import inspector from './inspector.js';

import keys from './keys.js';
import components from './morphic/component-loader.js';

/* expose external modules */
import color from '../external/tinycolor.js';
import focalStorage from '../external/focalStorage.js';
import * as jquery from '../external/jquery.js';
import * as _ from '../external/underscore.js';


let $ = window.$,
  babel = window.babel,
  System = window.System; // known global variables.

// a) Special shorthands for interactive development
// b) this is the only reasonable way to use modules in template scripts, due to no shared lexical scope #TODO
var exportmodules = [
  "scripts",
  "messaging",
  "preferences",
  "persistence",
  "files",
  "keys",
  "paths",
  "html",
  "components",
  "inspector",
  "color",
  "focalStorage"];



// #LiveProgramming #Syntax #ES6Modules #Experiment #Jens
// By structuring our modules differently, we still can act as es6 module to the outside but develop at runtime
// #IDEA: I refactored from "static module and function style" to "dynamic object" style
export default class Lively {


  static import(moduleName, path, forceLoad) {
    if (!path) path = this.defaultPath(moduleName)
    if (!path) throw Error("Could not imoport " + moduleName + ", not path specified!")

    if (this[moduleName] && !forceLoad)
      return new Promise((resolve) => { resolve(this[moduleName])})
    if (forceLoad) {
      path += "?" + Date.now()
    }
    return System.import(path).then( (module, err) => {
      if (err) {
        lively.notify("Could not load module " + moduleName, err);
      } else {
        console.log("lively: load "+ moduleName)

        if (moduleName == "lively") {
          this.notify("migrate lively.js")
          var oldLively = window.lively;
          window.lively =module.default || module
          this["previous"] = oldLively
          this.components = oldLively.components // components have important state
        } else {
          this[moduleName] = module.default || module
        }

        if (lively.components && this[moduleName]) {
          lively.components.updatePrototype(this[moduleName].prototype);
        }
        return module.default || module
      }
    })
  }

  static reloadModule(path, optSource) {
    if (!path) path = this.defaultPath(moduleName)
    if (!path) throw Error("Could not imoport " + moduleName + ", not path specified!")

    if (this[moduleName]) {
      return new Promise((resolve) => { resolve(this[moduleName])});
    }
    return System.import(path).then( module => {
      console.log("lively: load "+ moduleName);
      this[moduleName] = module.default || module;
    });
  }
  
  static loadJavaScriptThroughDOM(name, src, force) {
    return new Promise((resolve) => {
      var mochaNode = document.querySelector("#mochaScript");
      if (mochaNode) { 
        mochaNode.remove();
      }
      var script = document.createElement("script");
      script.id="mochaScript";
      script.type="text/javascript";
      if (force) {
        src += + "?" + Date.now();
      }
      script.src= src;
      script.onload = function() {
        resolve();
      };
      document.head.appendChild(script);
    })
  }
  
  static fillTemplateStyles(root) {
     // there seems to be no <link ..> tag allowed to reference css inside of templates #Jens
     var promises = []
     _.each(root.querySelectorAll("style"), ea => {
        var src = ea.getAttribute("data-src")
        if (src) {
          promises.push(fetch(lively4url + src).then(r => r.text()).then(css => {
            ea.innerHTML = css
          }))    
        }
     })
     return Promise.all(promises)
  }

  static defaultPath(moduleName) {
    return ({
      math: lively4url + "/src/external/math.js",
      typo: lively4url + "/src/external/typo.js",
      contextmenu: lively4url + '/src/client/contextmenu.js',
      customize: lively4url + '/src/client/customize.js'
    })[moduleName]
  }


  static handleError(error) {
    lively.LastError = error
   lively.notify("Error: ", error.message, 20, () =>
    		  lively.openWorkspace("Error:" + error.message + "\nLine:" + error.lineno + " Col: " + error.colno+"\nSource:" + error.source + "\nError:" + error.stack))
  }


  static loaded() {
    // #Refactor with #ContextJS
    // guard againsst wrapping twice and ending in endless recursion
    if (!console.log.originalFunction) {
        var nativeLog = console.log;
        console.log = function() {
            nativeLog.apply(console, arguments);
            lively.log.apply(undefined, arguments);
        };
        console.log.originalFunction = nativeLog; // #TODO use generic Wrapper mechanism here
    }
    if (!console.error.originalFunction) {
        var nativeError = console.error;
        console.error = function() {
            nativeError.apply(console, arguments);
            lively.log.apply(undefined, arguments);
        };
        console.error.originalFunction = nativeError; // #TODO use generic Wrapper mechanism here
    }

    // General Error Handling
    if (window.onerror === null) {
      window.onerror  = function(message, source, lineno, colno, error) {
    	  lively.handleError(error)
      }
    }
    // do it just once
    if (!window.unhandledRejectionEventLister) {
      window.unhandledRejectionEventLister = function(evt) {lively.handleError(evt.reason)} ;
      window.addEventListener('unhandledrejection', unhandledRejectionEventLister);
    }

    exportmodules.forEach(name => lively[name] = eval(name)); // oh... this seems uglier than expected

    this.import("authGithub", lively4url + '/src/client/auth-github.js')
    this.import("authDropbox", lively4url + '/src/client/auth-dropbox.js')
  }

  static array(anyList){
    return Array.prototype.slice.call(anyList);
  }

  static openWorkspace(string, pos) {
    var name = "juicy-ace-editor";
    var comp  = document.createElement(name);
    return lively.components.openInWindow(comp).then((container) => {
      pos = pos || lively.pt(100,100);
      comp.changeMode("javascript");
      comp.enableAutocompletion();
      comp.editor.setValue(string)
      lively.setPosition(container,pos);
    }).then( () => {
      comp.editor.focus();
      return comp
    });
  }

  static boundEval(str, ctx) {
    var interactiveEval = function(text) { return eval(text) };
    var transpiledSource = babel.transform(str).code;
    // #TODO alt: babel.run
    // #TODO context does not seem to work!
    return interactiveEval.call(ctx, transpiledSource);
  }

  static pt(x,y) {
    return {x: x, y: y};
  }

  static setPosition(obj, point) {
      obj.style.position = "absolute";

      // var bounds = that.getBoundingClientRect().top
      //var deltax = point.x - bounds.left
      // var deltay = point.y - bounds.top

      // obj.style.left = ""+  ((obj.style.left || 0) - deltax) + "px";
      // obj.style.top = "" + ((obj.style.top || 0) - deltay) + "px";
      obj.style.left = ""+  point.x + "px";
      obj.style.top = "" +  point.y + "px";
  }

  static openFile(url) {
    if (url.hostname == "lively4"){
      var container  = $('lively-container')[0];
      if (container) {
        container.followPath(url.pathname);
      } else {
        console.log("fall back on editor: "+ url);
        this.editFile(url);
      }
    } else {
      this.editFile(url);
    }
  }

  static editFile(url) {
    var editor  = document.createElement("lively-editor");
    lively.components.openInWindow(editor).then((container) => {
        lively.setPosition(container, lively.pt(100, 100));
        editor.setURL(url);
        editor.loadFile();
    });
  }

  static hideContextMenu(evt) {
    // console.log("hide: " + (evt.path[0] === document.body))
    if (evt.path[0] !== document.body) return
    console.log("hide context menu:" + evt)
    this.import("contextmenu").then(m => m.hide());
  }

  static openContextMenu(container, evt, target) {
    if (HaloService.areHalosActive() ||
      (HaloService.halosHidden && ((Date.now() - HaloService.halosHidden) < 500))) {
      target = that
    }
    console.log("open context menu: " + target);
    this.import("contextmenu").then(m => m.openIn(container, evt, target));

  }

  static log(/* varargs */) {
      var args = arguments;
      $('lively-console').each(function() {
        try{
          if (this.log) this.log.apply(this, args);
        }catch(e) {
          // ignore...
        }
      });
  }

  static notify(title, text, timeout, cb) {
    // lively.notify("hello","",3)
    // just in case...
    if (Notification.permission !== "granted") Notification.requestPermission();

    var time = Date.now()
    if (lively.lastNotificationTime && (time - lively.lastNotificationTime) < 500) {
      return console.log("SILENT NOTE: " + title  + " (" + text + ")");
    }

    lively.lastNotificationTime = time
    console.log("NOTE: " + title  + " (" + text + ")");


    var notification = new Notification(title || "", {
      icon: 'https://www.lively-kernel.org/media/livelylogo-small.png',
      body: text || "",
    });
    if (cb) notification.onclick = cb
    if (timeout === undefined) timeout = 3
    setTimeout(() => notification.close(), timeout * 1000);
    // notification.onclick = cb
  }

  static initializeDocument(doc, loadedAsExtension) {
    console.log("Lively4 initializeDocument");
      doc.addEventListener('contextmenu', function(evt) {
          if (evt.ctrlKey) {
            evt.preventDefault();
            lively.openContextMenu($('body')[0], evt);
            return false;
          }
      }, false);

    if (loadedAsExtension) {
      this.import("customize").then(customize => {
          customize.customizePage()
      })
      lively.notify("Lively4 extension loaded!",
        "  CTRL+LeftClick  ... open halo\n" +
        "  CTRL+RightClick ... open menu");
    } else {
      // doc.addEventListener('contextmenu', function(evt) {
      //   evt.preventDefault();
      //   lively.openContextMenu($('body')[0], evt);
      //   return false;
      // }, false);
    }

    doc.addEventListener('click', function(evt){lively.hideContextMenu(evt)}, false);
    doc.addEventListener('keydown', function(evt){lively.keys.handle(evt)}, false);
  }

  static initializeHalos() {
    if ($('lively-halos').size() === 0) {
        $('<lively-halos>')
            .attr('data-lively4-donotpersist', 'all')
            .appendTo($('body'));
    }
    lively.components.loadUnresolved();
  }

   static unload() {
      lively.notify("unloading Lively is not supported yet! Please reload page....");
  }

  static updateTemplate(html) {
    var tagName = components.reloadComponent(html);
    if (!tagName) return;

    _.each($(tagName), function(oldInstance) {
      if (oldInstance.__ingoreUpdates) return;

      var owner = oldInstance.parentElement;
      var newInstance = document.createElement(tagName);

      owner.replaceChild(newInstance, oldInstance);
      _.each(oldInstance.childNodes, function(ea) {
        newInstance.appendChild(ea);
        console.log("append old child: " + ea);

      });
      _.each(oldInstance.attributes, function(ea) {
        console.log("set old attribute " + ea.name + " to: " + ea.value);
        newInstance.setAttribute(ea.name, ea.value);

      });
      _.each(_.keys(oldInstance), function(ea) {
        console.log("ignore properties: " + newInstance[ea] + " <-- " + oldInstance[ea]);
      });
    });
  }

  static showPoint(point) {
    var comp = document.createElement("div")
    comp.style['pointer-events'] = "none";
    comp.style.width = "5px";
    comp.style.height = "5px";
    comp.style.padding = "1px";
    comp.style.backgroundColor = "red";
    document.body.appendChild(comp);
    lively.setPosition(comp, point);
    comp.setAttribute("data-is-meta", "true");

    setTimeout( () => $(comp).remove(), 3000);
    // ea.getBoundingClientRect
  }

  static showSource(object, evt) {
    if (object instanceof HTMLElement) {
        var comp  = document.createElement("lively-container");
        lively.components.openInWindow(comp).then((container) => {
          comp.editFile(lively4url +"/templates/" + object.localName + ".html")
        })
    } else {
      lively.notify("Could not show source for: " + object)
    }
  }

  static showElement(elem, timeout) {
    var comp = document.createElement("div")
    var bounds = elem.getBoundingClientRect()
    var pos = lively.pt(
      bounds.left +  $(document).scrollLeft(),
      bounds.top +  $(document).scrollTop())

    comp.style.width = bounds.width +"px"
    comp.style.height = bounds.height +"px"
    comp.style['pointer-events'] = "none"
    // comp.style.height = "0px"
    comp.style["z-index"] = 1000;
    comp.style.border = "1px solid red";
    document.body.appendChild(comp)
    lively.setPosition(comp, pos);
    comp.setAttribute("data-is-meta", "true")

    comp.innerHTML = "<pre data-is-meta='true' style='position: relative; top: -8px; width: 200px; background: rgba(255,255,255,0.8); color: red; font-size: 8pt'>" +
        elem.tagName +": " + elem.id + "\n" +
        elem.getAttribute("class") +"\n"

      + "</pre>"

    setTimeout( () => $(comp).remove(), timeout || 3000)
    return comp
  }

  static allProperties(obj, result) {
    result = result || {};
    Object.getOwnPropertyNames(obj).forEach( name => {result[name] = obj.constructor.name})
    if (obj.__proto__) {
      lively.allProperties(obj.__proto__, result);
    }
    return result
  }

  static async registerTemplate() {
    var template = document.currentScript.ownerDocument.querySelector('template');
    var clone = document.importNode(template.content, true);
    var proto;
    var className = template.getAttribute("data-class")
    if (className) {
      var module= await System.import(lively4url +'/templates/classes/' + className +".js");
      proto =  Object.create(module.prototype || module.default.prototype)
    }
    lively.components.register(template.id, clone, proto);
  }
}

window.lively = Lively
Lively.loaded();

console.log("loaded lively");
