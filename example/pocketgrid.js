/*! PocketGrid 1.1.0
* Copyright 2013 Arnaud Leray
* MIT License
*/
var j2c = require("../dist/j2c.commonjs");

j2c.vendors = [];

console.log(j2c.sheet("").add({
  /* Border-box-sizing */
  ".block,.blockgroup":{
    ",:before,:after":{ // note the initial coma.
                        // it expands to the cross product, of 
                        // [".block", ".blockgroup"]  and
                        // ["", ":before", ":after"]thus:
                        //   .block, .blockgroup,
                        //   .block:before, .blockgroup:before,
                        //   .block:after, .blockgroup:after
      "box-sizing":"border-box"
    }
  },
  ".blockgroup": [
    /* Clearfix */
    "*zoom: 1",
    {
      ":before,:after": {
        display: "table",
        content: '""',
        "line-heigth": 0
      },
      ":after": {clear:"both"},

      /* ul/li compatibility */
      "list-style-type":"none",
      padding:0,
      margin:0,

      " > .blockgroup": {
        /* Nested grid */
        clear: "none",
        float: "left",
        margin: "0 !important"
      }
    }
  ],
  /* Default block */
  ".block": {
    float: "left",
    width: "100%"
  }
}).toString())