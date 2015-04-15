# j2c

A small JavaScript object to CSS compiler. ~820 bytes mingzipped.

Think SASS, but in JSONish syntax.

Inspired by restlye.js and JSS, but smaller :-).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Why?](#why)
- [Usage:](#usage)
  - [For building a style sheet:](#for-building-a-style-sheet)
    - [-vendor-prefixes](#-vendor-prefixes)
    - [root selector](#root-selector)
    - [Telling selectors and properties apart.](#telling-selectors-and-properties-apart)
    - [Overloading properties](#overloading-properties)
    - [At-rules](#at-rules)
    - [Combining multiple selectors](#combining-multiple-selectors)
    - [CSS Hacks](#css-hacks)
  - [For building inline styles](#for-building-inline-styles)
- [API Reference](#api-reference)
- [Limitations:](#limitations)
- [License: MIT](#license-mit)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Why?

* Send small, compact, SASS-like data down the line
* Simplify your asset pipeline
* Use the full power of JavaScript to create mixins, variables and macros
* Stop worrying about vendor prefixes
* Good fit for virtual DOM frameworks like React or Mithril
* I like writing compilers :-).

## Usage:

### For building a style sheet:

```JavaScript
j2c.vendors = [] // for the sake of this demo
                 // defaults to ["o", "ms", "moz", "webkit"].

r = j2c.sheet("ul.my_root_class")

r.add({
    "@media condition": {
        color: "red"
    },
    "font": { // properties for the main ul.my_root_class elements
        size: "2em",
        family: "sans-serif"
    },
    " li": { // sub-selector for children element, notice the initial space.
        padding:{
            left:5, //defaults to px unless otherwise specfied.
            top:10
        } 
    }
})

console.log(r.toString())
```

Output:

```CSS
@media condition{
  ul.my_root_class {
    color:red;
  }
}
ul.my_root_class  li{
  padding-left:5px;
  padding-top:10px;
}
ul.my_root_class {
  font-size:2em;
  font-family:sans-serif;
}
```

#### -vendor-prefixes

If you don't truncate the vendors list as I did in the example above, you'll get each property prefixed for each vendor.

Most of the resulting combinations don't make any sense (`-moz-color` FTW), and they are simply ignored by browsers. That's the price to pay for the small code size.

#### root selector

If no root selector is provided, `J2C` creates one (a unique class).

```JavaScript
r = j2c.sheet()
r.prefix // --> ".j2c_$token_$counter" where `$token` is unique per
         //     j2c instance, and `$counter` is incremented to 
         //     ensure that these classes are unique.
```

#### Telling selectors and properties apart.

`j2c` considers that object keys matching `/^[-_0-9A-Za-z]+$/` as properties, and everything else as (sub-)selectors.

Selectors are concatenated as is, while properties are concatenated with hyphens. `{" ul": {" li": {padding: {left:10}}}}` becomes ` ul li{padding-left:10px;}`. `{" p":{".foo":{color:"red"}}}`, is translated to ` p.foo:{color:red;}`.

#### Overloading properties

```JavaScript
r = j2c.sheet("ul.my_root_class")

r.add({
    "font-size": ["2em", "2rem"]
})

console.log(r.toString())
```
becomes
```CSS
.foo {
  font-size:2em;
  font-size:2rem;
}
```

Alternatively

```JavaScript
r = j2c.sheet("ul.my_root_class")

r.add([
    {
        "font-size": "2em"
    },
    {
        "font-size": "2rem"
    }
])

console.log(r.toString())
```
becomes
```CSS
ul.my_root_class {
  font-size:2em;
}
ul.my_root_class {
  font-size:2rem;
}
```

#### At-rules

Most At-rules are handled out of the box by `sheet.add()`. However, `@font-face` and `@keyframes` have are not covered and they are implemented respectively by `sheet.font(definitions)` and `sheet.keyframes(name, definitions)`. The latter automatically generates browser-specific `@-vendor-keyframes` blocks.

#### Combining multiple selectors

Here's a excerpt from the `j2c` port of the [PocketGrid](https://github.com/arnaudleray/pocketgrid/blob/44aa1154a56b11a852f7252943f265028c28f056/pocketgrid.css).

```JavaScript
j2c.sheet("").add({
  ".block,.blockgroup":{
    ",:before,:after":{          // Notice the initial coma.
      "box-sizing":"border-box"
    }
  }
}
```

Nesting `",:before,:after"` inside the `".block,.blockgroup"` block combines `[".block", ".blockgroup"]` with `["", ":before", ":after"]`, giving 

```CSS
.block,.block:before,.block:after,.blockgroup,.blockgroup:before,.blockgroup:after{
    box-sizing:border-box
}
```

Mathy folks call this as a Cartesian product.

#### CSS Hacks

Since `sheet.add` only accepts property names that match `/^[-_0-9A-Za-z]+$/`, it is not possible to express CSS hacks using objects. You can, however, work around the issue by using arrays and strings instead.

Here's another modified excerpt from the PocketGrid port:

```JavaScript
j2c.sheet("").add({
  ".blockgroup": [
    "*zoom: 1; /* hack */",
    {
      "list-style-type":"none",
      padding:0,
      margin:0
    }
  ]
})
```

Array elements are inserted in sequence, and string literals are treated as a list of properties, and inserted as is.

Result:

```CSS
.blockgroup{
*zoom: 1; /* hack */
}
.blockgroup{
  list-style-type:none;
  padding:0;
  margin:0;
}
```

### For building inline styles

```JavaScript
console.log(j2c.inline({
    float:"left";
}));
```
... outputs ...
```CSS
-o-float:left;
-ms-float:left;
-moz-float:left;
-webkit-float:left;
float:left;
```

## API Reference

`j2c` object

* `j2c.inline(props:(Object|Array|String)) : String`: returns a declaration list suitable for inline styles
* `j2c.sheet([root:String]) : Sheet`: Creates a Sheet object.
* `j2c.vendors = ["o", "ms", "moz", "webkit"]` (r/w): list of vendor prefixes.
* `j2c.unit = "px"` (r/w): the default unit. `{margin:5}` becomes `margin:5px`.


`Sheet` methods:

* `sheet.add(statements:(Object|Array|String)) : Sheet`: add a series of statements to the style sheet. Returns the `Sheet` for chaining.
* `sheet.font(definitions:(Object|Array|String)) : Sheet`: creates a `@font-face` block. Returns the `Sheet` for chaining.
* `sheet.keyframes(name:String, statements:(Object|Array|String)) : Sheet`: creates a `@keyframes` block. Returns the `Sheet` for chaining.
* `sheet.toString() : String`: the stylesheet in string form.

## Limitations:

`j2c` knows the bare minimum to output a valid stylesheet when provided with valid input. It will hapily accept invalid selectors, properties and values, and could in that case produce a broken stylesheet.

I may get around and write a validator companion, but I'm not there yet :-).

## License: MIT
