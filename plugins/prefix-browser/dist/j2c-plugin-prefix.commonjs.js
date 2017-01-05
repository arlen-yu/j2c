'use strict';

// Derived from Lea Verou's PrefixFree

var allStyles;
var styleAttr;
var styleElement;
function init() {
  allStyles = getComputedStyle(document.documentElement, null)
  styleAttr = document.createElement('div').style
  styleElement = document.documentElement.appendChild(document.createElement('style'))
}
function finalize() {
  document.documentElement.removeChild(styleElement)
  allStyles = styleAttr = styleElement = null
}

// Helpers, in alphabetic order

function camelCase(str) {
  return str.replace(/-([a-z])/g, function($0, $1) { return $1.toUpperCase() }).replace('-','')
}
function deCamelCase(str) {
  return str.replace(/[A-Z]/g, function($0) { return '-' + $0.toLowerCase() })
}
function supportedDecl(property, value) {
  styleAttr[property] = ''
  styleAttr[property] = value
  return !!styleAttr[property]
}
function supportedMedia(condition) {
  styleElement.textContent = '@media (' + condition +'){}'
  // Opera 11 treats unknown conditions as 'all', the rest as 'not all'.
  // So far tested in modern browsers (01/01/2017), and desktop IE9, FF4,
  // Opera 11/12, and Safari 6. TY SauceLabs.
  return !/^@media(?:\s+not)?\s+all/.test(styleElement.sheet.cssRules[0].cssText)
}
function supportedProperty(property) {
  // Some browsers like it dash-cased, some camelCased, most like both.
  return property in styleAttr || camelCase(property) in styleAttr
}
function supportedRule(selector) {
  styleElement.textContent = selector + '{}'
  return !!styleElement.sheet.cssRules.length
}

function detectAtrules(fixers) {
  if (fixers.prefix === '') return
  var atrules = {
    'keyframes': 'name',
    'viewport': null,
    'document': 'regexp(".")'
  }

  // build a map of {'@ruleX': '@-prefix-ruleX'}
  for(var atrule in atrules) {
    var test = atrule + ' ' + (atrules[atrule] || '')
    if (!supportedRule('@' + test) && supportedRule('@' + fixers.prefix + test)) {

      fixers.hasAtrules = true
      fixers.atrules['@' + atrule] = '@' + fixers.prefix + atrule
    }
  }

  // Standard
  fixers.hasDppx = supportedMedia('resolution:1dppx')
  // Webkit
  fixers.hasPixelRatio = supportedMedia(fixers.prefix + 'device-pixel-ratio:1')
  // Opera
  fixers.hasPixelRatioFraction = supportedMedia(fixers.prefix + 'device-pixel-ratio:1/1')

  if (fixers.hasPixelRatio || fixers.hasPixelRatioFraction) {
    fixers.properties['resolution'] = fixers.prefix + 'device-pixel-ratio'
    fixers.properties['min-resolution'] = fixers.prefix + 'min-device-pixel-ratio'
    fixers.properties['max-resolution'] = fixers.prefix + 'max-device-pixel-ratio'
    if (supportedMedia('min-' + fixers.prefix + 'device-pixel-ratio:1')) {
      // Mozilla/Firefox tunred a vendor prefix into a vendor infix
      fixers.properties['min-resolution'] = 'min-' + fixers.prefix + 'device-pixel-ratio'
      fixers.properties['max-resolution'] = 'max-' + fixers.prefix + 'device-pixel-ratio'
    }
  }
}

function detectFunctions(fixers) {
  // Values that might need prefixing
  if (fixers.prefix === '') return
  var functions = {
    'linear-gradient': {
      property: 'backgroundImage',
      params: 'red, teal'
    },
    'calc': {
      property: 'width',
      params: '1px + 5%'
    },
    'element': {
      property: 'backgroundImage',
      params: '#foo'
    },
    'cross-fade': {
      property: 'backgroundImage',
      params: 'url(a.png), url(b.png), 50%'
    }
  }
  functions['repeating-linear-gradient'] =
  functions['repeating-radial-gradient'] =
  functions['radial-gradient'] =
  functions['linear-gradient']

  // build an array of prefixable functions
  for (var func in functions) {
    var test = functions[func],
      property = test.property,
      value = func + '(' + test.params + ')'

    if (!supportedDecl(property, value) && supportedDecl(property, fixers.prefix + value)) {
      // It's only supported with a prefix
      fixers.hasFunctions = true
      fixers.functions.push(func)
    }
  }
}

// db of prop/value pairs whose values may need treatment.

var keywords = [
  //!\\ use camelCase property names only, the test mocks don't support
  //!\\ them kebab-cased

  // `initial` applies to all properties and is thus handled separately.
  {
    props: ['cursor'],
    values: [ 'grab', 'grabbing', 'zoom-in', 'zoom-out']
  },
  {
    props: ['display'],
    values:['box', 'flexbox', 'inline-flexbox', 'flex', 'inline-flex', 'grid', 'inline-grid']
  },
  {
    props: ['position'],
    values: [ 'sticky' ]
  },
  {
    props: ['width', 'columnWidth', 'height', 'maxHeight', 'maxWidth', 'minHeight', 'minWidth'],
    values: ['contain-floats', 'fill-available', 'fit-content', 'max-content', 'min-content']
  }
]
// The flexbox zoo
// (`flex-direction` => `box-orient` + `box-direction` is covered in main.js)
//
// ## Specs:
// - flex    (final):     https://www.w3.org/TR/css-flexbox-1/
// - flexbox (2012/ie10): https://www.w3.org/TR/2012/WD-css3-flexbox-20120322/
// - box     (2009/old):  https://www.w3.org/TR/2009/WD-css3-flexbox-20090723/
var ieAltProps = {
  'align-content': '-ms-flex-line-pack',
  'align-self': '-ms-flex-item-align',
  'align-items': '-ms-flex-align',
  'justify-content': '-ms-flex-pack',
  'order': '-ms-flex-order',
  'flex-grow': '-ms-flex-positive',
  'flex-shrink': '-ms-flex-negative',
  'flex-basis': '-ms-preferred-size'
}
var ieAltValues = {
  'space-around': 'distribute',
  'space-between': 'justify',
  'flex-start': 'start',
  'flex-end': 'end',
  'flex': 'flexbox',
  'inline-flex': 'inline-flexbox'
}
var oldAltProps = {
  'align-items': 'box-align',
  'justify-content': 'box-pack',
  'flex': 'box-flex', // https://css-tricks.com/snippets/css/a-guide-to-flexbox/#comment-371025,
  'flex-direction' : 'box-direction',// https://css-tricks.com/snippets/css/a-guide-to-flexbox/#comment-371025,
  'flex-wrap': 'box-lines',
  'order': 'box-ordinal-group' // https://css-tricks.com/snippets/css/a-guide-to-flexbox/#comment-371025
}
var oldAltValues = {
  'space-around': 'justify',
  'space-between': 'justify',
  'flex-start': 'start',
  'flex-end': 'end',
  'wrap-reverse': 'multiple',
  'wrap': 'multiple',
  'flex': 'box',
  'inline-flex': 'inline-box'
}

function detectKeywords(fixers) {
  if (fixers.prefix === '') return

  // build a map of {propertyI: {keywordJ: previxedKeywordJ, ...}, ...}
  for (var i = 0; i < keywords.length; i++) {
    var map = {}, property = keywords[i].props[0]
    // eslint-disable-next-line
    for (var j = 0, keyword; keyword = keywords[i].values[j]; j++) {

      if (
        !supportedDecl(property, keyword) &&
        supportedDecl(property, fixers.prefix + keyword)
      ) {
        fixers.hasKeywords = true
        map[keyword] = fixers.prefix + keyword
      }
    }
    // eslint-disable-next-line  
    for (j = 0; property = keywords[i].props[j]; j++) {
      fixers.keywords[deCamelCase(property)] = map
    }
  }
  if (fixers.keywords.display && fixers.keywords.display.flexbox) {
    // old IE
    fixers.keywords.display.flex = fixers.keywords.display.flexbox
    for (var k in ieAltProps) {
      fixers.properties[k] = ieAltProps[k]
      fixers.keywords[k] = ieAltValues
    }
  } else if (fixers.keywords.display && fixers.keywords.display.box) {
    // old flexbox spec
    fixers.keywords.display.flex = fixers.keywords.display.box
    fixers.oldFlexBox = true
    for (k in oldAltProps) {
      fixers.properties[k] = fixers.prefix + oldAltProps[k]
      fixers.keywords[k] = oldAltValues
    }
  }
  if (
    !supportedDecl('color', 'initial') &&
    supportedDecl('color', fixers.prefix + 'initial')
  ) {
    // `initial` does not use the `hasKeywords` branch.
    fixers.initial = fixers.prefix + 'initial'
  }
}

function detectPrefix(fixers) {
  var prefixCounters = {}
  // Why are we doing this instead of iterating over properties in a .style object? Because Webkit.
  // 1. Older Webkit won't iterate over those.
  // 2. Recent Webkit will, but the 'Webkit'-prefixed properties are not enumerable. The 'webkit'
  //    (lower case 'w') ones are, but they don't `deCamelCase()` into a prefix that we can detect.

  function iteration(property) {
    if(property.charAt(0) === '-') {
      var prefix = property.split('-')[1]

      // Count prefix uses
      prefixCounters[prefix] = ++prefixCounters[prefix] || 1
    }
  }

  // Some browsers have numerical indices for the properties, some don't
  if(allStyles && allStyles.length > 0) {
    for(var i=0; i<allStyles.length; i++) {
      iteration(allStyles[i])
    }
  } else {
    for(var property in allStyles) {
      iteration(deCamelCase(property))
    }
  }

  var highest = 0
  for(var prefix in prefixCounters) {

    if(highest < prefixCounters[prefix]) {
      highest = prefixCounters[prefix]
      fixers.prefix = '-' + prefix + '-'
    }
  }
  fixers.Prefix = camelCase(fixers.prefix)
}

function detectSelectors(fixers) {
  function prefixSelector(selector) {
    return selector.replace(/^::?/, function($0) { return $0 + fixers.prefix })
  }

  if (fixers.prefix === '') return
  var selectors = {
    ':read-only': 1,
    ':read-write': 1,
    ':any-link': 1,
    '::selection': 1
  }

  // builds an array of selectors that need a prefix.
  for(var selector in selectors) {
    if(!supportedRule(selector) && supportedRule(prefixSelector(selector))) {
      fixers.hasSelectors = true
      fixers.selectors.push(selector)
    }
  }
}

function blankFixers() {
  return {
    atrules: {},
    hasAtrules: false,
    hasDppx: false,
    hasFunctions: false,
    hasKeywords: false,
    hasPixelRatio: false,
    hasPixelRatioFraction: false,
    hasSelectors: false,
    hasValues: false,
    fixAtMediaParams: null,
    fixAtSupportsParams: null,
    fixProperty: null,
    fixSelector: null,
    fixValue: null,
    functions: [],
    initial: null,
    keywords: {},
    oldFlexBox: false,
    prefix: '',
    Prefix: '',
    properties: {},
    selectors: [],
    valueProperties: {
      'transition': 1,
      'transition-property': 1,
      'will-change': 1
    }
  }
}


function browserDetector(fixers) {
  // add the required data to the fixers object.
  init()
  detectPrefix(fixers)
  detectSelectors(fixers)
  detectAtrules(fixers)
  detectKeywords(fixers)
  detectFunctions(fixers)
  finalize()
}

var emptySet = {}
var own = {}.hasOwnProperty

var valueTokenizer = /[(),]|\/\*[\s\S]*?\*\//g


/**
 * For properties whose values are also properties, this will split a coma-separated
 * value list into individual values, ignoring comas in comments and in
 * functions(parameter, lists).
 *
 * @param {string} selector
 * @return {string[]}
 */

function splitValue(value) {
  var indices = [], res = [], inParen = 0, o
  /*eslint-disable no-cond-assign*/
  while (o = valueTokenizer.exec(value)) {
  /*eslint-enable no-cond-assign*/
    switch (o[0]) {
    case '(': inParen++; break
    case ')': inParen--; break
    case ',': if (inParen) break; indices.push(o.index)
    }
  }
  for (o = indices.length; o--;){
    res.unshift(value.slice(indices[o] + 1))
    value = value.slice(0, indices[o])
  }
  res.unshift(value)
  return res
}

function makeDetector (before, targets, after) {
  return new RegExp(before + '(?:' + targets.join('|') + ')' + after)
}

function makeLexer (before, targets, after) {
  new RegExp(
        "\"(?:\\\\[\\S\\s]|[^\"])*\"|'(?:\\\\[\\S\\s]|[^'])*'|\\/\\*[\\S\\s]*?\\*\\/|" +
            before + '((?:' +
            targets.join('|') +
            ')' + after + ')',
        'gi'
    )
}


function finalizeFixers(fixers) {
  var prefix = fixers.prefix

  var replacerString = '$&'+prefix

  function replacer (match, $1, $2) {
    if (!$1) return match
    return $1 + prefix + $2
  }

  var selectorMatcher = makeLexer('\\b', fixers.selectors, '\\b')
  var selectorReplacer = function(match, $1, $2) {
    return $1 + $2.replace(/^::?/, replacerString)
  }

  // Gradients are supported with a prefix, convert angles to legacy
  var gradientDetector = /\blinear-gradient\(/
  var gradientMatcher = /(^|\s|,)(repeating-)?linear-gradient\(\s*(-?\d*\.?\d*)deg/ig
  var gradientReplacer = function ($0, delim, repeating, deg) {
    return delim + (repeating || '') + 'linear-gradient(' + (90-deg) + 'deg'
  }

  // value = fix('functions', '(^|\\s|,)', '\\s*\\(', '$1' + self.prefix + '$2(', value);
  var functionsDetector = makeDetector('(?:^|\\s|,)', fixers.fuctions, '\\s*\\(')
  var functionsMatcher = makeLexer('(^|\\s|,)', fixers.fuctions, '\\s*\\(')
  // use the default replacer


  // value = fix('properties', '(^|\\s|,)', '($|\\s|,)', '$1'+self.prefix+'$2$3', value);
  // No need to look for strings in these properties. We may insert prefixes in comments. Oh the humanity.
  var valuePropertiesMatcher = /^\s*([-\w]+)/gi
  var valuePropertiesReplacer = function(match, prop){
    return fixers.properties[prop] || fixers.fixProperty(prop)
  }

  fixers.fixProperty = function(prop) {
    var prefixed
    return fixers.properties[prop] = (
      supportedProperty(prop) ||
      !supportedProperty(prefixed = this.prefix + prop)
    ) ? prop : prefixed
  }

  var resolutionMatcher = /((?:min-|max-)?resolution)\s*:\s*((?:\d*.)?\d+)dppx/g
  var resolutionReplacer = (
    fixers.hasPixelRatio ? function(_, prop, param){return fixers.properties[prop] + ':' + param} :
    fixers.hasPixelRatioFraction ? function(_, prop, param){return fixers.properties[prop] + ':' + Math.round(param*10) + '/10'} :
    function(_, prop, param){return prop + ':' + 96 * param +'dpi'}
  )
  fixers.fixAtMediaParams = fixers.hasDppx ? function(p) {return p} : function (params) {
    return (params.indexOf('reso') !== -1) ?
      params.replace(resolutionMatcher, resolutionReplacer) :
      params
  }

  // comments not supported here. See https://www.debuggex.com/r/a3oAc6Y07xuknSVg
  var atSupportsParamsMatcher = /\(\s*([-\w]+)\s*:\s*((?:[-a-z]+\((?:var\(\s*[-\w]+\s*\)|[^\)])+\)|[^\)])+)\)/g
  function atSupportsParamsReplacer(prop, value) {
    return '(' + (fixers.properties || fixers.fixProperty(prop)) + ':' + fixers.fixValue(value, prop) + ')'
  }
  fixers.fixAtSupportsParams = function(params) {
    return params.replace(atSupportsParamsMatcher, atSupportsParamsReplacer)
  }

  fixers.fixSelector = function(selector) {
    return selectorMatcher.test(selector) ? selector.replace(selectorMatcher, selectorReplacer) : selector
  }

  fixers.fixValue = function (value, property) {
    var res = value
    if (fixers.initial != null && value === 'initial') return fixers.initial

    if (fixers.hasKeywords && (res = (fixers.keywords[property] || emptySet)[value])) return res

    if (own.call(fixers.valueProperties, property)) {
      if (value.indexOf(',') === -1) {
        return value.replace(valuePropertiesMatcher, valuePropertiesReplacer)
      } else {
        return splitValue(value).map(function(v) {
          return v.replace(valuePropertiesMatcher, valuePropertiesReplacer)
        }).join(',')
      }
    }
    if (fixers.hasGradients && gradientDetector.test(value)) res = value.replace(gradientMatcher, gradientReplacer)
    if (fixers.hasFunctions && functionsDetector.test(value)) res = value.replace(functionsMatcher, replacer)
    return res
  }

}

function createPrefixPlugin() {
  var fixers = blankFixers()
  if (typeof getComputedStyle === 'function') browserDetector(fixers)
  finalizeFixers(fixers)

  var cache = []

  prefixPlugin.setPrefix = function(f) {
    if (cache.indexOf(f) === -1) {
      finalizeFixers(f)
      cache.push(f)
    }
    fixers = f
  }

  function prefixPlugin() {
    return {
      $filter: function(next) {
        return {
          atrule: function(rule, kind, params, hasBlock) {
            next.atrule(
              fixers.fixAtrules && fixers.atrules[rule] || rule,
              kind,
              (
                kind === 'media'    ? fixers.fixAtMediaParams(params) :
                kind === 'supports' ? fixers.fixASupportsParams(params) :
                params
              ),
              hasBlock
            )
          },
          decl: function(property, value) {
            if (fixers.oldFlexBox && property === 'flex-direction' && typeof value === 'string') {
              next.decl(fixers.properties['box-orient'], value.indexOf('column') > -1 ? 'vertical' : 'horizontal')
              next.decl(fixers.properties['box-direction'], value.indexOf('reverse') > -1 ? 'reverse' : 'normal')
            } else {
              next.decl(
                fixers.properties[property] || fixers.fixProperty(property),
                fixers.fixValue(value, property)
              )
            }
          },
          rule: function(selector) {
            next.rule(
              fixers.hasRules ? fixers.fixSelector(selector) : selector
            )
          }
        }
      }
    }
  }
  return prefixPlugin
}

var plugin = createPrefixPlugin()

module.exports = plugin;