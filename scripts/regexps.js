/*eslint-env node*/
/*eslint no-console: 0*/
/*eslint no-undef: 0*/

global.__proto__ = require('compose-regexp')

var maybe = greedy.bind(null, '?')
maybe()

var animation = either(
    sequence(
        /:?/,
        'global(',
        /\s*/,
        capture(/[-\w]+/),
        /\s*/,
        ')'
    ),
    sequence(
        capture(),
        capture(/[-\w]+/)
    )
)
console.log('animation / animation-name\n', animation)

var keyframes = either(
    sequence(
        /:?/,
        'global(',
        /\s*/,
        capture(/[-\w]+/),
        /\s*/,
        ')'
    ),
    sequence(
        capture(),
        capture(/[-\w]+/)
    )
)

console.log('@keyframes\n', keyframes)

var selector = flags('g', either(
    sequence(
        ':global(',
        /\s*/,
        capture(
            '.',
            /[-\w]+/
        ),
        /\s*/,
        ')'
    ),
    sequence(
        capture('.'),
        capture(/[-\w]+/)
    )
))

console.log('selector / @global\n', selector)

var composes = either(
    sequence(
        /:?/,
        'global(',
        /\s*\.?/,
        capture(/[-\w]+/),
        /\s*/,
        ')'
    ),
    sequence(
        capture(''),
        /\.?/,
        capture(/[-\w]+/)
    )
)

console.log('@composes\n', composes)

var selectorTokenizer = flags('g',
    either(
        /[(),]/,
        sequence(
            '"',
            greedy('*',
                either(
                    /\\./,
                    /[^"\n]/
                )
            ),
            '"'
        ),
        sequence(
            "'",
            greedy('*',
                either(
                    /\\./,
                    /[^'\n]/
                )
            ),
            "'"
        ),
        sequence(
            '/*',
            /[\s\S]*?/,
            '*/'
        )
    )
)
console.log('selectorTokenizer = ', selectorTokenizer)
