/*
	An HTML output writer for iqtest

	Uses options on the TestGroup:
	groupTemplate: {name} = group name
	testTemplate: {name} = test name, {desc} = simple failure description
	itemTemplate: {fulltext} 

	This should append itself to iqtest.writers.xxx

*/
/*global iqtest, when */
/*jslint smarttabs:true  */

(function(iqtest) {
	var u = iqtest.impl.utility,
		options = {
			group:'<pre><h1>Starting test group "<span class="test-name"></span>": <span class="test-groupstatus"></span></h1>'+
				'<div><div></div></div></pre>',
			testStart: '<h2>Starting test "<span class="test-name"></span>": <span class="test-teststatus"></span></h2><div></div>',
			testEnd: '<h3><span class="test-count"></span> assertions passed.</h3>',
			itemStart: '<span style="color: blue;font-style: italic;">#<span class="test-number"></span>: '
					+'<span class="test-assertion"></span> "<span class="test-message"></span>"....</span><br/>',
			itemEnd: '<span class="test-failmessage"></span><br/>',
			log: '<span style="color:purple"><span class="test-logmessage"></span><br/>',
			// the following are just formats 
			resultSuccess: '<span style="color:green"></span>',
			resultFail:'<span style="color:red"></span>',
			showPassed: false
			
		};
	
	// replace every element in "el" containing class "test-*" with the value of properties "*"
	function tmpReplace(el,obj){
		var sel,replaceEl,prop;
		for (prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				sel = '.test-'+prop.toLowerCase();
				replaceEl = $(sel,el);
				if (!replaceEl.length) {
					replaceEl=$(el).filter(sel);
				}
				replaceEl.empty().append(obj[prop]);				
			}
		}
		return el;
	}

	function getResultOutput(passed) {
		var tmpl = passed ? options.resultSuccess: options.resultFail;
		
		return $(tmpl).text(passed ? "Passed":"Failed");
	}

	/* Implementation */

	function groupStart(group) {
		var groupWrapper = tmpReplace($(options.group).clone(),{
			name: group.name,
			groupstatus: "Running"
		});

		this.container.append(groupWrapper);
		
		// should be the innermost div
		this.groupWrapper = groupWrapper;
		this.groupContainer = groupWrapper.find('div:only-child:last');
	}
	function groupEnd(group) {
		tmpReplace(this.groupWrapper,{
			groupstatus: getResultOutput(group.passed)
		});
	}

	function testStart(test) {
			
		var testData = this.getTestData(test.id),
			content= tmpReplace($(options.testStart).clone(),{
				name: test.name,
				teststatus: "Running"
			});

		testData.testWrapper = content;
		testData.testContainer = content.filter('div');

		this.groupContainer.append(content);
	}

	function testEnd(test) {
		var testData = this.getTestData(test.id),
			content = tmpReplace($(options.testEnd).clone(),{
				count: test.count
			});

		testData.testContainer.append(content);
		
		tmpReplace(testData.testWrapper, {
			teststatus: getResultOutput(test.passed)
		});
	}

	function itemStart(test,testinfo)
	{
		var testData = this.getTestData(test.id),
			tempItem= tmpReplace($(options.itemStart).clone(),{
				number: testinfo.count,
				assertion: testinfo.assertion,
				message: testinfo.desc
			});

		testData.itemTarget = tempItem;
		testData.testContainer.append(tempItem);
	}
	function itemEnd(test,response) {
		// this can get called without itemStart (prob should create a different kind of event for errors but...)
		var testData = this.getTestData(test.id);

		if (response.passed) {
			if (!options.showPassed) {
				testData.itemTarget.remove();
			}
		} else {
			testData.itemTarget.replaceWith(tmpReplace($(options.itemEnd).clone(),{
				failmessage: response.fulltext
			}));
		}
		testData.itemTarget=null;
		response.written=true;
	}
	function testLog(test,message) {
		var testData = this.getTestData(test.id);
		testData.testContainer.append(tmpReplace($(options.log).clone(),{
			logmessage: message
		}));
	}
	//	function render() {
	//	var me=this;

	//	u.each(me.results,function(i,result) {
	//		if (!result.written) {
	//		.event(this.group.itemEnd,this.group,result);
	//	}
	//	});
	//	}

	// ensure that errors don't ever cause a promise to fail. errors in the harness should always
	// cause execution to stop.

	function safeMethod(method) {
		return function() {
			var error;
			try {
				method.apply(this,u.toArray(arguments));
			}
			catch(err) {
				when.debug=true;
				throw error;
			}
		};
	}
	function HtmlWriter(container, opts) {
		// when added to a TestGroup, the group should assign itself to owner
		this.owner=null;
		this.container=container;
		this.tests={};

		if (typeof opts==='object') {
			$.extend(options,opts);
		}
	}

	HtmlWriter.prototype = {
		constructor: HtmlWriter,
		groupStart: safeMethod(groupStart),
		groupEnd: safeMethod(groupEnd),
		testStart: safeMethod(testStart),
		testEnd: safeMethod(testEnd),
		itemStart: safeMethod(itemStart),
		itemEnd: safeMethod(itemEnd),
		testLog: safeMethod(testLog),
		// internal api
		getTestData: function(id) {
			if (!this.tests[id]) {
				this.tests[id]={};
			}
			return this.tests[id];
		}
	};


	iqtest.writers.html = HtmlWriter;

}(iqtest));

