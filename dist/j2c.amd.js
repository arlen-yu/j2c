define(function () { 'use strict';

  var emptyObject = {};
  var emptyArray = [];
  var type = emptyObject.toString;
  var own =  emptyObject.hasOwnProperty;
  var OBJECT = type.call(emptyObject);
  var ARRAY =  type.call(emptyArray);
  var STRING = type.call("");
  /*/-inline-/*/
  // function cartesian(a, b, res, i, j) {
  //   res = [];
  //   for (j in b) if (own.call(b, j))
  //     for (i in a) if (own.call(a, i))
  //       res.push(a[i] + b[j]);
  //   return res;
  // }
  /*/-inline-/*/

  /* /-statements-/*/
  function cartesian(a,b, selectorP, res, i, j) {
    res = [];
    for (j in b) if(own.call(b, j))
      for (i in a) if(own.call(a, i))
        res.push(concat(a[i], b[j], selectorP));
    return res;
  }

  function concat(a, b, selectorP) {
    if (selectorP && b.match(/^[-\w$]+$/)) throw new Error("invalid selector '" + b +  "'");
    return selectorP && b.indexOf("&") + 1 ? b.replace(/&/g, a) : a + b;
  }

  function decamelize(match) {
    return "-" + match.toLowerCase();
  }

  // Handles the property:value; pairs.
  function declarations(o, buf, prefix, vendors, localize,/*var*/ k, v, kk) {
    if (o==null) return;
    switch ( type.call(o = o.valueOf()) ) {
    case ARRAY:
      for (k = 0; k < o.length; k++)
        declarations(o[k], buf, prefix, vendors, localize);
      break;
    case OBJECT:
      prefix = (prefix && prefix + "-");
      for (k in o) if (own.call(o, k)){
        v = o[k];
        if (k.indexOf("$") + 1) {
          // "$" was found.
          for (kk in (k = k.split("$"))) if (own.call(k, kk))
            declarations(v, buf, prefix + k[kk], vendors, localize);
        } else {
          declarations(v, buf, prefix + k, vendors, localize);
        }
      }
      break;
    default:
      // prefix is falsy when it is "", which means that we're
      // at the top level.
      // `o` is then treated as a `property:value` pair.
      // otherwise, `prefix` is the property name, and
      // `o` is the value.
      k = (prefix && (prefix).replace(/_/g, "-").replace(/[A-Z]/g, decamelize) + ":");

      if (localize && (k == "animation-name:" || k == "animation:")) {
        o = o.split(',').map(function(o){
          return o.replace(/()(?:(?::global\(([-\w]+)\))|(?:()([-\w]+)))/, localize);
        }).join(",");
      }

  /*/-statements-/*/
      o = k + o + ";";

      // vendorify
      for (kk = 0; kk < vendors.length; kk++)
         buf.push("-" + vendors[kk] + "-" + o);
      buf.push(o);
  /*/-statements-/*/
  /*/-inline-/*/
      // buf.push(k + o + ";");
  /*/-inline-/*/

    }
  }

  // Add rulesets and other CSS statements to the sheet.
  function sheet(statements, buf, prefix, vendors, localize, /*var*/ k, kk, v, decl, at) {
    // optionally needed in the "[object String]" case
    // where the `statements` variable actually holds
    // declaratons. This allows to process either a
    // string or a declarations object with the same code.

    decl = statements;

    switch (type.call(statements)) {

    case ARRAY:
      for (k = 0; k < statements.length; k++)
        sheet(statements[k], buf, prefix, vendors, localize);
      break;

    case OBJECT:
      decl = {};
      for (k in statements) {
        v = statements[k];
        if (/^[-\w$]+$/.test(k)) {
          // It is a declaration.
          decl[k] = v;
        } else if (k[0] == "@") {
          // Handle At-rules
          if (/^.(?:namespace|import|charset)/.test(k)) {
            if(type.call(v) == ARRAY){
              for (kk = 0; kk < v.length; kk ++) {
                buf.push(k + " " + v[kk] + ";");
              }
            } else {
              buf.push(k + " " + v + ";");
            }
          } else if (/^.keyframes /.test(k)) {
            k = localize ? k.replace(/( )(?:(?::global\(([-\w]+)\))|(?:()([-\w]+)))/, localize) : k;
            // add a @-webkit-keyframes block too.

            buf.push("@-webkit-" + k.slice(1) + "{");
            sheet(v, buf, "", ["webkit"]);
            buf.push("}");

            buf.push(k + "{");
            sheet(v, buf, "", vendors, localize);
            buf.push("}");


          } else if (/^.(?:font-face|viewport|page )/.test(k)) {
            sheet(v, buf, k, emptyArray);

          } else if (/^.global/.test(k)) {
            sheet(v, buf, (localize ? prefix.replace(/()(?:(?::global\((\.[-\w]+)\))|(?:(\.)([-\w]+)))/g, localize) : prefix), vendors);

          } else {
            // conditional block (@media @document or @supports)
            at = true;
          }
        } else {
          // nested sub-selectors
          sheet(v, buf,
            /* if prefix and/or k have a coma */
            prefix.indexOf(",") + k.indexOf(",") + 2 ?
            /* then */
              cartesian(prefix.split(","), k.split(","), 1).join(",") :
            /* else */
              concat(prefix, k, 1),
            vendors,
            localize
          );
        }
      }
      // fall through for handling declarations. The next line is for JSHint.
      /* falls through */
    case STRING:
      // compute the selector.
      v = (localize ? prefix.replace(/()(?:(?::global\((\.[-\w]+)\))|(?:(\.)([-\w]+)))/g, localize) : prefix) || "*";
      // fake loop to detect the presence of declarations.
      // runs if decl is a non-empty string or when falling
      // through from the `Object` case, when there are
      // declarations.
      // We could use `Object.keys(decl).length`, but it would
      // allocate an array for nothing. It also requires polyfills
      // for ES3 browsers.
      for (k in decl) if (own.call(decl, k)){
        buf.push(v + "{");
        declarations(decl, buf, "", vendors, localize);
        buf.push("}");
        break;
      }
    }

    // Add conditional, nestable at-rules at the end.
    // The current architecture prevents from putting them
    // in place, and putting them before may end up in accidentally shadowing
    // rules of the conditional block with unconditional ones.
    if (at) for (k in statements) if (/^@(?:media|document|supports)/.test(k)) {
      buf.push(k + "{");
      sheet(statements[k], buf, prefix, vendors, localize);
      buf.push("}");
    }
  }

  var scope_root = "_j2c_" +
        Math.floor(Math.random() * 0x100000000).toString(36) + "_" +
        Math.floor(Math.random() * 0x100000000).toString(36) + "_" +
        Math.floor(Math.random() * 0x100000000).toString(36) + "_" +
        Math.floor(Math.random() * 0x100000000).toString(36) + "_";
  var counter = 0;
  function j2c(res) {
    res = res || {};
    var extensions = [];

    function finalize(buf, i) {
      for (i = 0; i< extensions.length; i++) buf = extensions[i](buf) || buf;
      return buf.join("\n");
    }

    res.use = function() {
      var args = arguments;
      for (var i = 0; i < args.length; i++){
        extensions.push(args[i]);
      }
      return res;
    };
  /*/-statements-/*/
    res.sheet = function(ns, statements) {
      if (arguments.length === 1) {
        statements = ns; ns = {};
      }
      var
        suffix = scope_root + counter++,
        locals = {},
        k, buf = [];

        for (k in ns) if (k-0 != k-0 && own.call(ns, k)) {
          locals[k] = ns[k];
        }
      sheet(
        statements, buf, "", emptyArray /*vendors*/,
        function localize(match, space, global, dot, name) {
          if (global) return space+global;
          if (!locals[name]) locals[name] = name + suffix;
          return space + dot + locals[name];
        }
      );
      /*jshint -W053 */
      buf = new String(finalize(buf));
      /*jshint +W053 */
      for (k in locals) if (own.call(locals, k)) buf[k] = locals[k];
      return buf;
    };
  /*/-statements-/*/
    res.inline = function (locals, decl, buf) {
      if (arguments.length === 1) {
        decl = locals; locals = {};
      }
      declarations(
        decl,
        buf = [],
        "", // prefix
        emptyArray, // vendors
        function localize(match, space, global, dot, name) {
          if (global) return space+global;
          if (!locals[name]) return name;
          return space + dot + locals[name];
        });
      return finalize(buf);
    };

    res.prefix = function(val, vendors) {
      return cartesian(
        vendors.map(function(p){return "-" + p + "-";}).concat([""]),
        [val]
      );
    };
    return res;
  }
  j2c(j2c);

  return j2c;

});