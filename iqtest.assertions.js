 /*
Assertions for IQ Test (other than buster)
This doesn't actually require iqtest, so it can be included before or after.
 */

/*jslint eqeqeq:false */
/*global define, require, module */

 (function(define) {
define(function(iqtest) {
    var u=iqtest.impl.utility,
        output = u.formatAssert;

    // Format standard error output


    /* Custom asserions: each should return an object with the format shown below. The err message must appear for both
        positive and negative assertions, with a parameter for adding the word "not." Use the output function to do this
        as in the example */

    return {
        isEqualEnough: function(actual,expected,message) {
            u.expectOpts(1);
            return {
                passed: actual==expected,
                err: output('The object {0} is {not}sorta equal {1}!',actual,expected)
            };
        }
    };


});
}(typeof define === 'function'
    ? define
    : function (factory) { 
        if (typeof module !== 'undefined') {
            module.exports = factory(require('./iqtest'));
        } else {
            this.iqtest_assertions.push(factory(this.iqtest));
        }
    }
    // Boilerplate for AMD, Node, and browser global
));


