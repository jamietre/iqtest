### iqtest

A promise-aware testing framework for Javascript

3/12/2012: version 0.1

### What is this? 
###### Why would you make YATF (Yet Another Testing Framework)?

iqtest is a unit testing framework that leverages promises to make your life much easier. A promise is something that supports the [CommonJS](http://www.commonjs.org/ "CommonJS") [Promise/A](http://wiki.commonjs.org/wiki/Promises/A) api. 

Unit testing Javascript is historically a big pain because of the lack of adequate language features to write concise event-handling code.

Some more recent works have improved matters, e.g. [Mocha](http://visionmedia.github.com/mocha/ "Mocha"). From the outset, though, I never got into Jasmine or Mocha because I didn't want to learn a new language. I know that creating Javascript constructs that resemble human communication is all the rage. Personally, I value conciseness and the adoption of common pardigms, to verbosity and the necessity to learn a new set of verbs for every tool I use. No offense if you like MacchianoAmericanoScript and stuff. I just like to speak to my computer in the most direct and least ambiguous way possible.

As much as I just want a framework that uses common, simple functions like `areEqual` instead of a whole new language, though, I could have forgiven that if it allowed me to write concise tests.

#### Mocha - chocolate covered tests

This is how you write an async callback test in Mocha, given a function `getAsync(opts,callback)`:

    it('should respond with the correct value', function(done){
      getAsyncData(opts,function(response) {
         response.should.equal('correct');
         done();
      });

That's a mouthful for not doing very much. Maybe I'm old school but I want a test as simple as this one to be able to be written on one line so I can immediately understand its purpose, yet still be readable. 

In order to be readable on one line, you can't be creating inline closures: 
   
    it('should respond with the correct value', function(done) { getAsyncData
        (opts,function(response) { response.should.equal('correct'); done(); });

It doesn't really fit on one line, and I had to break it at an awkward place to keep it to only two lines. Even something this simple is largely incomprehensible without indenting. And I am not sure what would happen if `wait` failed and in never resolved, either.

#### A promise to keep it simple

The promise api addresses the whole callback issue with the *promise* object which encapsulates the state of completion. Using promises and a testing framework that is aware of them makes this possible. 

We want to assert that *getAsyncData(opts) responds with the value 'correct'*. You can understand that concept simply. You don't want to think about the fact that it takes some small amount of time for it to return. All you care is that it does, and that the value is right.

iqtest rewrites this test, assuming that our getAsyncData function also returns a promise:

	a.areEqual('correct',getAsyncData(opts),'should respond with the correct value');

It does exactly the same thing, but it eliminates two closures (e.g. two appearances of the word 'function') and removes all control flow logic from the test.  It also sets a timeout on the promise automatically so the test will fail if it never returns.

If you aren't using promises in your javascript code, start now. You can still use iqtest with callback constructs, though. The code below does not care what `getAsyncData` returns:

    a.areEqual('correct',getAsyncData(opts, a.callback()), 'should respond with the correct value');    // * see note

\* This works by magic. It really doesn't matter what getAsyncData returns.

#### Using it


The framework itself does not require anything other than when.js and timeout.js from [https://github.com/cujojs/when](https://github.com/cujojs/when)

The example uses a test harness for web browsers that requires jquery. You can run this without jQuery and create your own analysis tool for its output.

The best way to see how it works is just fire up `iqtest-runner.html` in your browser.

Source repository: [https://github.com/jamietre/iqtest](https://github.com/jamietre/iqtest)


### Overview


This is all so new, but here's an example. Assume a function called "wait" that returns a promise. 

An example. This is similar to what's in the example here, some tests are designed to fail for illustration purposes.

	iqtest
		.writer($('#output'))
		.test("Test 1",function(a) {
		
			a..isTrue(true,"A true value is true")
				.then(function() {
					a.areEqual(3,3,"Should fail 3=3");
				}); 
		
			// the 'waitcb' function is a non-promise enabled 'wait'
			// it's second parameter is a callback function. we can
            // let iqtest create one to use for us.

			a.areEqual(2,wait(2),"Waited 2 secs")
				.areEqual(3,waitcb(3,a.callback()),"Waited 3 secs")
				.pass('Got through two chained callbacks');

            // you can pass a function to it to process the response
			// though i don't approve of too many inline functions so 
            // i define the function first. 
			
			var cbHandler = function(response) {
				return response*2;
			};
			a.areEqual(6,waitcb(3,a.callback(cbHandler)),"Waited 3 secs and multiplied by 2")

			// you can also create a promise to wrap the callback function
			// 'promise' is a member of the iqtest object. iqtest maps
			// a couple members of its api to the global object (window)
            // convenience. you can easily change this if this interferes
            // with the code you're testing

			// promise(func,callback)
            // func gets called with a function that should be passed as the
            // callback

			var p = backpromise(function(cb) {
		    		$('#sample').hide('slow',cb);
		    	}, function(response) {
		   			return "xxx";
		    	});
	
			// now use p just like any promise-returning function		
			
			a.areEqual(124,p,"Hoping to get 'xxx'");
		
			// use then to explicity wrap code that needs to run inline
            // other than asserts (see "Caveats" below)

			a.then(function() {
				a.isFalse(y,"y is false");
				a.areEqual(10,glob,"global got set by wait");	
				y=true;
			})
			.then(function() {
				a.areEqual(true,y,"y is now true");
			})
			.areEqual(1,1,"Numbers are equal");
			
		})

### Chaining

The parameter `a` is an `Assert` object and is where you will call your assertions. This is passed to each test to permit concurrency. If we just created global methods for the assertions, they could not be tied to a particular test, and we could only run one at a time.

You can write chained code to minimize the number of types you will type `a` as shown above. Every assert returns the assert object.

The `Assert` object also implements the promise API, `then`. You can use this to explicitly bind code other than asserts to an event.

Every assert is automatically chained to the one before it, whether or not you use the chaining method. It's functionally identical to chain or not chain when calling a method on a single `Assert` object. However, things can still run out of order because of asynchronicity....

### Caveats

There is definitely some trickery needed to make all this possible. This can have unintended consequences if you don't understand how it works. While the goal is to hide the innard of the async processing as much as possible, there are some things that may trip you up. For example:

    var x=0;

    a.areEqual(3,wait(3),"Wait returns the parameter it was passed after a time")  // 1st assert: passes
		.areEqual(0,x,"x is zero");   // 2nd assert: fails!!

    x=2;

	a.areEqual(2,x,"x is 2"); // 3rd assert: passes

The first assert starts an async callback. The 2nd assert is `bound to the resolution of the first assert`. By design, and logcally, it will not run until the callback finishes 3 seconds later.

But while things are tied up at city hall for the first two asserts, the code continutes on its merry way and sets `x=2` while we are waiting for assert #1 to finish.

So by the time assert #2 runs, x is quite definitely not equal to zero any more. Assert #3 resolves true, of course.

To avoid this, just assume that everything that is *not an assert* gets run immediately. Because it pretty much does. it's much the same concept as variable hoisting. There's nothing wrong with mixing setup code in with the asserts, but if you are going to write code that depends on something *which can change later in the test* you need to wrap it explicitly. Here's the "corrected" version of this test:

    var x=0;

    a.areEqual(3,wait(3),"Wait returns the parameter it was passed after a time")
		.areEqual(0,x,"x is zero");
		.then(function() {
			x=2;
		});
		.areEqual(2,x,"x is 2"); // 3rd assert: passes


Remember, chaining happens automatically. This code is the same:


    var x=0;

    a.areEqual(3,wait(3),"Wait returns the parameter it was passed after a time")
	a.areEqual(0,x,"x is zero");
	a.then(function() {
		x=2;
	});
	a.areEqual(2,x,"x is 2"); // 3rd assert: passes

Cool eh?

### Reference



    iqtest     

the namespace for this project

		.test(name,testFunc(assert))

create a `TestGroup` and call its test method with these parameters


	TestGroup (returned by iqtest.test)

An object containing one or more Tests

		.test(name,testFunc(assert))

Start a new test in this group asynchronously

		.then(callback,errback,progress)

Promise API for a TestGroup (not implemented yet, will be useful to create code blocks that must run only when a test is completed)

		.then(name,testFunc(assert))

Start a new test that will not run until the previous test finishes (not implemented yet)

		.end(time)

Set a timeout for the testgroup, return a *new* Testgroup (not implemented yet)

	Test

A test object as passed to `TestGroup.test`. You generally don't need to use its api, except if writing a test harness to process the results. Though tests are run with this context, so if you wanted, you could use (e.g.) `this.then` instead of `a.then` (where `a` is the assert object passed to each test run).

		.assert

an `Assert` object, this is passed to the test function as the only parameter

		.then

chain an assert or promise, exposed by `assert.then`

		.		

    Assert

		.backpromise(function(callback),callbackFunction,timeout)

return a promise made from a callback-enabled function. if no timeout is set, defaults to 10 seconds.

Create 

### Markdown

If you use windows and Markdown, this is awesome.

http://markdownpad.com/

### Code use license.

LICENSE (MIT License)
 
Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
 
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
