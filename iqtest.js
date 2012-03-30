
/*
IqTest: A javascript testing framework that promises to be easy

(c) 2012 James Treworgy
MIT License
*/

/*jslint novar:true, onevar: false, debug: true */
/*global alert, define, require, module, buster */


(function(define) {

define(['./iqtest'], function(u,when,when_timeout, iq_asserts, buster_asserts, utils) {
    var Test, TestGroup, Assert,
    // default values for TestGroup
    groupDefaults = {
        name: "Unnamed Test Group",   
         // when true, will not trap errors in the test itself.
        debug: false,
        // passed assertions should be show in any output
        showPassed: false
        // events
        
    },
    // default values for Test and also defines allowed options
    testDefaults = {
        name: "",
        desc: "Unnamed Test",
        func: null,
        showPassed: false,
        timeoutSeconds: 10,
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
    u = {
        // when onlyInSource is true, properties will not be added - only updated
        // passing a falsy value as the target results in a new object being created
        // and onlyInTarget is irrelevant
        extend: function (target) {
            var prop, source, sources, i,
                li = arguments.length,
                lastBool = u.isBool(arguments[li-1]),
                len = lastBool ?
                    li-2 : li-1,
                emptyTarget=!target,
                onlyInTarget = lastBool ?
                        arguments[len+1] : false;

                target = target||{};

                sources=u.toArray(arguments,1,len+1);

            for (i=0;i<sources.length;i++) {
                source = sources[i];
                for (prop in source) {
                    if (source.hasOwnProperty(prop) 
                        && (emptyTarget || !onlyInTarget || target.hasOwnProperty(prop))) {
                        target[prop] = source[prop];
                    }
                }
                // start honoring onlyInTarget after the first source
                emptyTarget=false;
            }
            return target;
        },
        // copy selected properties to a new object
        filter: function(source,what) {
            var target={},
                props = u.isArray(what) ? 
                what :
                what.split(',');

            u.each(props,function(i,prop) {
                target[prop]=source[prop];
            });
            return target;
        },
        toArray: function(arrLike,first,last) {
            return Array.prototype.slice.call(arrLike,first || 0, last);
        },
        isArray: function (obj) {
            return obj && obj.constructor === Array;
        },
        isFunction: function (obj) {
            return typeof obj === 'function';
        },
        isString: function(obj) {
            return typeof obj === 'string';
        },
        isBool: function(obj) {
            return typeof obj === 'boolean';
        },
        trim: function(str) {
            return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
        },
        //split with trim (why would you want it any other way?)
        split: function(str,delim) {
            var result=[];
            u.each(str.split(str,delim),function(i,e) {
                result.push(u.trim(e));
            });
            return result;
        },
        // replaces {0}.. {n} with the ordinal valued parameter. You can also pass an 
        // array instead of multiple parameters
        format: function (text) {
            var args = (arguments.length === 2 && u.isArray(arguments[1])) ?
                arguments[1] :
                this.toArray(arguments,1);
            return text.replace(/\{(\d+)\}/g, function (match, number) {
                return typeof args[number] !== 'undefined'
              ? String(args[number])
              : match
            ;
            });
        },
        // usual each, if you happen to pass a string, it will split it on commas.
        // it will always trim string values in an array.
        each: function (coll, cb) {
            var i,val;
            if (u.isString(coll))
            {
                coll=coll.split(',');
            }
            if (u.isArray(coll)) {
                for (i = 0; i < coll.length; i++) {
                    val = u.isString(coll[i]) ?
                        u.trim(coll[i]) : coll[i];

                    if (cb.call(val, i, val)===false) {
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
        // ugh
        event: function(func,that,parm) {
            if (u.isFunction(func)) {
                func.call(that,parm);
            }
        },
        donothing: function() {},
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

    };

    /* Begin Main Code */
       
    TestGroup = function (options) {
        initialize();
        u.extend(this,
            u.extend(null,groupDefaults,options,true)
        );
        this.clear();
    };

    TestGroup.prototype = {
        constructor: TestGroup,
        // "test" should be a function with one parameter, this parameter is passed as an object
        // representing the current test object.
        test: function(name,desc,func) {
            var me=this,
                hasDesc = !!func,
                testData = {
                    name: name,
                    desc: hasDesc ? desc : '',
                    func: hasDesc ? func : desc,
                    debug: me.debug,
                    showPassed: me.showPassed
                },
                test = new Test(testData);

            me.add(test);

            return me;
        },
        add: function(test) {
            var me=this;
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
            }
            return me;
        },
        run: function (name, desc, func) {
            var finishFunc,
                me=this;

            u.each(me.tests,function(i,test) {
                test.reset();
            });

            u.event(me.groupStart,me,u.filter(me,"name,desc"));
            
            u.each(me.tests,function(i,test) {
                var assert=u.extend({},test.assert,{test: test}),
                refute = u.extend({},test.refute,{test: test});

                u.event(test.testStart,test,u.filter(test,"name"));

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

                test._lastPromise=test.promise;
                test._allPass=true;

                finishFunc=function(test) {
                    if (test.promise!==test._lastPromise) {
                        test._lastPromise=test.promise;
                        test._lastPromise.then(function() {
                            finishFunc(test);
                        },function(err) {
                            test.testerror(err,true);
                            finishFunc(test);
                        });
                        return;
                    }
                    if (!u.isBool(test.passed)) {
                        test.passed = (test.count===test.countPassed);
                    }
                    test._allPass &= test.passed;
                    
                    u.event(test.testEnd,test,u.filter(test,"count,passed"));

                    if (test===me.tests[me.tests.length-1]){
                        if (u.isBool(test.passed)) {
                            me.passed=test._allPass;
                        }
                        u.event(me.groupEnd,me,u.filter(test,"passed"));
                    }
                };
                test.promise.then(function() {
                    finishFunc(test);
                },function(err) {
                    test.testerror(err,true);
                    finishFunc(test);
                });
            });
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
        me.reset();
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
                // count to stop at when debugging is enabled
                debugCount: 0,   
                nextThen: [],
                cbPromise: null,
                resolver: null,
                stopped: false,
                passed: null

            });
            // resolve immediately to start the chain when the first thing is added
            this.promise.resolve();
        },
        nextIsProblemAssertion: function() {
            return this.debug && !this.stopped && this.debugCount === this.count-1;
        },
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
                oldPromise = me.promise,
                newPromise = when.defer();
            
            newPromise.then(function(){
                try {
                    if (me.nextIsProblemAssertion()) {
                        // the next event is the one causing you trouble
                        debugger;
                    }
                    callback();
                }
                catch(err){
                    me.testerror("An error occurred during a 'then' clause of an assertion: "+String(err),true);
                }
            }
                ,errback);
            me.promise = newPromise;
            when.chain(oldPromise,newPromise);           

            return me;
        },
        //TODO
        afterNext: function(callback,errback) {
            this.nextThen.push({callback:callback, errback:errback});
        },
        startTest: function (info) {
            this.count++;
            u.event(this.itemStart,this,u.extend({},info,
            {
                count: this.count
            }));
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
            u.event(this.itemEnd,this,output);
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

            // wait for any promises or callbacks
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



            // notify event handlers
            // do not replace current promise - this should not be blocking

            me.then(function() {

                me.startTest({
                    desc: assertMessage(assertion,args),
                    assertion: assertion
                });
            });

            // wait for everything async that's going on

            if (pending.length) {
                pending.push(me.promise);
                
                 me.promise = me.timeoutSeconds ? 
                    when_timeout(deferred.promise,me.timeoutSeconds*1000):
                    deferred.promise;

                //me.promise = deferred.promise;
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
                    me.endTest({ passed: false,
                        desc: String(err)
                    });
                }
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
                        module.apply(null, args);  
                    } else {
                        this.debug=true;
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
        addResult: function (result) {

            var output = u.extend({}, result),
                    msg = output.passed ?
                     "passed" :
                     "failed";

            // "Test #[1] [assertEq] [passed|failed] [with result "message"] [in test "test"]

            output.count = this.count;

            output.fulltext = u.format('Test #{0} {1}{2}{3}',
                    this.count,
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
        
        // when the debugging parm is true, will enable debugging for the group
        testerror: function(err, debug) {
            var me=this;
            
            if (me.stopped) {
                return;
            }
            me.debugCount = me.count;
            me.stopped=true;
            me.passed=false;
            
            u.event(me.log,me.group,
                u.format('{0}. {1}',String(err),
                    debug ? 'Debugging is enabled if you start again.' : '' ));

            if (debug) {
                me.debug=true;
            }
            

        },
        // create a callback that the next assert will wait for, optionally expiring.
        callback: function(target,timeout) {
            var me=this,
                t = timeout || me.timeoutSeconds,
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
        // return a promise from a function that has a callback parameter
        backpromise: function(func,callback,timeout) {
            var defer=when.defer(),
                me=this,
                t=timeout || me.timeoutSeconds,
                cb=function() {
                    var value;
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
        },
        testStart: u.donothing,
        testEnd: u.donothing,
        itemStart: u.donothing,  
        itemEnd: u.donothing,
        log: u.donothing
    };


    return {
        configure: function(options) {
            var group = new TestGroup(options);
            return group;
        },
        test: function () {
            // TODO: chaining - this will be called from 
            var group = new TestGroup(this);
            return group.test.apply(group,u.toArray(arguments));
        },
        extend: function(assertions) {
            iq_asserts.push(assertions);
        },
        impl: {
            TestGroup: TestGroup,
            Test: Test,
            Assert: Assert,
            utility: u
        }
    };
});
}(typeof define === 'function'
    ? define
    : function (deps, factory) { 
        if (typeof module !== 'undefined') {
            module.exports = factory(require('./when'),
                require('./timeout'),
                require('./buster-assertions'),
                require('./trewtech.utils')
                );
        } else {
            if (!this.iqtest_assertions) {
                this.iqtest_assertions=[];
            } 
            this.iqtest = factory(this.common.utils,this.when,this.when_timeout,this.iqtest_assertions, 
                this.buster ? this.buster.assert : null);
        }
    }
    // Boilerplate for AMD, Node, and browser global
));