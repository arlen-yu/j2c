'use strict';

var emptyArray = [];
var emptyObject = {};
var type = emptyObject.toString;
var ARRAY =  type.call(emptyArray);
var OBJECT = type.call(emptyObject);
var STRING = type.call('');
var FUNCTION = type.call(type);
var own =  emptyObject.hasOwnProperty;
function cartesian(a,b) {
  var res = [], i, j
  for (j in b) if(own.call(b, j))
    for (i in a) if(own.call(a, i))
      res.push(a[i] + b[j])
  return res
}

// "Tokenizes" the selectors into parts relevant for the next function.
// Strings and comments are matched, but ignored afterwards.
// This is not a full tokenizers. It only recognizes comas, parentheses,
// strings and comments.
// regexp generated by scripts/regexps.js then trimmed by hand
var selectorTokenizer = /[(),]|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\//g


/**
 * This will split a coma-separated selector list into individual selectors,
 * ignoring comas in strings, comments and in :pseudo-selectors(parameter, lists).
 * @param {string} selector
 * @return {string[]}
 */

function splitSelector(selector) {
  var indices = [], res = [], inParen = 0, o
  /*eslint-disable no-cond-assign*/
  while(o = selectorTokenizer.exec(selector)) {
  /*eslint-enable no-cond-assign*/
    switch(o[0]){
    case '(': inParen++; break
    case ')': inParen--; break
    case ',': if (inParen) break; indices.push(o.index)
    }
  }
  for (o = indices.length; o--;){
    res.unshift(selector.slice(indices[o] + 1))
    selector = selector.slice(0, indices[o])
  }
  res.unshift(selector)
  return res
}

// This is like the `selectorTokenizer`, but for the `&` operator

var ampersandTokenizer = /&|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\//g

function ampersand (selector, parents) {
  var indices = [], split = [], res, o
  /*eslint-disable no-cond-assign*/
  while(o = ampersandTokenizer.exec(selector)) {
  /*eslint-enable no-cond-assign*/
    if (o[0] == '&') indices.push(o.index)
  }
  for (o = indices.length; o--;){
    split.unshift(selector.slice(indices[o] + 1))
    selector = selector.slice(0, indices[o])
  }
  split.unshift(selector)
  res = [split[0]]
  for (o = 1; o < split.length; o++) {
    res = cartesian(res, cartesian(parents, [split[o]]))
  }
  return res.join(',')
}

function flatIter (f) {
  return function iter(arg) {
    if (type.call(arg) === ARRAY) for (var i= 0 ; i < arg.length; i ++) iter(arg[i])
    else f(arg)
  }
}

function decamelize(match) {
  return '-' + match.toLowerCase()
}

/**
 * Handles the property:value; pairs.
 *
 * @param {object} parser - holds the parser-related methods and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {string} prefix - the current property or a prefix in case of nested
 *                          sub-properties.
 * @param {array|object|string} o - the declarations.
 * @param {boolean} local - are we in @local or in @global scope.
 */

function declarations(parser, emit, prefix, o, local) {
  var k, v, kk
  if (o==null) return

  switch ( type.call(o = o.valueOf()) ) {
  case ARRAY:
    for (k = 0; k < o.length; k++)

      declarations(parser, emit, prefix, o[k], local)

    break
  case OBJECT:
    // prefix is falsy iif it is the empty string, which means we're at the root
    // of the declarations list.
    prefix = (prefix && prefix + '-')
    for (k in o) if (own.call(o, k)){
      v = o[k]
      if (/\$/.test(k)) {
        for (kk in (k = k.split('$'))) if (own.call(k, kk)) {

          declarations(parser, emit, prefix + k[kk], v, local)

        }
      } else {

        declarations(parser, emit, prefix + k, v, local)

      }
    }
    break
  default:
    // prefix is falsy when it is "", which means that we're
    // at the top level.
    // `o` is then treated as a `property:value` pair, or a
    // semi-colon-separated list thereof.
    // Otherwise, `prefix` is the property name, and
    // `o` is the value.

    // restore the dashes
    k = prefix.replace(/_/g, '-').replace(/[A-Z]/g, decamelize)

    if (local && (k == 'animation-name' || k == 'animation' || k == 'list-style')) {
      // no need to tokenize here a plain `.split(',')` has all bases covered.
      // We may 'parser' a comment, but it's not a big deal.
      o = o.split(',').map(function (o) {

        return o.replace(/:?global\(\s*([_A-Za-z][-\w]*)\s*\)|()(-?[_A-Za-z][-\w]*)/, parser.l)

      }).join(',')
    }

    emit.d(k, k ? ':': '', o, ';\n')

  }
}

/**
 * Hanldes at-rules
 *
 * @param {object} parser - holds the parser-related methods and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {array} k - The parsed at-rule, including the parameters,
 *                    if takes both parameters and a block.
 * @param {string} prefix - the current selector or the selector prefix
 *                          in case of nested rules
 * @param {string|string[]|object|object[]} v - Either parameters for
 *                                              block-less rules or
 *                                              their block
 *                                              for the others.
 * @param {string} inAtRule - are we nested in an at-rule?
 * @param {boolean} local - are we in @local or in @global scope?
 */

function atRules(parser, emit, k, v, prefix, local, inAtRule) {

  for (var i = 0; i < parser.A.length; i++) {

    if (parser.A[i](parser, emit, k, v, prefix, local, inAtRule)) return

  }

  if (!k[3] && /^global$/.test(k[2])) {

    sheet(parser, emit, prefix, v, 0, inAtRule)

  } else if (!k[3] && /^local$/.test(k[2])) {

    sheet(parser, emit, prefix, v, 1, inAtRule)

  } else if (!k[3] && /^(?:namespace|import|charset)$/.test(k[2])) {
    flatIter(function(v) {

      emit.a(k[0], ' ', v, ';\n')

    })(v)

  } else if (!k[3] && /^(?:font-face|viewport)$/.test(k[2])) {
    flatIter(function(v) {

      emit.a(k[1], '', '', ' {\n')

      declarations(parser, emit, '', v, local)

      emit.c('}\n')

    })(v)

  } else if (k[3] && /^(?:media|supports|page|keyframes)$/.test(k[2])) {

    if (local && 'keyframes' == k[2]) {
      k[3] = k[3].replace(
        // generated by script/regexps.js
        /:?global\(\s*([_A-Za-z][-\w]*)\s*\)|()(-?[_A-Za-z][-\w]*)/,
        parser.l
      )
    }


    emit.a(k[1], ' ', k[3], ' {\n')

    if ('page' == k[2]) {

      declarations(parser, emit, '', v, local)

    } else {

      sheet(
        parser, emit,
        'keyframes' == k[2] ? '' : prefix,
        v, local, 1
      )

    }

    emit.c('}\n')

  } else {

    emit.a('@-error-unsupported-at-rule', ' ', JSON.stringify(k[0]), ';\n')

  }
}

/**
 * Add rulesets and other CSS tree to the sheet.
 *
 * @param {object} parser - holds the parser-related methods and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {string} prefix - the current selector or a prefix in case of nested rules
 * @param {array|string|object} tree - a source object or sub-object.
 * @param {string} inAtRule - are we nested in an at-rule?
 * @param {boolean} local - are we in @local or in @global scope?
 */
function sheet(parser, emit, prefix, tree, local, inAtRule) {
  var k, v, inDeclaration, kk

  switch (type.call(tree)) {

  case OBJECT:
    for (k in tree) if (own.call(tree, k)) {
      v = tree[k]

      if (prefix && /^[-\w$]+$/.test(k)) {
        if (!inDeclaration) {
          inDeclaration = 1

          emit.s((prefix), ' {\n')

        }
        if (/\$/.test(k)) {
          for (kk in (k = k.split('$'))) if (own.call(k, kk)) {

            declarations(parser, emit, k[kk], v, local)

          }
        } else {

          declarations(parser, emit, k, v, local)

        }

      } else if (/^@/.test(k)) {
        // Handle At-rules

        inDeclaration = (inDeclaration && emit.c('}\n') && 0)

        atRules(parser, emit,
          /^(.(?:-[\w]+-)?([_A-Za-z][-\w]*))\b\s*(.*?)\s*$/.exec(k) || ['@','@','',''],
          v, prefix, local, inAtRule
        )

      } else {
        // selector or nested sub-selectors

        inDeclaration = (inDeclaration && emit.c('}\n') && 0)

        sheet(
          parser, emit,
          // prefix... Hefty. Ugly. Sadly necessary.
          (/,/.test(prefix) || prefix && /,/.test(k)) ?
            /*0*/ (kk = splitSelector(prefix), splitSelector(
              local ?

                k.replace(
                  /:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g, parser.l
                ) :

                k
            ).map(function (k) {
              return /&/.test(k) ? ampersand(k, kk) : kk.map(function(kk) {
                return kk + k
              }).join(',')
            }).join(',')) :
            /*0*/ /&/.test(k) ?
              /*1*/ ampersand(
                local ?

                  k.replace(
                    /:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g, parser.l
                  ) :

                  k,
                [prefix]
              ) :
              /*1*/ prefix + (
                local ?

                  k.replace(
                    /:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g, parser.l
                  ) :

                  k
                ),
           v, local, inAtRule
        )

      }
    }

    if (inDeclaration) emit.c('}\n')

    break

  case ARRAY:
    for (k = 0; k < tree.length; k++){

      sheet(parser, emit, prefix, tree[k], local, inAtRule)

    }
    break

  case STRING:
    // CSS hacks or ouptut of `j2c.inline`.

    emit.s(( prefix || ':-error-no-selector' ) , ' {\n')

    declarations(parser, emit, '', tree, local)

    emit.c('}\n')
  }
}

function global(x) {
  return ':global(' + x + ')'
}


function kv (k, v, o) {
  o = {}
  o[k] = v
  return o
}

function at (rule, params, block) {
  if (
    arguments.length < 3
  ) {
    // inner curry!
    var _at = at.bind.apply(at, [null].concat([].slice.call(arguments,0)))
    // So that it can be used as a key in an ES6 object literal.
    _at.toString = function(){return '@' + rule + ' ' + params}
    return _at
  }
  else return kv('@' + rule +' ' + params, block)
}

function j2c() {
  var filters = []
  var atHandlers = []
  var instance = {
    at: at,
    global: global,
    kv: kv,
    names: {},
    suffix: '__j2c-' +
      Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
      Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
      Math.floor(Math.random() * 0x100000000).toString(36) + '-' +
      Math.floor(Math.random() * 0x100000000).toString(36),
    use: function() {
      _use(emptyArray.slice.call(arguments))
      return instance
    },
    $plugins: []
  }

  function _default(target, source) {
    for (var k in source) if (own.call(source, k) && k.indexOf('$')) {
      if (OBJECT == type.call(source[k]) && OBJECT == type.call(target[k])) _default(target[k], source[k])
      else if (!(k in target)) target[k] = source[k]
    }
  }

  var _use = flatIter(function(plugin) {
    // `~n` is falsy for `n === -1` and truthy otherwise.
    // Works well to turn the  result of `a.indexOf(x)`
    // into a value that reflects the presence of `x` in
    // `a`.
    if (~instance.$plugins.indexOf(plugin)) return

    instance.$plugins.push(plugin)

    if (type.call(plugin) === FUNCTION) plugin = plugin(instance)

    if (!plugin) return

    flatIter(function(filter) {
      filters.push(filter)
    })(plugin.$filter||[])

    flatIter(function(handler) {
      atHandlers.push(handler)
    })(plugin.$at||[])

    _default(instance, plugin)
  })

  function makeEmitter(inline, parser) {
    var buf = []
    function push() {
      emptyArray.push.apply(buf, arguments)
    }
    var emit = {
      x: function(raw){return raw ? buf : buf.join('')},   // buf
      a: push, // at-rules
      s: push, // selector
      d: push, // declaration
      c: push  // close
    }
    for (var i = filters.length; i--;) emit = filters[i](emit, inline, parser)
    return emit
  }

  function localize(match, global, dot, name) {
    if (global) return global
    if (!instance.names[name]) instance.names[name] = name + instance.suffix
    return dot + instance.names[name].match(/^\S+/)
  }

  localize.a = atHandlers

/*/-statements-/*/
  instance.sheet = function(tree) {
    var parser = {
      A: atHandlers,
      a: atRules,
      d: declarations,
      l: localize,
      n: instance.names,
      s: sheet
    }
    var emit = makeEmitter(false, parser)
    sheet(
      parser,
      emit,
      '',    // prefix
      tree,
      1,      // local, by default
      0     // inAtRule
    )

    return emit.x()
  }
/*/-statements-/*/
  instance.inline = function (tree) {
    var parser = {
      d: declarations,
      l: localize,
      n: instance.names
    }
    var emit = makeEmitter(true, parser)
    declarations(
      parser,
      emit,
      '',         // prefix
      tree,
      1           //local
    )
    return emit.x()
  }

  return instance
}

var _j2c = j2c()
'sheet|inline|names|at|global|kv|suffix'.split('|').map(function(m){j2c[m] = _j2c[m]})

module.exports = j2c;