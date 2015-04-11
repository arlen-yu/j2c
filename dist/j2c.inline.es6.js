export default (function () {
  var
    OBJECT = "[object Object]",
    NUMBER = "[object Number]",
    STRING = "[object String]",
    ARRAY = "[object Array]",
    type = inline.call.bind(({}).toString),
    counter = 0;

  function vendorify(prop, buf, indent, vendors) {
    vendors = vendors || m.vendors;
    vendors.forEach(function (v) {
      buf.push(indent + "-" + v + "-" + prop);
    })
    buf.push(indent + prop)
  }

  function inline(o) {
    var buf = [];
    _properties(o, buf, "", "");
    return buf.join("\n");
  }

  function _properties(o, buf, pfx, indent , k, t, v) {
    for (k in o) {
      v = o[k];
      t = type(v);
      switch (t) {
      case ARRAY:
        v.forEach(function (vv, oo) {
          oo = {};
          oo[k] = vv;
          _properties(oo, buf, pfx, indent);
        });
        break;
      case OBJECT:
        _properties(v, buf, pfx + k + "-", indent);
        break;
      default:
        vendorify(
          pfx + k + ":" + (t !== NUMBER || v === 0 ? v : v + m.unit) + ";",
          buf, indent
        );
      }
    }
  }

  //rules

  var m = {
    //rules
    inline: inline,
    vendors:["o", "ms", "moz", "webkit"],
    unit: "px"
  };

  return m;
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
*/;