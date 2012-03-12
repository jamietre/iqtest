
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
         // when true, will not trap errors in the test itself.
        debug: false
        // events
        
    },
    testDefaults = {
        name: "",
        desc: "Unnamed Test",
        func: null,
        timeoutSeconds: 10
       

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
        event: function(func,that,parm) {
            if (u.isFunction(func)) {
                func.call(that,parm);
            }
        },
        donothing: function() {}
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
        this.passed=null;
    };
    TestGroup.prototype = {
        constructor: TestGroup,
        // "test" should be a function with one parameter, this parameter is passed as an object
        // representing the current test object.
        test: function (name, desc, func) {
            var test,
                allPass=true,
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
            test.id = me.tests.length;
            //run test right away
            u.event(test.testStart,test,test);

            if (me.debug) {
                test.func.call(test,test);
            } else {
                try {
                     test.func.call(test,test);
                }
                catch(err)
                {
                    //test.resolver.reject(err.toString());
                    u.event(me.log,me,u.format("An error occurred in your test code: {0}. Debugging is enabled if you start again.",err.toString()));
                    me.debug=true;
                    me.passed=false;
                    test.passed=false;
                }

            }

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
                if (typeof test.passed !== 'boolean') {
                    test.passed = (test.count===test.countPassed);
                }
                allPass &= test.passed;
                
                u.event(test.testEnd,test,test);

                if (test===me.tests[me.tests.length-1]){
                    if (typeof me.passed !== 'boolean') {
                        me.passed=allPass;
                    }
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
        configure: function(options) {
            var allowed = u.extend({},groupDefaults);
            u.extend(allowed,options,true);
            u.extend(this,allowed);
            return this;
        },
        // events
        groupStart: u.donothing,
        groupEnd: u.donothing
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
            group:null,
            nextThen: [],
            resolver: null
        });
        this.id=null;
        // the first promise should begin resolved (it kicks things off)
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
                    err: args.err,
                    desc: args.desc
                };
            },
            // cannot fail - a failure would result in "fail" being called
            resolves: function(args) {
                return {
                    err: '',
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
        // set timeout only for the next test
        timeout: function(seconds) {
            var me=this,
                originalTimeout = me.timeoutSeconds;
            me.then(function() {
                me.timeoutSeconds = seconds;
            });
            me.afterNext(function() {
                me.timeoutSeconds = originalTimeout;
            });
        },
        // set options for this test 
        configure: function(options) {
            var allowedOpts =u.extend({},testDefaults);
            // update with current options, then with options passed
            u.extend(allowedOpts,this,options,true);
            u.extend(this,allowedOpts);
        },

        // these methods should not be used by the public
        // TODO move them

        // queue a callback to attach to the next thing queued.
        then: function(callback,errback) {
            var me=this,
                errFunc=function(err) {
                    // failures of everything end up here - if we've already broken for a particular reason then 
                    // stop logging all the inevitable timeouts.
                    me.testerror(err,false);
                };

            function doThen(callback,errback) {
                me.promise = me.promise.then(callback, errback || errFunc);
            }

            doThen(callback,errback);
            
            if (me.afterNext.length>0) {
                u.each(function(i,obj) {
                    doThen(obj.callback,obj.errback);
                });
                me.afterNext=[];
            }
            return me;
        },
        // call when a critical error should prevent further test execution,
        afterNext: function(callback,errback) {
            this.nextThen.push({callback:callback, errback:errback});
        },
        startTest: function (info) {
            var eventParm = u.extend({},info.assertArgs);
            this.count++;
            u.extend(eventParm,{count:this.count});
            u.event(this.itemStart,this,eventParm);
            this.itemRunning=true;
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
            this.itemRunning=false;
            u.event(this.itemEnd,this,output);
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
            var me=this,testFunc, defer,
                successFunc,
                actualIsPromise=false,
                pending=[],
                assertArgs = sigs[assertFuncName].apply(me,args);

            // some tests don't have an "actual" part (e.g. pass,fail).  
            //TODO allow defer for either argument

            successFunc=function(response)
            {
                assertArgs.actual=response;
            };
            testFunc= function() {                
                if (me.runTest.call(me,assertFuncName,assertArgs)) {
                    defer.resolve();
                } else {
                    defer.reject("The test failed.");
                }
            };

            // wait for any callbacks
            actualIsPromise=when.isPromise(assertArgs.actual);

            // check for the "magic" callback. If me.cbPromise exists, then it was hopefully created by the parameters
            // for this method. This is slightly brittle because there's no direct binding of the particular promise to 
            // this particular method, but the single-threaded nature of javascript should cause this to work fine. 
            // I can't see any substantive risk here and it is extraordinarily convenient.


            if (me.cbPromise) {
                if (actualIsPromise) {
                    defer.reject("The actual value passed is a promise, but a callback has also been initiated");
                }
                me.cbPromise.then(successFunc,function(err) {
                    defer.reject("The callback failed. " + err ? u.format('Reason: {0}',err.toString()) : '');
                });
                pending.push(me.cbPromise);
                me.cbPromise=null;
            }

            // show start indicator
            me.promise.then(function() {
                me.startTest({assertArgs: assertArgs, assertFuncName: assertFuncName});
            });

            // wait for any promises
            if (actualIsPromise) {
                assertArgs.actual.then(successFunc);
                pending.push(assertArgs.actual);
            }

            if (pending.length) {
                pending.push(me.promise);
                me.promise = when.all(pending);
            }
            //

            // link  each test to a new resolver so failures will break the chain at that point
            
            defer = when.defer();

            me.then(testFunc, function(err) {
                defer.reject(err);
            });

            me.promise = when_timeout(defer.promise, me.timeoutSeconds*1000);
            me.resolver=defer.resolver;

            return me;
        },
        // when the debugging parm is true, will enable debugging for the group
        testerror: function(err, debugging) {
            var me=this;
            if (me.resolver) {
                me.resolver.reject(err);
                me.resolver=null;
            }
            if (this.stopped) {
                return;
            }
            this.stopped=true;
            
            u.event(me.group.log,me.group,
                u.format("{0}. {1}",err.toString(),
                    debugging ? "Debugging is enabled if you start again." : "" ));

            me.group.debug=true;
            me.passed=false;

        },
        // create a callback that the next assert will wait for, optionally expiring.
        callback: function(target,timeout) {
            var me=this,
                defer = when.defer();

            // if no timeout is specified, the actual function is arleady wrapped by a timeout so not needed
            me.cbPromise = timeout ? 
                 when_timeout(defer, timeout * 1000) :
                 defer;
            
            return function() {
                var value;
                if (!target) {
                    value=true;
                } else {
                    if (me.group.debug) {
                        value=target.apply(me,u.toArray(arguments));
                    } else {
                        try
                        {
                            value=target.apply(me,u.toArray(arguments));
                        }
                        catch(err)
                        {
                            me.testerror("An error occurred in your callback(): "+err,true);
                            defer.reject(value);
                            return;
                        }
                    }
                }
                defer.resolve(value);
            };
        },
        // return a promise from a function that has a callback parameter
        backpromise: function(func,callback,timeout) {
            var defer=when.defer(),
                me=this,
                cb=function() {
                    var value;
                    if (me.group.debug) {
                        value=callback.apply(this,u.toArray(arguments));
                    } else {
                        try
                        {
                            value=callback.apply(this,u.toArray(arguments));
                        }
                        catch(err)
                        {
                            me.testerror("An error occurred in your backpromise() callback: "+err,true);
                            defer.reject(value);
                            return;
                        }
                    }

                    defer.resolve(value);
                };
            
            if (me.group.debug) {
                func.call(me,cb);
            } else {
                try
                {
                    func.call(me,cb);
                }
                catch(err)
                {
                    me.testerror("An error occurred in your backpromise() function: "+err,true);
                    defer.reject();
                    return;
                }
            }

            
            return timeout ? when_timeout(defer, timeout*1000) : defer;
        },
        testStart: u.donothing,
        testEnd: u.donothing,
        itemStart: u.donothing,  
        itemEnd: u.donothing,
        log: u.donothing
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