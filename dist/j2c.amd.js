define(function () { 'use strict';

var emptyObject = {};
var type = emptyObject.toString;
var ARRAY =  type.call([]);
var NUMBER = type.call(0);
var OBJECT = type.call(emptyObject);
var STRING = type.call('');
var FUNCTION = type.call(type);
var own =  emptyObject.hasOwnProperty;
var freeze = Object.freeze || function(o) {return o};


function defaults(target, source) {
  for (var k in source) if (own.call(source, k)) {
    if (k.indexOf('$') && !(k in target)) target[k] = source[k];
  }
  return target
}

function cartesian(a,b) {
  var res = [], i, j;
  for (j in b) if(own.call(b, j))
    for (i in a) if(own.call(a, i))
      res.push(a[i] + b[j]);
  return res
}

// "Tokenizes" the selectors into parts relevant for the next function.
// Strings and comments are matched, but ignored afterwards.
// This is not a full tokenizers. It only recognizes comas, parentheses,
// strings and comments.
// regexp generated by scripts/regexps.js then trimmed by hand
var selectorTokenizer = /[(),]|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\//g;


/**
 * This will split a coma-separated selector list into individual selectors,
 * ignoring comas in strings, comments and in :pseudo-selectors(parameter, lists).
 *
 * @param {string} selector
 * @return {string[]}
 */

function splitSelector(selector) {
  var indices = [], res = [], inParen = 0, o;
  /*eslint-disable no-cond-assign*/
  while (o = selectorTokenizer.exec(selector)) {
  /*eslint-enable no-cond-assign*/
    switch (o[0]) {
    case '(': inParen++; break
    case ')': inParen--; break
    case ',': if (inParen) break; indices.push(o.index);
    }
  }
  for (o = indices.length; o--;){
    res.unshift(selector.slice(indices[o] + 1));
    selector = selector.slice(0, indices[o]);
  }
  res.unshift(selector);
  return res
}

// Like the `selectorTokenizer`, but for the `&` operator
var ampersandTokenizer = /&|"(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\//g;

function ampersand (selector, parents) {
  var indices = [], split = [], res, o;
  /*eslint-disable no-cond-assign*/
  while (o = ampersandTokenizer.exec(selector)) {
  /*eslint-enable no-cond-assign*/
    if (o[0] == '&') indices.push(o.index);
  }
  for (o = indices.length; o--;){
    split.unshift(selector.slice(indices[o] + 1));
    selector = selector.slice(0, indices[o]);
  }
  split.unshift(selector);
  if (split.length === 1) split.unshift('');
  res = [split[0]];
  for (o = 1; o < split.length; o++) {
    res = cartesian(res, cartesian(parents, [split[o]]));
  }
  return res.join(',')
}

function flatIter (f) {
  return function iter(arg) {
    if (type.call(arg) === ARRAY) for (var i= 0 ; i < arg.length; i ++) iter(arg[i]);
    else f(arg);
  }
}

var chars = '';
function randChars(n) {
  while(chars.length < n) chars += Math.floor(Math.random() * 0x100000000).toString(36);
  var res = '_' + chars.slice(0, n);
  chars = chars.slice(n);
  return res
}

function decamelize(match) {
  return '-' + match.toLowerCase()
}

/**
 * Handles the property:value; pairs.
 *
 * @param {object} frontend - holds the localizer- and walker-related methods
 *                            and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {string} prefix - the current property or a prefix in case of nested
 *                          sub-properties.
 * @param {array|object|string} o - the declarations.
 * @param {boolean} local - are we in @local or in @global scope.
 */

function declarations(frontend, emit, prefix, o, local) {
  var k, v, kk;
  if (o==null) return

  switch ( type.call(o = o.valueOf()) ) {
  case ARRAY:
    for (k = 0; k < o.length; k++)

      declarations(frontend, emit, prefix, o[k], local);

    break
  case OBJECT:
    // prefix is falsy iif it is the empty string, which means we're at the root
    // of the declarations list.

    for (k in o) if (own.call(o, k)){
      v = o[k];
      if (k.indexOf('$') !== -1) {
        for (kk in (k = k.split('$'))) if (own.call(k, kk)) {

          declarations(frontend, emit, prefix + k[kk], v, local);

        }
      } else {

        declarations(frontend, emit, prefix + k, v, local);

      }
    }
    break
  default:
    // prefix is falsy when it is "", which means that we're
    // at the top level.
    // `o` is then treated as a `property:value` pair, or a
    // semi-colon-separated list thereof.
    if (!prefix) return emit.raw(o)

    // Otherwise, `prefix` is the property name, and
    // `o` is the value.

    // restore the dashes
    k = prefix.replace(/[A-Z]/g, decamelize);

    if (local && (k == 'animation-name' || k == 'animation')) {
      // no need to tokenize here a plain `.split(',')` has all bases covered.
      // We may 'localize' a comment, but it's not a big deal.
      o = o.split(',').map(function (o) {

        return o.replace(/^\s*(?:(var\([^)]+\))|:?global\(\s*([_A-Za-z][-\w]*)\s*\)|()(-?[_A-Za-z][-\w]*))/, frontend.localizeReplacer)

      }).join(',');
    }

    emit.decl(k, o);
  }
}

/**
 * Add rulesets and other CSS tree to the sheet.
 *
 * @param {object} frontend - holds the localizer- and walker-related methods
 *                            and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {string} prefix - the current selector or a prefix in case of nested rules
 * @param {array|string|object} tree - a source object or sub-object.
 * @param {string} nestingDepth - are we nested in an at-rule?
 * @param {boolean} local - are we in @local or in @global scope?
 */
function rules(frontend, emit, prefix, tree, local, nestingDepth) {
  var k, v, inDeclaration, kk;

  switch (type.call(tree)) {

  case OBJECT:
    for (k in tree) if (own.call(tree, k)) {
      v = tree[k];

      if (prefix.length > 0 && /^\*?[-\w$]+$/.test(k)) {
        if (!inDeclaration) {
          inDeclaration = 1;

          emit.rule(prefix);

        }
        if (k.indexOf('$') !== -1) {
          for (kk in (k = k.split('$'))) if (own.call(k, kk)) {

            declarations(frontend, emit, k[kk], v, local);

          }
        } else {

          declarations(frontend, emit, k, v, local);

        }

      } else if (k.charAt(0) === '@') {
        // Handle At-rules
        inDeclaration = 0;

        frontend.atrules(frontend, emit,
          /^(.(?:-[\w]+-)?([_A-Za-z][-\w]*))\b\s*([\s\S]*?)\s*$/.exec(k) || [k,'@','',''],
          v, prefix, local, nestingDepth
        );

      } else {
        // selector or nested sub-selectors
        inDeclaration = 0;

        if (k === '') {
          emit._rule();
          emit.err("Invalid selector ''");
          continue
        }

        rules(
          frontend, emit,
          // build the selector `prefix` for the next iteration.
          // ugly and full of redundant bits but so far the fastest/shortest.gz
          /*0 if*/(prefix.length > 0 && (prefix.indexOf(',') + k.indexOf(',') !== -2)) ?

            /*0 then*/ (kk = splitSelector(prefix), splitSelector(
              local ?

                k.replace(
                  /("(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\/)|:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g,
                  frontend.localizeReplacer
                ) :

                k
            ).map(function (k) {
              return (k.indexOf('&') !== -1) ? ampersand(k, kk) : kk.map(function(kk) {
                return kk + k
              }).join(',')
            }).join(',')) :

            /*0 else*/ /*1 if*/ (k.indexOf('&') !== -1) ?

              /*1 then*/ ampersand(
                local ?

                  k.replace(
                    /("(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\/)|:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g,
                    frontend.localizeReplacer
                  ) :

                  k,
                [prefix]
              ) :

              /*1 else*/ prefix + (
                local ?

                  k.replace(
                    /("(?:\\.|[^"\n])*"|'(?:\\.|[^'\n])*'|\/\*[\s\S]*?\*\/)|:global\(\s*(\.-?[_A-Za-z][-\w]*)\s*\)|(\.)(-?[_A-Za-z][-\w]*)/g,
                    frontend.localizeReplacer
                  ) :

                  k
                ),
           v, local, nestingDepth + 1
        );

      }
    }

    break

  case ARRAY:
    for (k = 0; k < tree.length; k++){

      rules(frontend, emit, prefix, tree[k], local, nestingDepth);

    }
    break

  case STRING:
    // CSS hacks or ouptut of `j2c.inline`. Even raw rulesets if in top position.

    if (prefix.length) emit.rule(prefix);

    emit.raw(tree);

  }
}

// This is the first entry in the filters array, which is
// actually the last step of the compiler. It inserts
// closing braces to close normal (non at-) rules (those
// that start with a selector). Doing it earlier is
// impossible without passing frontend around in unrelated code
// or ending up with duplicated selectors when the source tree
// contains arrays.
// There's no `_rule` handler, because the core compiler never
// calls it.
function closeSelectors(next, inline) {
  var lastSelector;
  return inline ? next : {
    init: function(){lastSelector = ''; next.init();},
    done: function () {
      if (lastSelector) {next._rule(); lastSelector = '';}
      return next.done()
    },
    atrule: function (rule, kind, param, takesBlock) {
      if (lastSelector) {next._rule(); lastSelector = '';}
      next.atrule(rule, kind, param, takesBlock);
    },
    _atrule: function (rule) {
      if (lastSelector) {next._rule(); lastSelector = '';}
      next._atrule(rule);
    },
    rule: function (selector) {
      if (selector !== lastSelector){
        if (lastSelector) next._rule();
        next.rule(selector);
        lastSelector = selector;
      }
    },
    _rule: function(){
      if (lastSelector) {next._rule(); lastSelector = '';}
    }
  }
}

/**
 * Handle at-rules
 *
 * @param {object} frontend - holds the localizer- and walker-related methods
 *                         and state
 * @param {object} emit - the contextual emitters to the final buffer
 * @param {array} k - The parsed at-rule, including the parameters,
 *                    if takes both parameters and a block.
 *                    k == [match, fullAtRule, atRuleType, params?]
 *                    So in `@-webkit-keyframes foo`, we have
 *                     - match = "@-webkit-keyframes foo"
 *                     - fullAtRule = "@-webkit-keyframes"
 *                     - atRuleType = "keyframes"
 *                     - params = "foo"
 * @param {string|string[]|object|object[]} v - Either parameters for
 *                                              block-less rules or
 *                                              their block
 *                                              for the others.
 * @param {string} prefix - the current selector or the selector prefix
 *                          in case of nested rules
 * @param {boolean} local - are we in @local or in @global scope?
 * @param {string} nestingDepth - are we nested in an at-rule or a selector?
 */


function modulesAtRules(next) {
  return function (frontend, emit, k, v, prefix, local, nestingDepth) {
    if (k[2] === 'global' && !k[3]) {

      rules(frontend, emit, prefix, v, 0, nestingDepth);


    } else if (k[2] === 'local' && !k[3]) {

      rules(frontend, emit, prefix, v, 1, nestingDepth);


    } else if (k[2] === 'adopt' && k[3]) {

      if (!local || nestingDepth) return emit.err('@adopt global or nested: ' + k[0])

      if (!/^\.?[_A-Za-z][-\w]*$/.test(k[3])) return emit.err('bad adopter ' + JSON.stringify(k[3]) + ' in ' + k[0])

      var classes = [];
      flatIter(function(adoptee, asString) {

        if(adoptee == null || !/^\.?[_A-Za-z][-\w]*(?:\s+\.?[_A-Za-z][-\w]*)*$/.test(asString = adoptee + '')) emit.err('bad adoptee '+ JSON.stringify(adoptee) + ' in ' + k[0]);

        else classes.push(asString.replace(/\./g, ''));

      })(v);

      // we may end up with duplicate classes but AFAIK it has no consequences on specificity.
      if (classes.length) {
        frontend.localize(k[3] = k[3].replace(/\./g, ''));
        frontend.names[k[3]] += (' ' + classes.join(' '));
      }

    } else {
      if (local && k[2] === 'keyframes' && k[3]) {

        k[3] = k[3].replace(
          // generated by script/regexps.js
          /(var\([^)]+\))|:?global\(\s*([_A-Za-z][-\w]*)\s*\)|()(-?[_A-Za-z][-\w]*)/,
          frontend.localizeReplacer
        );

      }
      next(frontend, emit, k, v, prefix, local, nestingDepth);
    }
  }
}
function standardAtRules(next) {
  return function(frontend, emit, k, v, prefix, local, nestingDepth) {
    if ((k[2] === 'namespace' || k[2] === 'import' || k[2] === 'charset') && !k[3]) {
      flatIter(function(v) {

        emit.atrule(k[1], k[2], v);

      })(v);


    } else if (k[2] === 'font-face' || k[2] === 'page' || k[2] === 'viewport') {
      flatIter(function(v) {

        emit.atrule(k[1], k[2], k[3], 'decl');

        declarations(frontend, emit, '', v, local);

        emit._atrule();

      })(v);

    } else if (( k[2] === 'media'|| k[2] === 'supports') && k[3] || k[2] === 'keyframes') {

      if (k[2] === 'keyframes' && k[3] === '') {
        if(prefix !== '') {
          k[3] = '_' + randChars(8);
          emit.rule(prefix);
          emit.decl('animation-name', k[3]);
        } else {
          emit.err('Unexpected anonymous @keyframes out of selector');
          return
        }
      }


      emit.atrule(k[1], k[2], k[3], 'rule');

      rules(
        frontend, emit,
        'keyframes' == k[2] ? '' : prefix,
        v, local, nestingDepth + 1
      );

      emit._atrule();

    } else {

      next(frontend, emit, k, v, prefix, local, nestingDepth);

    }
  }
}

function unsupportedAtRule(frontend, emit, k){
  emit.err('Unsupported at-rule: ' + k[0]);
}

var baselineAtRules = modulesAtRules(standardAtRules(unsupportedAtRule));

function invoke(fn, tree, state, backend) {
  backend.init();
  try{
    fn(
      state,
      backend,
      '', // prefix
      tree,
      1,  // local, by default
      0   // nesting depth, only for sheet
    );
  } catch(e) {backend.err(e instanceof Error ? e.stack : '' + e);}
  return backend.done()
}

function makeInstance(prefix, suffix, atrules, nsCache, backend, setPropList) {
  var names = {};
  function localize(name) {
    if (!own.call(names, name)) names[name] = prefix + name + suffix;
    return names[name].match(/^\S+/)
  }
  var state =  {
    atrules: atrules,
    names: names,
    /**
     * Returns a localized version of a given name.
     * Registers the pair in `instnace.name` if needed.
     *
     * @param {string} name - the name to localize
     * @return {string} - the localized version
     */
    localize: localize,
    /**
     * Used as second argument for str.replace(localizeRegex, replacer)
     * `ignore`, `global` and `(dot, name)` are mutually exclusive
     *
     * @param {string} match - the whole match (ignored)
     * @param {string|null} ignore - a comment or a string literal
     * @param {string|null} global - a global name
     * @param {string|null} dot - either '.' for a local class name or the empty string otherwise
     * @param {string|null} name - the name to localize
     * @return {string}
     */
    localizeReplacer: function (match, ignore, global, dot, name) {
      return ignore || global || dot + localize(name)
    }
  };

  var instance = {
    ns: function(name) {
      var prefix = '__'+name.replace(/\W+/g, '_') + '_';
      if (!own.call(nsCache, prefix)) {
        nsCache[prefix] = makeInstance(prefix, suffix, atrules, nsCache, backend, setPropList);
      }
      return nsCache[prefix]
    },
    names: names,
    prefix: prefix,
    suffix: suffix,
    sheet: function(tree) {return invoke(rules, tree, state, backend[0])},
    inline: function (tree) {return invoke(declarations, tree, state, backend[1])}
  };
  for (var i = setPropList.length; i--;) defaults(instance, setPropList[i]);
  return instance
}

function J2c(options) {
  options = options || {};
  // the buffer that accumulates the output. Initialized in `$sink.init()`
  var buf, err;

  // the default sink.
  var _backend = [{
    init: function () {buf=[], err=[];},
    done: function (raw) {
      if (err.length != 0) throw new Error('j2c error(s): ' + JSON.stringify(err,null,2) + ' in context:\n' + buf.join(''))
      return raw ? buf : buf.join('')
    },
    err: function (msg) {
      err.push(msg);
      buf.push('/* +++ ERROR +++ ' + msg + ' */\n');
    },
    raw: function (str) {buf.push(str, '\n');},
    atrule: function (rule, kind, param, takesBlock) {
      buf.push(rule, param && ' ', param, takesBlock ? ' {\n' : ';\n');
    },
    // close atrule
    _atrule: function () {buf.push('}\n');},
    rule: function (selector) {buf.push(selector, ' {\n');},
    // close rule
    _rule: function () {buf.push('}\n');},
    decl: function (prop, value) {buf.push(prop, ':', value, ';\n');}
  }];

  // holds the `_filter` and `atrule` handlers
  var _filters = [closeSelectors];
  var _atrulePlugins = [];
  var _setPropList = [];
  var _suffix = randChars(7);
  var _nsCache = {};
  var _atrules = baselineAtRules;
  // the public API (see the main docs)


  // handler options
  if (type.call(options.plugins) === ARRAY) {
    flatIter(function(plugin) {
      if (type.call(plugin) !== OBJECT) throw new Error('bad plugin, object expected, got '+ type.call(plugin))

      if (type.call(plugin.filter) === FUNCTION) _filters.push(plugin.filter);
      if (type.call(plugin.atrule) === FUNCTION) _atrulePlugins.push(plugin.atrule);
      if (type.call(plugin.sink) === FUNCTION) _backend = plugin.sink();
      if (type.call(plugin.set) === OBJECT) _setPropList.push(plugin.set);
    })(options.plugins);
  }
  if (type.call(options.suffix) === STRING) _suffix = options.suffix;
  if (type.call(options.suffix) === NUMBER) _suffix = randChars(options.suffix);

  for (var i = _atrulePlugins.length; i--;) _atrules = _atrulePlugins[i](_atrules);

  _backend[1] = _backend[1] || {
    init: _backend[0].init,
    done: _backend[0].done,
    raw: _backend[0].raw,
    err: _backend[0].err,
    decl: _backend[0].decl
  };

  // finalize the backend by merging in the filters
  for(i = 0; i < 2; i++){ // 0 for j2c.sheet, 1 for j2c.inline
    for (var j = _filters.length; j--;) {
      _backend[i] = freeze(
        defaults(
          _filters[j](_backend[i], !!i),
          _backend[i]
        )
      );
    }
  }
  return freeze(makeInstance('', _suffix, _atrules, _nsCache, _backend, _setPropList))
}

return J2c;

});
