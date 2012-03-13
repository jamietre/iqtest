 /*
Assertions for IQ Test (other than buster)
This doesn't actually require iqtest, so it can be included before or after.
 */

 /*global define, require, module */

 (function(define) {
define(function() {
    function toArray(arrLike,first,last) {
        return Array.prototype.slice.call(arrLike,first || 0, last);
    }
    function isArray(obj) {
        return obj && obj.constructor === Array;
    }
    function format(text) {
        var args = (arguments.length === 2 && isArray(arguments[1])) ?
            arguments[1] :
            toArray(arguments,1);
        return text.replace(/\{(\d+)\}/g, function (match, number) {
            return typeof args[number] !== 'undefined'
          ? String(args[number])
          : match
        ;
        });
    }
    // Format standard error output

    function output(text,obj,message) {
        return (message? message+': ':'')+format(text,obj.toString()).replace('{not}','{0}');
    }
    /* Custom asserions: each should return an object with the format shown below. The err message must appear for both
        positive and negative assertions, with a parameter for adding the word "not." Use the output function to do this
        as in the example */

    return {
        truthy: function(obj,message) {
            return {
                passed: !!obj,
                err: output('The object {0} is {not}truthy',obj,message)
            };
        },
        isNotCool: function(obj) {
            return {
                passed: false,
                err: output('The object {0} is {not}cool!',obj)
            };
        }
    };


});
}(typeof define === 'function'
    ? define
    : function (factory) { 
        if (typeof module !== 'undefined') {
            module.exports = factory();
        } else {
            if (!this.iqtest_assertions) {
                this.iqtest_assertions=[factory()];
            } else {
                this.iqtest_assertions.push(factory());
            }
        }
    }
    // Boilerplate for AMD, Node, and browser global
));


