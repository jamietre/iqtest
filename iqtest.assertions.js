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
        // Two things should have the same contents. If this is an object, the values of each property must be identical.
        // if an array, they must have the same elements, but order is irrelevant.
        // If a string, it is split on commas and treated as a CSV. 
        contentsEqual: function(expected,actual,message) {
            var reason, index,
                isArr = u.isArray(actual),
                actualArr=actual, 
                expectedArr=expected;

            // map each "own" property value to an array, which we can then compare directly.
            function objToArray(obj)
            {
                var arr=[];
                u.each(obj,function(i,el) {
                    arr.push(el);
                });
                return arr;
            }
            // return first index at which arrays differ
            function arraysEqual(obj1,obj2) {
                for (var i=0;i<obj1.length;i++) {
                    if (obj1[i]!==obj2[i]) {
                        return i;
                    }
                }
                return -1;
            }
            // return the name of the nth property
            function getOrdinalName(obj,n) {
                 var i=0;
                 u.each(obj,function(prop,el) {
                    if (i===n) {
                        return prop;
                    }
                });
            }

            u.expectOpts(2);

            if (typeof actual !== typeof expected) {
                reason = u.format('the objects are {not}different types (expected is {0}, actual is {1})',typeof expected, typeof actual);
            } else if (u.isString(actual)) {
                actualArr = u.split(actual,',');
                expectedArr = u.split(expected,',');
            } else if (typeof actual === 'object') {
                if (isArr) {
                    actualArr.sort();
                    expectedArr.sort();
                } else {
                    actualArr=objToArray(actual);
                    expectedArr = objToArray(expected);
                }
                if (actualArr.length !== expectedArr.length) {
                    reason=u.format('the objects are {not}different lengths, expected {0} and was {1}',expectedArr.length, actualArr.length);
                } else 
                {
                    
                    index=arraysEqual(actualArr,expectedArr);
                    if (index>=0) {
                        if (!isArr) {
                            index = '"'+getOrdinalName(actual,index)+'"';
                        }
                        reason=u.format('sorted objects are {not}different at element {0}, expected "{1}" vs. actual "{2}"',index,expectedArr[index],actualArr[index]);
                    }
                }
            } else {
                reason=u.format('are of type "{3}"" which is {not}not a container',typeof actual);
            }
            
            return {
                passed: !reason,
                err: output(message,reason)
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


