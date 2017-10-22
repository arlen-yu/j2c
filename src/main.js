import {defaults, flatIter, freeze, randIdentifier, own, type, ARRAY, FUNCTION, NUMBER, OBJECT, STRING} from './helpers'
import {closeSelectors, rules} from './rules'
import {declarations} from './declarations'
import {modulesAtRules, standardAtRules, unsupportedAtRule} from './at-rules'

var baselineAtRules = modulesAtRules(standardAtRules(unsupportedAtRule))

function invoke(fn, tree, state, backend) {
  backend.init()
  try{
    fn(
      state,
      backend,
      '', // selector/property prefix
      tree,
      1,  // local, by default
      0   // nesting depth, only for sheet
    )
  } catch(e) {backend.err(e instanceof Error ? e.stack : '' + e)}
  return backend.done()
}

function bakePrefix(name, length) {
  return (
    name
      ? name.replace(/\W+/g, '_') + '__'
      : randIdentifier(length) + '__'
  )
}

function makeInstance(prefix, prefixLength, atrules, nsCache, backend, setPropList) {
  var names = {}
  function localize(name) {
    if (!own.call(names, name)) names[name] = prefix + name
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
  }

  var instance = {
    ns: function(name) {
      var prefix = bakePrefix(name, prefixLength)
      if (!own.call(nsCache, prefix)) {
        nsCache[prefix] = makeInstance(prefix, prefixLength, atrules, nsCache, backend, setPropList)
      }
      return nsCache[prefix]
    },
    names: names,
    prefix: prefix,
    sheet: function(tree) {return invoke(rules, tree, state, backend[0])},
    inline: function (tree) {return invoke(declarations, tree, state, backend[1])}
  }
  for (var i = setPropList.length; i--;) defaults(instance, setPropList[i])
  return instance
}

export default function J2c(options) {
  options = options || {}
  // the buffer that accumulates the output. Initialized in `$sink.init()`
  var buf, err

  // the default sink.
  var _backend = [{
    init: function () {buf=[], err=[]},
    done: function (raw) {
      if (err.length != 0) throw new Error('j2c error(s): ' + JSON.stringify(err,null,2) + ' in context:\n' + buf.join(''))
      return raw ? buf : buf.join('')
    },
    err: function (msg) {
      err.push(msg)
      buf.push('/* +++ ERROR +++ ' + msg + ' */\n')
    },
    raw: function (str) {buf.push(str, '\n')},
    atrule: function (rule, kind, param, takesBlock) {
      buf.push(rule, param && ' ', param, takesBlock ? ' {\n' : ';\n')
    },
    // close atrule
    _atrule: function () {buf.push('}\n')},
    rule: function (selector) {buf.push(selector, ' {\n')},
    // close rule
    _rule: function () {buf.push('}\n')},
    decl: function (prop, value) {buf.push(prop, ':', value, ';\n')}
  }]

  // holds the `_filter` and `atrule` handlers
  var _filters = [closeSelectors]
  var _atrulePlugins = []
  var _setPropList = []
  var _prefixLength = 7, _prefix
  var _nsCache = {}
  var _atrules = baselineAtRules
  // the public API (see the main docs)


  // handler options
  if (type.call(options.plugins) === ARRAY) {
    flatIter(function(plugin) {
      if (type.call(plugin) !== OBJECT) throw new Error('bad plugin, object expected, got '+ type.call(plugin))

      if (type.call(plugin.filter) === FUNCTION) _filters.push(plugin.filter)
      if (type.call(plugin.atrule) === FUNCTION) _atrulePlugins.push(plugin.atrule)
      if (type.call(plugin.sink) === FUNCTION) _backend = plugin.sink()
      if (type.call(plugin.set) === OBJECT) _setPropList.push(plugin.set)
    })(options.plugins)
  }
  if (type.call(options.prefix) === NUMBER) _prefixLength = options.prefix
  _prefix = bakePrefix((type.call(options.prefix) === STRING) ? options.prefix: null, _prefixLength)

  for (var i = _atrulePlugins.length; i--;) _atrules = _atrulePlugins[i](_atrules)

  _backend[1] = _backend[1] || {
    init: _backend[0].init,
    done: _backend[0].done,
    raw: _backend[0].raw,
    err: _backend[0].err,
    decl: _backend[0].decl
  }

  // finalize the backend by merging in the filters
  for(i = 0; i < 2; i++){ // 0 for j2c.sheet, 1 for j2c.inline
    for (var j = _filters.length; j--;) {
      _backend[i] = freeze(
        defaults(
          _filters[j](_backend[i], !!i),
          _backend[i]
        )
      )
    }
  }
  return freeze(makeInstance(_prefix, _prefixLength, _atrules, _nsCache, _backend, _setPropList))
}
