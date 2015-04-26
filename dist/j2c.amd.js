define('j2c', function(){return (function () {
  var
    type = ({}).toString,
    OBJECT = type.call({}),
    ARRAY =  type.call([]),
    default_scope = ".j2c_" + (Math.random() * 1e9 | 0) + "_",
    counter = 0;

  // Helper to compensate the fact that you can't have arbitrary expressions as
  // object literal keys.
  // Golfed implementation for maximal byte shaving :-)
  function _O(k, v, o) {
    (o = {})[k] = v;
    return o;
  }

  // Handles the property:value; pairs.
  function _declarations(o, buf, pfx, vendors, /*var*/ k, v) {
    switch (type.call(o)) {
    case ARRAY:
      o.forEach(function (o) {
        _declarations(o, buf, pfx, vendors);
      });
      break;
    case OBJECT:
      for (k in o) {
        v = o[k];
        pfx = (pfx && pfx + "-")
        if (k.indexOf("$") + 1) k.split("$").forEach(function(k){
          _declarations(v, buf, pfx + k, vendors);
        });
        else _declarations(v, buf, pfx + k, vendors);
      }
      break;
    default:
      // pfx is falsy when it is "", which means that we're
      // at the top level.
      // `o` is then treated as a `property:value` pair.
      // otherwise, `pfx` is the property name, and
      // `o` is the value.
      o = (pfx && (pfx).replace(/_/g, "-") + ":") + o + ";";
      vendors.forEach(function (v) {
        buf.push("-" + v + "-" + o);
      })
      buf.push(o)
    }
  }

  function j2c(o) {
    var buf = [];
    _declarations(o, buf, "", j2c.vendors);
    return buf.join("");
  }


  /*/-statements-/*/
  function Sheet(scope) {
    this.scope = (scope != null ? scope : default_scope + (counter++));
    this.buf = []
  }

  Sheet.prototype = Sheet;

  Sheet.add = function (statements) {
    _add(statements, this.buf, this.scope, j2c.vendors);
    return this
  };

  function _cartesian(a,b) {
    if (a.indexOf(",") + b.indexOf(",") + 2) {
      a = a.split(","), b = b.split(",")
      for (var i, j = 0, res = []; j < b.length; j++)
        for (i = 0; i< a.length; i++)
          res.push(a[i]+b[j]);
      return res.join(",");
    }
    return a + b;
  }

  // Add rulesets and other CSS statements to the sheet.
  function _add(statements, buf, pfx, vendors, /*var*/ k, v, decl) {
    switch (type.call(statements)) {
    case OBJECT:
      decl = {};
      for (k in statements) {
        v = statements[k];
        if (k[0] == "@"){
          // Handle At-rules
          if (type.call(v) == OBJECT) {
            buf.push(k + "{");
            _add(v, buf, pfx, vendors);
            buf.push("}");
          } else {
            buf.push(k + " " + v + ";");
          }
        } else if (k.match(/^[-\w$]+$/)) {
          // filter out declarations.
          decl[k] = v;
        } else {
          // Handle sub-selector.
          _add(v, buf, _cartesian(pfx, k), vendors);
        }
      }
      // fake loop to detect the presence of declarations.
      for (k in decl){
        buf.push(pfx + "{");
        _declarations(decl, buf, "", vendors);
        buf.push("}");
        break;
      }
      break;
    case ARRAY:
      statements.forEach(function (statement) {
        _add(statement, buf, pfx, vendors);
      })
      break;
    case "[object String]":
      // Treat the string as a block of declarations.
      buf.push(pfx + "{" + statements + "}");
    }
  }

  Sheet.keyframes = function(name, frames) {
    j2c.vendors.forEach(function(vendor) {
      _add(_O("@-" + vendor + "-keyframes " + name, frames), this.buf, "", [vendor]);
    }, this)
    _add(_O("@keyframes " + name, frames), this.buf, "", j2c.vendors);
    return this;
  }

  Sheet.font = function(o) {
    this.buf.push("@font-face{");
    _declarations(o, this.buf, "", []);
    this.buf.push("}");
    return this
  }

  Sheet.toString = Sheet.valueOf = function () {
    return this.buf.join("");
  };

  j2c.sheet = function(s) {return new Sheet("").add(s);}
  j2c.scoped = function(scope) {return new Sheet(scope);}

  /*/-statements-/*/
  j2c.vendors = ["o", "ms", "moz", "webkit"];
  return j2c;
})()

/*
Copyright © 2015 Pierre-Yves Gérardy

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the “Software”),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/});