// Once built as 'exposed.js' by '../scripts/build.js', this script
// exposes every relevant function from the plugin, including private
// ones, for testing.

export {blankFixers, finalizeFixers} from '../src/fixers.js'
export {init, finalize, camelCase, deCamelCase}   from '../src/detectors/utils.js'
export {detectAtrules}    from '../src/detectors/atrules.js'
export {detectFunctions}  from '../src/detectors/functions.js'
export {detectKeywords}   from '../src/detectors/keywords.js'
export {detectPrefix}     from '../src/detectors/prefix.js'
export {detectSelectors}  from '../src/detectors/selectors.js'