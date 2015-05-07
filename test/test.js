var j2c, 
    // used to normalize styles for reliable comparison.
    crass = require("crass"),
    expect = require("expect.js");


function check(result, expected){
    result = crass.parse(result).optimize().toString();

    // since you can't rely on the order of JS object keys, sometimes, several "expected"
    // values must be provided.
    expected = (expected instanceof Array ? expected : [expected]).map(function(s){
        return crass.parse(s).optimize().toString();
    });
    expect(expected).to.contain(result);
}


[
    "../dist/j2c.commonjs",
    "../dist/j2c.commonjs.min",
    "../dist/inline/j2c.commonjs",
    "../dist/inline/j2c.commonjs.min"
].forEach(function(lib){
    var j2c = require(lib)

    function checkinline(result, expected){
        result = "p{" + j2c(result) + "}"
        expected = (expected instanceof Array ? expected : [expected]).map(function(s){
            return "p{" + s + "}"
        });
        check(result, expected)
    }



      /////////////////////////////
     /**/  suite("Inline, ")  /**/
    /////////////////////////////


    test("a single property", function() {
        checkinline(
            {foo:"bar"},
            "foo:bar;"
        )
    });

    test("array of values", function() {
        checkinline(
            {foo:["bar", "baz"]},
            "foo:bar;foo:baz;"
        )
    });

    test("sub-properties", function(){
        checkinline(
            {foo:{bar:"baz"}},
            "foo-bar:baz;"
        )
    })

    test("multiple sub-properties", function(){
        checkinline(
            {foo:{bar$qux:"baz"}},
            "foo-bar:baz;foo-qux:baz;"
        )
    })

    test("multiple sub-properties with a sub-sub-property", function(){
        checkinline(
            {foo:{bar$baz:{qux:"quux"}}},
            "foo-bar-qux:quux;foo-baz-qux:quux;"
        )
    })

    test("multiple sub-properties with two sub-sub-properties", function(){
        checkinline(
            {foo:{bar$baz:{qux$quux:"fred"}}},
            "foo-bar-qux:fred;foo-bar-quux:fred;foo-baz-qux:fred;foo-baz-quux:fred;"
        )
    })

    test("convert underscores", function() {
        checkinline(
            {"f_o_o":"bar"},
            "f-o-o:bar;"
        )
    });

    test("String value", function() {
        checkinline(
            "foo:bar",
            "foo:bar;"
        )
    });

    test("Array of Strings values", function() {
        checkinline(
            ["foo:bar","foo:baz"],
            "foo:bar;foo:baz"
        )
    });

    test("Array of mixed values at the root", function() {
        checkinline(
            ["foo:bar",{foo:"baz"}],
            "foo:bar;foo:baz"
        )
    });

    test("Array of mixed value and sub-property", function() {
        checkinline(
            {foo:["bar", {baz:"qux"}]},
            "foo:bar;foo-baz:qux"
        )
    });

    test("Prefixes by hand", function() {
        checkinline(
            {_o$_p$:{foo:"bar"}},
            "-o-foo:bar;-p-foo:bar;foo:bar;"
        )
    });

    test("CSS *Hack", function() {
        checkinline(
            {"*foo":"bar"},
            "*foo:bar;"
        )
    });

    test("CSS _Hack", function() {
        checkinline(
            ["_foo:bar",{_baz:"qux"}],
            "_foo:bar;-baz:qux;"
        )
    });



      ///////////////////////////////////////////
     /**/  suite("Inline auto prefixes, ")  /**/
    ///////////////////////////////////////////

    before(function() {j2c.vendors = ["o", "p"]})
    after(function() {j2c.vendors = []})

    test("vendor prefixes", function() {
        checkinline(
            ["foo:bar",{foo:"baz"}],
            "-o-foo:bar;-p-foo:bar;foo:bar;-o-foo:baz;-p-foo:baz;foo:baz"
        )
    });

      ////////////////////////////
     /**/  suite("j2c.x, ")  /**/
    ////////////////////////////

    test("1 x 1", function() {
        var prod = j2c.x(["o"], "foo")
        expect(prod[0]).to.be("-o-foo")
        expect(prod[1]).to.be("foo")
    });

    test("2 x 1", function() {
        var prod = j2c.x(["o", "p"], "foo")
        expect(prod[0]).to.be("-o-foo")
        expect(prod[1]).to.be("-p-foo")
        expect(prod[2]).to.be("foo")
    });

});




["../dist/j2c.commonjs", "../dist/j2c.commonjs.min"].forEach(function(lib){
    var j2c = require(lib)

    function add(klass, o){
        return j2c.scoped(klass).add(o).toString()
    }



      ////////////////////////////
     /**/  suite("Scope, ")  /**/
    ////////////////////////////


    test("custom scope", function(){
        var sheet = j2c.scoped("foo")
        expect(sheet.scope).to.be("foo")
        check(
            sheet.add({foo:"bar"}).toString(),
            sheet.scope + "{foo:bar}"
        )
    });

    test("default scope", function(){
        var sheet = j2c.scoped()
        expect(sheet.scope[0]).to.be(".")
        check(
            sheet.add({foo:"bar"}).toString(),
            sheet.scope + "{foo:bar}"
        )
    });

    test("default scope must be unique", function(){
        expect(
            j2c.scoped().scope
        ).not.to.be(
            j2c.scoped().scope
        );
    });



      ////////////////////////////////
     /**/  suite("j2c.sheet, ")  /**/
    ////////////////////////////////


    test("empty sheet", function(){
        var sheet = j2c.sheet();
        expect(
            j2c.toString.call(sheet.__proto__)
        ).to.match(
            // \w\(\w\) for the minified version.
            /^function (Sheet\(scope\)|\w\(\w\))/
        );
        expect(sheet.scope).to.be("")
        expect(sheet.buf.length).to.be(0)
    })

    test("direct sheet call", function(){
        var sheet = j2c.sheet({" p":{foo:5}});
        expect(sheet.scope).to.be("")
        check(""+sheet, "p{foo:5}")
    })

    test("sheet.add", function(){
        var sheet = j2c.sheet().add({" p":{foo:5}});
        expect(sheet.scope).to.be("")
        check(""+sheet, "p{foo:5}")
    })


      //////////////////////////////////
     /**/  suite("Definitions, ")  /**/
    //////////////////////////////////


    test("basic", function() {
        check(
            add("p", {
                foo:"bar"
            }),
            "p{foo:bar}"
        )
    });

    test("convert underscores", function() {
        check(
            add("p", {
                foo_foo:"bar"
            }),
            "p{foo-foo:bar}"
        )
    });

    test("number values", function() {
        check(
            add("p", {
                foo:5
            }),
            "p{foo:5}"
        )
    });

    test("composed property name", function() {
        check(
            add("p", {
                foo:{bar:"baz"}
            }),

            "p{foo-bar:baz}"
        )
    });

    test("composed selector : child with a given class", function() {
        check(
            add("p", {
                " .foo":{bar:"baz"}
            }),

            "p .foo{bar:baz}"
        )
    });

    test("composed selector: add a class to the root", function() {
        check(
            add("p", {
                ".foo":{bar:"baz"}
            }),

            "p.foo{bar:baz}"
        )
    });

    test("manual vendor prefixes", function() {
        check(
            add("p", {
                _o$_ms$_moz$_webkit$: {foo: "bar"}
            }),

            "p {-o-foo:bar;-ms-foo:bar;-moz-foo:bar;-webkit-foo:bar;foo:bar}"
        )
    });

    test("mixing definitions and sub-selectors", function() {
        check(
            add("p", {
                foo:"bar",
                " .foo":{bar:"baz"}
            }),

            "p .foo{bar:baz} p {foo:bar}"
        )
    });



      ///////////////////////////////////////////////
     /**/  suite("Selector Cartesian product, ")  /**/
    ///////////////////////////////////////////////


    test("1 x 2", function() {
        check(
            add("p", {
                " .foo":{
                    ":before,:after":{
                        foo:"bar"
                    }
                }
            }),

            "p .foo:before, p .foo:after {foo:bar}"
        )
    });

    test("2 x 1", function() {
        check(
            add("p", {
                " .foo, .bar":{
                    ":before":{
                        foo:"bar"
                    }
                }
            }),

            "p .foo:before, p .bar:before {foo:bar}"
        )
    });

    test("2 x 2", function() {
        check(
            add("p", {
                " .foo, .bar":{
                    ":before,:after":{
                        foo:"bar"
                    }
                }
            }),

            "p .foo:before, p .bar:before, p .foo:after, p .bar:after {foo:bar}"
        )
    });


    test("2 x 3 one of which is empty", function() {
        check(
            add("p", {
                " .foo, .bar":{
                    ",:before,:after":{
                        foo:"bar"
                    }
                }
            }),

            "p .foo, p .bar, p .foo:before, p .bar:before, p .foo:after, p .bar:after {foo:bar}"
        )
    });



      /////////////////////////////////////////
     /**/  suite("Strings and Arrays, ")  /**/
    /////////////////////////////////////////


    test("String literal", function() {
        check(
            add("p", "foo:bar"),
            "p{foo:bar}"
        )
    });

    test("String literal with two declarations", function() {
        check(
            add("p", "foo:bar;baz:qux"),
            "p {foo:bar;baz:qux}"
        )
    });

    test("String literal starting with an underscore", function() {
        check(
            add("p", "_foo:bar"),
            "p {_foo:bar}"
        )
    });

    test("Array of String literals", function() {
        check(
            add("p", ["foo:bar", "foo:baz"]),
            "p{foo:bar;foo:baz}"
        )
    });


    test("overloaded properties", function() {
        check(
            add("p", {
                foo:["bar","baz"]
            }),
            "p{foo:bar;foo:baz}"
        )
    });

    test("overloaded sub-properties", function() {
        check(
            add("p", {
                foo:[{bar:"baz"},{bar:"qux"}]
            }),
            "p{foo-bar:baz;foo-bar:qux}"
        )
    });

    test("nested Arrays", function(){
        check(
            add("p", [
                [
                    {bar:"baz"},
                    {bar:"qux"}
                ],
                "bar:quux;"
            ]),
            "p {bar:baz;bar:qux;bar:quux}"
        )
    })



      //////////////////////////////////////////
     /**/  suite("Sheet auto prefixes, ")  /**/
    //////////////////////////////////////////

    before(function() {j2c.vendors = ["o", "p"]})
    after(function() {j2c.vendors = []})

    test("String literal", function() {
        check(
            add("p", "foo:bar"),
            "p{-o-foo:bar;-p-foo:bar;foo:bar}"
        )
    });

    test("Array of Strings", function() {
        check(
            add("p", ["foo:bar", "_baz:qux"]),
            "p{-o-foo:bar;-p-foo:bar;foo:bar;-o-_baz:qux;-p-_baz:qux;_baz:qux}"
        )
    });



      ///////////////////////////////
     /**/  suite("At rules, ")  /**/
    ///////////////////////////////


    before(function(){
        // restore a few vendors to ensure that
        // they are not prepended where they shold not.
        j2c.vendors = ["o", "p"];
    });

    after(function(){
       j2c.vendors = [];
    });

    test("standard At rule with text value", function() {
        check(
            add("p", {
                "@import":"'bar'"
            }),

            "@import 'bar';"
        )
    });

    test("standard At rule with object value", function() {
        check(
            add("p", {
                "@media foo":{bar:"baz"}
            }),

            "@media foo {p{-o-bar:baz;-p-bar:baz;bar:baz}}"
        )
    });

    test("several At rules with object value", function() {
        check(
            add("p", {
                "@media foo":{bar:"baz"},
                "@media foo2":{bar2:"baz2"}
            }),
            [
                "@media foo {p{-o-bar:baz;-p-bar:baz;bar:baz}} @media foo2 {p{-o-bar2:baz2;-p-bar2:baz2;bar2:baz2}}",
                "@media foo2 {p{-o-bar2:baz2;-p-bar2:baz2;bar2:baz2}} @media foo {p{-o-bar:baz;-p-bar:baz;bar:baz}}"
            ]
        )
    });

    test("Array of At rules with text values", function() {
        check(
            add("p", [
                {"@import":"'bar'"},
                {"@import":"'baz'"}
            ]),
            "@import 'bar'; @import 'baz';"
        )
    });

    test("@font-face", function(){
        var sheet = j2c.scoped("p")
        check(
            sheet.font({foo:"bar"}).toString(),
            "@font-face{foo:bar}"
        )
    });

    test("@keyframes", function(){
        var sheet = j2c.scoped("p")
        check(
            sheet.keyframes("qux", {
                " from":{foo:"bar"},
                " to":{foo:"baz"}
            }).toString(),
            [
                "@-webkit-keyframes qux{from{-webkit-foo:bar;foo:bar}to{-webkit-foo:baz;foo:baz}}" +
                "@keyframes qux{from{-o-foo:bar;-p-foo:bar;foo:bar}to{-o-foo:baz;-p-foo:baz;foo:baz}}",

                "@-webkit-keyframes qux{to{-webkit-foo:baz;foo:baz}from{-webkit-foo:bar;foo:bar}}" +
                "@keyframes qux{to{-o-foo:baz;-p-foo:baz;foo:baz}from{-o-foo:bar;-p-foo:bar;foo:bar}}",
            ]
        )
    });

})




