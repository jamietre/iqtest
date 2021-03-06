
/*
IqTest: A javascript testing framework that promises to be easy

(c) 2012 James Treworgy
MIT License
*/

/*jslint novar:true, onevar: false, debug: true */
/*global alert, define, require, module, buster, u */


(function(define) {

define(['./iqtest'], function(u,when,when_timeout, iq_asserts, buster_asserts, utils) {
    var options,iqtestApi,Test, TestGroup, Assert,
    globalDefaults = {
        setup: null,
        teardown: null,
        timeout: 10
    },
    // default values for TestGroup
    groupDefaults = {

        // an id or name
        name: "test-group", 

        // detailed desription of the test
        desc: "Unnamed Test Group",
        
         // when true, will not trap errors in the test itself.
        debug: false,
        // timeout for function execution (null inherits)
        timeout: null,
        // functions to run on setup or teardown
        setup: null,
        teardown: null
        
    },
    // default values for Test and also defines allowed options
    testDefaults = {
        name: "test",
        desc: "Unnamed Test",
        func: null,
        timeout: null,
        // there is a test-specific debug option so that currently running tests will remain
        // in non-debug mode after another one fails
        debug: false
    },
    // list of methods to import from buster
    busterMethods="same,equals,typeOf,defined,isNull,match,isObject,isFunction,exception,tagName,className,isTrue,isFalse",
    initialized=false,
    // metadata collected about the assertions
    assertionData={};
    
    // get the last argument if it's a string
    function assertMessage(assertion,args) {
        var argCount= assertionData[assertion.split('.')[1]].args;
        return argCount < args.length ?
            String(args[argCount]) :
            'an anonymous test';
    }
    // Map all asserts

    function captureMethodArgs(method,func)
    {
        // get metadata by examining error message
        var matches=0,
        reg=/^.*?Expected.*?([0-9]) argument[s]?\s*$/;
        
        try {
            func();
        }
        catch(err)
        {
            matches=reg.test(err.message) ? parseInt(RegExp.$1,10) : 0;
        }
        assertionData[method]={ 
            args: matches 
        };
    }

    function initialize()
    {
        var ba,tp;
        if (initialized) {
            return;
        }
        // Create a single default assertion so this works with no includes.
        // Other non-buster methods can be found in iqtest.assertions.js

        iq_asserts.push({
            truthy: function(obj,message) {
                u.expectOpts(arguments,1);
                return {
                    passed: !!obj,
                    err: u.formatAssert(message,'The object {0} is {not}truthy',String(obj))
                };
            },
            // has special handling - the actual asserion doesn't know if it was given a promise, only the output.
            // the queue funciton must verify
            resolves: function(obj,message) {
                u.expectOpts(arguments,1);
                return {
                    passed: typeof obj !== 'undefined',
                    err: u.formatAssert(message,'The object {0} did {not}resolve',String(obj))
                };
            }
        });

        // Map buster.assertions.assert & refute to Test protype "assert" & "refute".
        // Also map the assertions directly to test

        tp=Test.prototype;
        ba=buster.assertions;

        u.each(["assert","refute"],function(i,type) {
            
            // create proto.assert

            var asserts = {};

            // map methods from buster

            u.each(busterMethods.split(','),function(j,method) {
                captureMethodArgs(method,ba[type][method]);
                asserts[method] = function () {
                    var that=((this.test && this.test instanceof Test) ? this.test : this);
                    return that.queueTest(ba[type][method],type+"."+method,u.toArray(arguments));
                };
            });
            
            // map builtin methods from the array. Ignore ones that have already been defined.

            u.each(iq_asserts,function(i,iqa) {
                u.each(iqa, function(method,func) {
                    if (!asserts[method]) {
                        captureMethodArgs(method,func);
                        asserts[method]=function() {
                             var that=((this.test && this.test instanceof Test) ? this.test : this);
                            return that.queueBooleanTest(func,
                                type+"."+method,
                                u.toArray(arguments),
                                type==='refute');
                        };
                    }
                });
            });

            // copy asserts to main Test object (do it before we update with the utilities, those are FROM the main object)

            if (type==='assert') {
                u.extend(tp,asserts);
            }
            // map utilities

            u.each(["backpromise","callback","then"],function(i,method) {
                asserts[method]=function() {
                    return this.test[method].apply(this.test,u.toArray(arguments));
                };
            });

            // finally update the prototype, and create this.assert() and this.refute() functions
            
            tp[type]=function(obj,message) {
               return tp[type].truthy.apply(this,u.toArray(arguments));
            };

            u.extend(tp[type],asserts);

            initialized=true;
        });
    }

    // u needs to be imported from common.utils

    u.extend(u, {
        event: function(func,that,parm) {
            if (u.isFunction(func)) {
                func.call(that,parm);
            }
        },
        // throw an error if the 'args' array has fewer than 'expected' elements.
        expectOpts: function(args,expected) {
            if ((args ? args.length : 0) < expected) {
                throw({
                        name: "AssertionError",
                        type: "iq",
                        message: u.format("Expected to receive at least {0} argument",expected.toString())
                    });
            }
        },
        // standardize the format of the output from assertions
        formatAssert: function(message,reason,parms) {
            return !reason ? '' :
             (message ? message+': ':'') +
                u.format(reason,u.isArray(parms) ? parms : u.toArray(arguments,2));
        }

    });

    /* Begin Main Code */
    
    /* Shared functions */

    function doEvent(obj,method /* [,parms] */ ) {
        if (obj[method]) {
            obj[method].apply(this,u.toArray(arguments,2));
        }
    }
    
    // return a delegate to a function with the specified context
    // if any additional arguments are passed when the func is actually called, they come first

    function bind(context,func /*[,args]*/) {
        var args=u.toArray(arguments,2);
        return function() {
            // "arguments" here is what the delegate was ultimately invoked with.
            var finalArgs = u.toArray(arguments).concat(args);
            if (finalArgs.length>0) {
                func.apply(context,finalArgs);
            } else {
                func.call(context);
            }
        };
    }
    // create a new prototype from arbitrary arguments

    function construct(constructor, args) {
        function F() {
            return constructor.apply(this, args);
        }
        F.prototype = constructor.prototype;
        return new F();
    }
    /* Functions for the TestGroup prototype */

    function groupAddTest(test) {
        var hasDesc, func, description, 
            testData,
            me=this;

        function addTest(test) {
            me.tests.push(test);
            test.group=me;
            test.id = me.tests.length;
        }
        if (test.constructor === TestGroup) {
            u.each(test.tests,function(i,e) {
               addTest(e);
            });
        } else if (test.constructor === Test) {
            addTest(test);
        } else if (typeof test === 'string') {
            description = arguments[1];
            func = arguments[2];
            hasDesc = !!func;
            testData = {
                name: test,
                desc: hasDesc ? description : '',
                func: hasDesc ? func : description,
                debug: me.debug,
                timeout: me.timeout
            };
            addTest(new Test(testData));
        }
        return me;
    }

    // function must be called with a context of 
    function testFinished(group,test) {
        var groupResult;

        if (test.promise!==test._lastPromise) {
            test._lastPromise=test.promise;
            test._lastPromise.then(function() {
                testFinished(group,test);
            },function(err) {
                test.testerror(err,true);
                testFinished(group,test);
            });
            return;
        }
        if (!u.isBool(test.passed)) {
            test.passed = (test.count===test.countPassed);
        }
        test._allPass &= test.passed;
        
        test.doWriterEvent("testEnd",u.filterProps(test,"count,passed"));

        doEvent.call(test,test,"teardown");

        // see if all tests have been resolved

        groupResult=true;
        u.each(group.tests,function(i,e) {
            if (!u.isBool(e.passed)) {
                groupResult=null;
                return false;
            } else {
                if (!e.passed) {
                    groupResult=false;
                }
            }
        });

        if (u.isBool(groupResult)) {
            group.passed = groupResult;
            group.doWriterEvent("groupEnd");
            doEvent.call(this,this,"teardown");
            group.promise.resolve();
        }
    }


    function groupRun() {
        var me=this;

        doEvent.call(this,this,"setup");

        this.reset();
        u.each(me.tests,function(i,test) {
            test.reset();
        });

        this.doWriterEvent("groupStart",u.filterProps(me,"name,desc"));
                
        u.each(me.tests,function(i,test) {
            var assert=u.extend({},test.assert,{test: test}),
                refute = u.extend({},test.refute,{test: test});

            doEvent.call(test,test,"setup");
            test.doWriterEvent("testStart",u.filterProps(test,"name"));

            if (test.debug) {
                test.func.call(test,assert,refute);
            } else {
                try {
                     test.func.call(test,assert,refute);
                }
                catch(err)
                {
                    test.testerror(u.format("An error occurred in your test code: {0}",err),true);
                }
            }

            // wait for everything to finish by binding to the last promise, and deferring each time
            // it changes as a result of a callback or something.
            // this is really quite nasty, I have not figured out a better way to do it yet

            test._lastPromise=test.promise;
            test._allPass=true;

            // bind to the last promise in the chain. The finishing function will detect if 
            // anything else has been added.

            test.promise.then(function() {
                testFinished(me,test);
            },function(err) {
                test.testerror(err,true);
                testFinished(me,test);
            });
        });
        return this;
    }
    // call function "event" that is a member of each element in activeWriters, with args
    // should be called with the sender event context
    function doWriterEvent(event,args) {
        var me = this;
        u.each(this.group.writers,function(i,e) {
            var target = e[event];
            if (u.isFunction(target)) {
                target.apply(e,[me].concat(args));
            }
        });

    }

    TestGroup = function (name, desc, options) {
        initialize();

        var opts = name && typeof name === 'object' ? name:
            desc && typeof desc === 'object' ? desc : 
            options || {};

        if (typeof desc === 'string') {
            opts.name=name;
        }
        if (typeof desc === 'string') {
            opts.desc=desc;
        }
        u.extend(this,
            u.extend(null,groupDefaults,opts,true)
        );

        // active ouput writers
        this.writers=[];

        // private methods

        this.doEvent = doEvent;
        
        // uniform interface for both tests & groups for accessing the group & event emitter
        this.group = this;
        this.doWriterEvent = function() {
            doWriterEvent.apply(this,u.toArray(arguments));
        };

        this.clear();
    };

    TestGroup.prototype = {
        constructor: TestGroup,
        // Add a new test to this group. This can be a Test object, or a 
        // add: function(name [,description],func)
        add: groupAddTest,
        // run the tests that have been added to this test group
        // return the group object, which is also a promise that resolves when 
        // the group is finished running.
        run: groupRun,
        // a promise that resolves when a "run" operation finishes 
        then: function() {
            return this.promise.then.apply(this,u.toArray(arguments));
        },
        configure: function(options) {
            if (typeof options === 'string') {
                options = {name: options};
            }
            var allowed = u.extend({},groupDefaults);
            u.extend(allowed,options,true);
            u.extend(this,allowed);
            return this;
        },
        reset: function() {
            this.promise=when.defer();
            this.passed=null;
            return this;
        },
        clear: function() {
            this.tests = [];
            this.reset();
            return this;
        },
        // activate a named writer
        writer: function(id /*,writer-args*/) {
            var w,
                proto = iqtestApi.writers[id];
            if (!proto) {
                throw("There is no output writer with id '{0}'".format(w));
            }

            w=construct(proto,u.toArray(arguments,1));
            w.owner=this;
            this.writers.push(w);
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
        me.id=null;
        me.group=null;
        me.clear();

        this.doWriterEvent = function() {
            doWriterEvent.apply(this,u.toArray(arguments));
        };
    };

    Test.prototype =  {
        constructor: Test,
        // set timeout only for the next test
        impl: {},      
        reset: function() {
            u.extend(this, {
                //domino: when.defer(),
                promise: when.defer(),
                results: [],
                count: 0,
                countPassed: 0,
                countFailed: 0,                
                nextThen: [],
                cbPromise: null,
                resolver: null,
                stopped: false,
                passed: null

            });

            // resolve immediately to start the chain when the first thing is added
            this.promise.resolve();
        },
        clear: function() {
            this.setDebug(false);
        },
        setDebug: function(active,count) {
            this.debug=u.isBool(active) ? active : true;
            when.debug = this.debug;
            if (active) {
                if (typeof count==='number') {
                    this.debugCount= count;
                }
            } else {
                this.debugCount=-1;
            }
        },
        nextIsProblemAssertion: function() {
            return this.debug && !this.stopped && this.debugCount>=0 
                && this.debugCount === this.count-1;
        },
        timeoutOnce: function(seconds) {
            var me=this,
                originalTimeout = me.timeout;
            me.then(function() {
                me.timeout = seconds;
            });
            me.afterNext(function() {
                me.timeout = originalTimeout;
            });
        },
        // set options for this test 
        configure: function(options) {
            if (typeof options === 'string') {
                options = {name: options};
            }
            var allowedOpts =u.extend({},testDefaults);
            // update with current options, then with options passed
            u.extend(allowedOpts,this,options,true);
            u.extend(this,allowedOpts);
        },
        // queue a callback to attach to the next thing queued.
        then: function(callback,errFunc) {
            var me=this,       
                errback=errFunc || function(err) {
                    // failures of everything end up here - if we've already broken for a particular reason then 
                    // stop logging all the inevitable timeouts.
                    me.testerror(err,false);
                },
                prev = me.promise,
                next = when.defer();
            
            me.promise = next;
            prev.then(function(val) {

                try {
                    if (me.nextIsProblemAssertion()) {
                        // the next event is the one causing you trouble
                        debugger;
                    }
                    callback(val);
                }
                catch(err){
                    me.testerror("An error occurred during a 'then' clause of an assertion: "+String(err),true);
                }
            },errback);

            
            when.chain(prev,next);           

            return me;
        },
        chain: function(callback,errback) {
            var next = when.defer(),
                prev = this.promise;

            this.promise = next.promise;
            prev.then(callback,errback || bind(this,this.testerror));
            when.chain(prev,next);
            return this;
        },
        //TODO
        afterNext: function(callback,errback) {
            this.nextThen.push({callback:callback, errback:errback});
        },
        startTest: function (info) {
            this.count++;
            // cache the active assertion data
            this.assertionInfo = u.extend({},info,
            {
                count: this.count
            });
            this.doWriterEvent("itemStart",this.assertionInfo);
            this.itemRunning=true;
        },
        endTest: function (result) {
            // TODO: Option allowing logging of passed tests
            var output=result;
            if (!this.itemRunning) {
                this.testerror("Error: test was not running when endTest called: " + result.desc);
                return;
            }
            if (!result.passed) {
                output=this.addResult(result);
                this.countFailed++;
            } else {
                this.countPassed++;
            }
            this.itemRunning=false;
            this.doWriterEvent("itemEnd",output);
        },
        // queue a test that returns true or false
        // will wrap it & pass on to queueTest
        queueBooleanTest: function(module,assertion,args,invert) {
            return this.queueTest(function() {
                var result= module.apply(null,u.toArray(arguments));

                if (result.passed === invert) {
                    throw({
                        name: "AssertionError",
                        type: "iq",
                        message: u.format(result.err.replace('{not}','{0}'),invert?'not ':'')
                    });
                }
            },
            assertion,
            args);
        },
        // queue a test that throws an error
        queueTest: function(module,assertion,args)
        {
            var me=this, 
                // internal methods are wrapped in tryTest - get their args as the 2nd arg in "args." Argh!
                cbPos, 
                assertionName=assertion.split('.')[1],
                methodArgs=assertionData[assertionName].args,
                hasMagicCallback,
                deferred,
                next,prev,
                pending=[];

            if (me.stopped) {
                return me;
            }

            // check for the "magic" callback. If me.cbPromise exists, then it was hopefully created by the parameters
            // for this method. This is slightly brittle because there's no direct binding of the particular promise to 
            // this particular method, but the single-threaded nature of javascript should cause this to work fine. 
            // I can't see any substantive risk here and it is extraordinarily convenient.

            if (me.cbPromise) {
                hasMagicCallback=true;
                deferred = deferred || when.defer();

                if (methodArgs===1) {
                    cbPos=0;
                } else if (args[0] && !args[1]) {
                    cbPos=1;
                } else if (args[1] && !args[0]) {
                    cbPos=0;
                } else {
                    me.testerror(u.format('I couldn\'t figure out what to do with your magic callback. ' 
                        + 'For this test you may need to define it explicitly.'
                        + '[{0}] {1}',assertion,assertMessage(args)));
                    return;
                }

                me.cbPromise.then(function(response) {
                    args[cbPos]=response;
                },function(err) {
                    deferred.reject('The callback failed. ' + (err ? u.format('Reason: {0}',String(err)) :''));
                });
                pending.push(me.cbPromise);
                me.cbPromise=null;
            }

            // special case - must check argument for "resolves"

            if (assertionName==='resolves' && !when.isPromise(args[0])) {
                throw("The argument passed to 'resolves' was not a promise.");
            }

            // check all the arguments to this assertion for promises or callbacks; if any are found,
            // add to our list of things to do before resolving this assertion.

            u.each(args,function(i,arg) {

                // wait for any promises
                if (when.isPromise(arg)) {

                    deferred = deferred || when.defer();

                    if (i===0 && hasMagicCallback) {
                        deferred.reject("You're using magic callback but you've also defined a promise as the first argument of your assert.");
                    }
                    arg.then(function(response)
                    {
                        args[i]=response;
                    });
                    pending.push(arg);
                }

            });

            // queue a promise that will emit events when the test has started.
           
            this.chain(function() {
                me.startTest({
                    desc: assertMessage(assertion,args),
                    assertion: assertion
                });
            });
            

            // if there are pending promises, then wait for all those events (in addition to the last promise)
            // before resolving. Add a timeout on top of it if necessary.

            if (pending.length) {
                pending.push(me.promise);
                
                me.promise = me.timeout ? 
                    when_timeout(deferred.promise,me.timeout*1000):
                    deferred.promise;

                when.chain(when.all(pending),deferred);
            } 


            // link each test to a new resolver so failures will break the chain at that point
            // some tests don't have an "actual" part (e.g. pass,fail).  

            next = when.defer();
            prev = me.promise;
            me.promise = next.promise;
            prev.then(function resolve(value) {
                // check if a value was passed - it is likely the cb parm
                if (me.runTest.call(me,module,assertion,args)) {
                     next.resolve();
                } else {
                     next.reject("The test failed");
                }
            },function reject(err) {
                if (me.itemRunning) {
                    me.endTest({ 
                        passed: false,
                        err: String(err)
                    });
                }
                next.reject("The test was stopped because an assertion failed.");
            });


            
            //me.resolver=deferred.resolver;
            
            return me;
        },
        // run a named test using the arguments in array args
        runTest: function (module,assertion,args) {
            // should return an object [err: error message, desc: description of test passed in]
            var result={
                assertion: assertion,
                err: '',
                passed: true
            };

            //args is an object mapped to the relevant parms for any assert
            try {
               module.apply(null, args);    
            }
            catch(err)
            {
                // rethrow anything that isn't a test failure - it will be caught and dealt with higher up.
                if (err.name !== 'AssertionError') {
                    if (this.debug) {
                        debugger;
                        // Continue execution to try the assertion again
                        module.apply(null, args);  
                    } else {
                        this.setDebug();
                        err.message = (err.message || err.type) + ". Debugging has been enabled.";
                    }
                }
                if (err.type==='iq') {
                    err.message = u.format('[{0}] {1}',assertion,err.message);
                }
                result.err = err.message;
                result.passed=false;
            }
            
            this.endTest(result);
            return result.passed;
        },
        /// add the current test results as properties to the object passed in 
        addResult: function (result) {

            var output = u.extend({}, result),
                    passfail = output.passed ?
                     "passed" :
                     "failed";

            // "Test #[1] [assertEq] [passed|failed] [with result "message"] [in test "test"]

            output.count = this.count;
            output.fulltext = u.format('Test #{0} {1} {2} {3}{4}',
                    this.count,
                    this.assertionInfo.assertion,
                    passfail,
                    output.passed ? 
                        '' : 
                        ': ' + result.err,
                    
                    u.format(' in test "{0}"', this.assertionInfo.desc) 
                        
                    );

            this.results.push(output);
            return output;

        },
        
        // when the debugging parm is true, will enable debugging for the group
        testerror: function(err, debug) {
            var me=this;
            try {
                
                if (me.stopped) {
                    return;
                }
                me.stopped=true;
                me.passed=false;
                
                this.doWriterEvent("testLog",
                    u.format('{0}. {1}',String(err),
                        debug ? 'Debugging is enabled if you start again.' : '' ));
            }
            catch(e) {
                // this is basically a fatal error. Not much else to do.
                debugger;
                 
            }

            if (debug) {
                me.setDebug(true,me.count);
            }
            

        },

        // create a callback that the next assert will wait for, optionally expiring.
        callback: function(target,timeout) {
            var me=this,
                t = timeout || me.timeout,
                deferred = when.defer();

            // if no timeout is specified, the actual function is already wrapped by a timeout so not needed

            me.cbPromise= 
                t ? 
                 when_timeout(deferred, t * 1000) :
                 deferred;

            return function() {
                var value;
                if (!target) {
                    value=true;
                } else {
                    if (me.debug) {
                        value=target.apply(this,u.toArray(arguments));
                    } else {
                        try
                        {
                            value=target.apply(this,u.toArray(arguments));
                        }
                        catch(err)
                        {
                            me.testerror("An error occurred in your callback(): "+String(err),true);
                            deferred.reject(value);
                            return;
                        }
                    }
                }
                deferred.resolve(value);
            };
        },
        
        /*  creates a promise bound to the resolution of a callback, and adds it to the
            assertion queue. usage (note "callback" parameter)
          
            this.when(function(callback) {
                doSomething(arg1,arg2,callback)
            }).then(function(response) {
                a.equals(expected,response)
            });
        
        */

        when: function(func,timeout) {
            var me=this,
                t=timeout || me.timeout,
                next = when.defer(),
                last = me.promise;
            

            me.promise = t ? when_timeout(next, t*1000) : next;

            // this promise will chain upon successful resolution of the callback to "next"
            // however we still need a failure handler for "last" becase an error in "func"
            // could cause it to never resolve. This is better than timing out.

            last.then(function() {
                func.call(me,next.resolve);
            }).then(null,function(err) {
                me.testerror("An error occured during a 'when' operand: " + String(err),true);
                next.reject();
            });

            return me;
        },

        // create a new deferred object (same as when.defer) and bind completion of the tests to its
        // resolution

        defer: function(callback,timeout) {
            var me = this,
                next = when.defer(),
                t = timeout || me.timeout;
            
            // just replace the active promise -- there is no dependency on the prior
            // promise because user code is responsible for resolving this promise.

            me.promise = t ? when_timeout(next, t*1000) : next;

            if (callback) {
                // we don't need to bind an error handler to the callback because this is now
                // the last promise on the chain.
                next.then(callback);
            }
            return next;
        },
        // return a promise from a function that has a callback parameter
        backpromise: function(func,callback,timeout) {
            var defer=when.defer(),
                me=this,
                t=timeout || me.timeout,
                cb=function() {
                    var value;
                    if (callback) {
                        if (me.debug) {
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
                    }
                    defer.resolve(value);
                };
            
            if (me.debug) {
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

            
            return t ? when_timeout(defer, t*1000) : defer;
        }

    };

    // Global configuration

    options = u.extend({},globalDefaults);

    // PUBLIC API

    iqtestApi =  {
        // Create & return a new test group and configure with the options passed
        create: function(name,desc,groupOpts) {
            var finalOpts = u.extend({
                timeout: options.timeout,
                setup: options.setup,
                teardown: options.teardown
            },groupOpts);

            var group = new TestGroup(name,desc,finalOpts);
            return group;
        },
        add: function () {
            return this.add.apply(this,u.toArray(arguments));
        },
        extend: function(assertions) {
            iq_asserts.push(assertions);
        },
        // configure global options.
        configure: function(newOpts) {
            u.extend(options,newOpts,true);
        },
        options: options,
        // library of available writers; each should be a prototype that can be instantiated and exposing the
        // correct api (see html implementation)
        writers: {},
        impl: {
            TestGroup: TestGroup,
            Test: Test,
            Assert: Assert,
            utility: u
        }
    };
    return iqtestApi;
});
}(typeof define === 'function'
    ? define
    : function (deps, factory) { 
        if (typeof module !== 'undefined') {
            module.exports = factory(require('./when'),
                require('./timeout'),
                require('./buster-assertions'),
                require('./common.utils')
                );
        } else {
            if (!this.iqtest_assertions) {
                this.iqtest_assertions=[];
            } 
            this.iqtest = factory(this.common.utils,this.when,this.when_timeout,this.iqtest_assertions, 
                this.buster ? this.buster.assert : null);
        }
    }
));