
/*
IqTest: A javascript testing framework that promises to be easy

(c) 2012 James Treworgy
MIT License
*/

/*jslint novar:true, onevar: false, eqeqeq: false*/
/*global when, when_timeout */

var iqtest = (function (api) {
    var u,sigs,pubApi,Test, TestGroup, Assert,
    groupDefaults = {
        name: "Unnamed Test Group",   
        groupStart: null,
        groupEnd: null,
        testStart: null,
        testEnd: null,
        itemStart: null,  
        itemEnd: null

    },
    testDefaults = {
        name: "",
        desc: "Unnamed Test",
        func: null

    };

    u = {
        // when onlyInSource is true, properties will not be added - only updated
        extend: function (target) {
            var prop, source, sources, i,
                li = arguments.length,
                lastBool = typeof arguments[li-1]==='boolean',
                len = lastBool ?
                    li-2 : li-1,
                onlyInSource =  lastBool ?
                    arguments[len+1] : false;

                sources=u.toArray(arguments,1,len+1);

            for (i=0;i<sources.length;i++) {
                source = sources[i];
                for (prop in source) {
                    if (source.hasOwnProperty(prop) 
                        && (!onlyInSource || target.hasOwnProperty(prop))) {
                        target[prop] = source[prop];
                    }
                }
            }
            return target;
        },
        toArray: function(arrLike,first,last) {
            return Array.prototype.slice.call(arrLike,first || 0, last);
        },
        isArray: function (obj) {
            return obj && obj.constructor == Array;
        },
        isFunction: function (obj) {
            return typeof obj === 'function';
        },
        format: function (text) {
            var args = (arguments.length === 2 && this.isArray(arguments[1])) ?
                arguments[1] :
                this.toArray(arguments,1);
            return text.replace(/\{(\d+)\}/g, function (match, number) {
                return typeof args[number] !== 'undefined'
              ? String(args[number])
              : match
            ;
            });
        },
        each: function (coll, cb) {
            var i;
            if (this.isArray(coll)) {
                for (i = 0; i < coll.length; i++) {
                    if (cb.call(coll[i], i, coll[i])===false) {
                        break;
                    }
                }
            } else {
                for (i in coll) {
                    if (coll.hasOwnProperty(i)) {
                        if (cb.call(coll[i], i, coll[i])===false) {
                            break;
                        }
                    }
                }
            }
        },
        isDTest: function (obj) {
            return obj && typeof obj.startDTest === 'function';
        },
        newChain: function(func){
            window.setTimeout(func,50);
        },
        event: function(func,that,parm) {
            if (u.isFunction(func)) {
                func.call(that,parm);
            }
        }
    };

    // Map of the "actual" parameter position for functions where it isn't 1. This is special case
    // handling, so we can map more easily to the queueing function
    
    sigs= {
        pass: function (desc) {
            return { desc: desc };
        },
        fail: function (err ,desc ) {
            return {
                actual: err || "[the test was aborted]",
                desc: desc
            };
        },
        // just assert that a callbacl resolves
        resolves: function(promise,desc) {
            return {
                actual: promise,
                desc: desc
            };
        },
        isTrue: function (actual, desc) {
            return { 
                actual: actual,
                desc: desc
            };
        },
        areEqual: function (expected, actual, desc) {
            return { 
                expected: expected,
                actual: actual, 
                desc: desc 
            };
        }
        
    };
    u.extend(sigs,{
        isFalse: sigs.isTrue,
        isTruthy: sigs.isTrue,
        isFalsy: sigs.isTrue,
        areNotEqual: this.areEqual
    });
        

    TestGroup = function (options) {
        this.tests = [];
        u.extend(this,groupDefaults);
        u.extend(this,options,true);
        this.promise=when.defer();
        this.passed=true;
    };
    TestGroup.prototype = {
        constructor: TestGroup,
        // "test" should be a function with one parameter, this parameter is passed as an object
        // representing the current test object.
        test: function (name, desc, func) {
            var test,
                lastPromise,
                finishFunc,
                me=this,
                hasDesc = !!func,
                testData = {
                    name: name,
                    desc: hasDesc ? desc : '',
                    func: hasDesc ? func : desc
                };

            test = new Test(testData);
            test.group=me;
            if (me.tests.length===0){
                u.event(me.groupStart,me,me);
            }
            me.tests.push(test);
            //run test right away
            u.event(me.testStart,me,test);

            test.func.apply(test,test);

            // wait for everything to finish by binding to the last promise, and deferring each time
            // it changes as a result of a callback or something.

            lastPromise=test.promise;
            finishFunc=function()
            {
                if (test.promise!==lastPromise) {
                    lastPromise=test.promise;
                    lastPromise.then(finishFunc,finishFunc);
                    return;
                }
                test.passed = (test.count===test.countPassed);
                if (!test.passed) {
                    me.passed=false;
                }
                u.event(me.testEnd,me,test);

                if (test===me.tests[me.tests.length-1]){
                    u.event(me.groupEnd,me,me);
                }
            };
            test.promise.then(finishFunc,finishFunc);
            return me;
        },
        then: function(name,func) {
            //TODO broken
            if (u.isFunction(name)) {
                // treat as a regular promise "then"
                this.promise =this.promise.then.apply(this.promise,u.toArray(arguments));
                return this;
            } else {
                // treat as a new test
                // starting a new group with "this" treats it as options and will copy the config
                var group = new TestGroup(this);

                this.promise = this.promise.then(function() {
                    group.test(name,func);
                    return group;
                },
                function() {
                    alert('debug: failback called on a group');
                });
                return group;
            }
        }, 
        end: function() {
            this.promise.then(function() {
                u.event(this.groupEnd,this,this);
            },function(err) {
                //TODO: handle
                alert('debug: group "end" resolved with fail');
            });
        }
    };

    // A test object. After running tests, the "results" contains an array of strings describing
    // failures.
    Test = function (options) {
        var me=this;
        u.extend(me, testDefaults);
        u.extend(me, options, true);
        u.extend(me, {
            //domino: when.defer(),
            promise: when.defer(),
            results: [],
            count: 0,
            countPassed: 0,
            countFailed: 0,
            group:null
        });
        me.promise.resolve();
    };

    // some private functions

    // shared by the four t/f/truthy/falsy
    function _isTrue(args,value,valueDesc)
    {
        return { err: value === true ?
            '' : u.format('value "{0}" is not {1}', args.actual,valueDesc),
            desc: args.desc
        };

    }
    Test.prototype = {
        constructor: Test,
        // the methods
        impl: {
            pass: function (args) {
                return { desc: args.desc };
            },
            fail: function (args) {
                return {
                    err: args.actual,
                    desc: args.desc
                };
            },
            
            isTrue: function (args) {
                return _isTrue(args,args.actual===true,"true");
            },
            isFalse: function (args) {
                return _isTrue(args,args.actual===false,"false");
            },
            isTruthy: function (args) {
                return _isTrue(args,!!args.actual,"truthy");
            },
            isFalsy: function (args) {
                return _isTrue(args,!!args.actual,"falsy");
            },
            areEqual: function (args) {
                var err;

                if (typeof args.actual != typeof args.expected) {
                    err = u.format('test case type "{0}" !== expected type "{1}"', typeof args.actual, typeof args.expected);
                }

                if (!err && args.actual != args.expected) {
                    err = u.format('value "{0}" !== expected value "{1}"', args.actual, args.expected);
                }

                return { err: err, desc: args.desc };
            },
            areNotEqual: function (args) {
                var result = this.areEqual(args.expected, args.actual, args.desc);
                if (!result.err) {
                    result.err = u.format('Value "{0}" === expected value "{1}"', args.actual, args.expected);
                }
                return result;

            }
        },
        // either replace the current promise with a new one that is linked to the previous one,
        // or create a new promise for a function
        chain: function(func) {

            if (when.isPromise(func)) {
                this.promise = when.all([this.promise,func]);
            } else {
                this.promise = this.promise.then(func, 
                    function(err) {
                    alert(u.format("debug: chained promise failed '{0}'", err));
                });
            }
            
            return this.promise;
        },
        then: function() {
            // TODO wrap to handle test errors
            return this.promise.then.apply(this.promise,u.toArray(arguments));
        },
        startTest: function (info) {
            var eventParm = u.extend({},info.assertArgs);
            this.count++;
            u.extend(eventParm,{count:this.count});
            u.event(this.group.itemStart,this.group,eventParm);
        },
        endTest: function (result) {
            // TODO: Option allowing logging of passed tests
            var passed=!result.err,
                output=u.extend(result, {passed: passed});

            if (!passed) {
                output=this.addResult(result);
                this.countFailed++;
            } else {
                this.countPassed++;
            }
            u.event(this.group.itemEnd,this.group,output);
        },

        // run a named test using the arguments in array args
        runTest: function (assertFuncName, args) {
            // should return an object [err: error message, desc: description of test passed in]
            var testResult;
            //args is an object mapped to the relevant parms for any assert
            testResult = this.impl[assertFuncName].call(this, args);
            testResult.assertFuncName = assertFuncName;
            this.endTest(testResult);
            return testResult.passed;
        },
        addResult: function (result) {

            var output = u.extend({}, result),
                    msg = output.passed ?
                     "passed" :
                     "failed";

            // "Test #[1] [assertEq] [passed|failed] [with result "message"] [in test "test"]

            output.count = this.count;

            output.fulltext = u.format('Test #{0} [{1}] {2}{3}{4}',
                    this.count,
                    result.assertFuncName,
                    msg,
                    output.passed ? 
                        '' : 
                        ': ' + result.err,
                    result.desc ? 
                        u.format(' in test "{0}"', result.desc) 
                        : ''
                    );

            this.results.push(output);
            return output;

        },
        runTestNow: function(assertFuncName,args)
        {
            // wrap literal values in the DTest object anyway - they will just be resolved
            var me=this,testFunc, 
                failFunc, successFunc,
                actualIsPromise=false,
                pending=[],
                assertArgs = sigs[assertFuncName].apply(me,args);

            // some tests don't have an "actual" part (e.g. pass,fail).  
            //TODO allow defer for either argument

            failFunc = function(reason) {
                me.impl.fail({desc: assertArgs.desc, err: reason});
            };
            successFunc=function(response)
            {
                assertArgs.actual=response;
            };
            testFunc= function() {
                me.startTest({assertArgs: assertArgs, assertFuncName: assertFuncName});
                
                return me.runTest.call(me,
                    assertFuncName,
                    assertArgs);
                };

            // wait for any callbacks
            actualIsPromise=when.isPromise(assertArgs.actual);

            // check for the "magic" callback. If me.cbPromise exists, then it was hopefully created by the parameters
            // for this method. This is slightly brittle because there's no direct binding of the particular promise to 
            // this particular method, but the single-threaded nature of javascript should cause this to work fine. 
            // I can't see any substantive risk here and it is extraordinarily convenient.

            if (me.cbPromise) {
                if (actualIsPromise) {
                    return failFunc("The actual value passed is a promise, but a callback has also been initiated");
                }
                me.cbPromise.then(successFunc,failFunc);
                pending.push(me.cbPromise);
                me.cbPromise=null;
            }

            // wait for any promises
            if (actualIsPromise) {
                assertArgs.actual.then(successFunc,failFunc);
                pending.push(assertArgs.actual);
            }

            if (pending.length) {
                pending.push(me.promise);
                me.chain(when.all(pending));
            }
            me.chain(testFunc);

            return me;

        },
        // create a callback that the next assert will wait for, optionally expiring.
        callback: function(target,timeout) {
            var me=this,
                defer = when.defer();
            me.cbPromise =  when_timeout(defer, timeout ? timeout * 1000 : 10000);
            
            return function() {
                var value = !target ? 
                    true:
                    target.apply(me,u.toArray(arguments));
                defer.resolve(value);
            };
        },
        // return a promise from a function that has a callback parameter
        backpromise: function(func,callback,timeout) {
            var inner=when.defer(),
                me=this,
                p = when_timeout(inner, timeout ? timeout * 1000 : 10000),
                cb=function() {
                    p.resolve(callback.apply(this,u.toArray(arguments)));
                };

            func.call(me,cb);
            return p;
        }      
    };

    // Map each method of "impl" to a public method that wraps it and calls runTest

    u.each(Test.prototype.impl, function (i, e) {
        Test.prototype[i] = function (args) {
            return this.runTestNow(i,u.toArray(arguments));
        };
    });

    pubApi={
        test: function () {
            // TODO: chaining - this will be called from 
            var group = new TestGroup(this);
            return group.test.apply(group,u.toArray(arguments));
        }
    };
    u.extend(api,pubApi);
    pubApi.impl= {
        apiroot: api,
        TestGroup: TestGroup,
        Test: Test,
        Assert: Assert,
        utility: u
    };
    return pubApi;
} (window));