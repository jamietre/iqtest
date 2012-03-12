/*
	A harness for iqtest

	Uses options on the TestGroup:
	groupTemplate: {name} = group name
	testTemplate: {name} = test name, {desc} = simple failure description
	itemTemplate: {fulltext} 

*/
/*global iqtest */

(function(iqtest) {
	var u = iqtest.impl.utility, 
		oldRun,
		tpl = {
			group:'<pre><h1>Starting test group "<iq-name></iq-name>": <iq-groupresult></iq-groupresult></h1>'+
				'<div><div></div></div></pre>',
			testStart: '<h2>Starting test "<iq-name></iq-name>": <iq-testresult></iq-testresult></h2>',
			testEnd: '<h3><iq-count></iq-count> tests run; <iq-countPassed></iq-countPassed> passed; '+
				'<iq-countFailed></iq-countFailed> failed.</h3>',
			itemStart: '<span>Running test #<iq-count></iq-count>: '
					+'<iq-assertFuncName></iq-assertFuncName> "<iq-desc></iq-desc>"</span>',
			itemEnd: '<span><iq-fulltext></iq-fulltext></span><br/>',
			resultSuccess: '<span style="color:green"><iq-resulttext></iq-resulttext></span>',
			resultFail:'<span style="color:red"><iq-resulttext></iq-resulttext></span>'
		};
	
	iqtest.templates=tpl;

	oldRun = iqtest.impl.TestGroup.prototype.run;

	u.tmpReplace=function(el,obj){
		u.each(obj,function(i,e) {
			if (typeof e === 'string' || typeof e === 'number') {
				var replaceEl = el.find('iq-'+i.toLowerCase());
				replaceEl.replaceWith(	
					u.format('<span>{0}</span>',e)
				);
				
			}
		});
		return el;
	};
	function getResultOutput(passed) {
		var tmpl = passed ? tpl.resultSuccess: tpl.resultFail;
		return u.tmpReplace($(tmpl),{resulttext: passed ? "Passed":"Failed"});

	}
	iqtest.impl.TestGroup.prototype.run = function() {
			var wrap = $('#wrap');
			wrap.empty();
			oldRun.call(this).then(function(t) {
				u.newChain(
					function() {  
						
						t.group.render(wrap);       
					}
				);
			});
	};
	iqtest.impl.TestGroup.prototype.writer=function(el) {
		var wrap = $(el);
		wrap.empty();

		this.outputTarget = wrap;
		this.groupStart = function(group) {
			var groupWrapper = u.tmpReplace($(tpl.group).clone(),group);
			this.outputTarget.append(groupWrapper);
			// should be the innermost div
			this.groupTarget = groupWrapper;
			this.testTarget = groupWrapper.find('div:only-child:last');

		};
		this.groupEnd = function(group) {
			var result = getResultOutput(group.passed);
			this.groupTarget.find('iq-groupresult').replaceWith(result);
		};
		this.testStart = function(test) {
			var content= u.tmpReplace($(tpl.testStart).clone(),test);
			this.testTarget.append(content);
		};
		this.testEnd = function(test) {
			var result,
				content = u.tmpReplace($(tpl.testEnd).clone(),test);
			this.testTarget.append(content);
			
			result = getResultOutput(test.passed);
			this.testTarget.find('iq-testresult').replaceWith(result);
		};
		this.itemStart=function(testinfo)
		{
			var tempItem= u.tmpReplace($(tpl.itemStart),testinfo);
			this.itemTarget = tempItem;
			this.testTarget.append(tempItem);
		};
		this.itemEnd = function(response) {
			if (response.passed) {
				this.itemTarget.remove();
			} else {
				this.itemTarget.replaceWith(u.tmpReplace($(tpl.itemEnd).clone(),response));
			}
			response.written=true;
		};
		return this;
	};
	iqtest.impl.TestGroup.prototype.render = function(el) {
		this.outputTarget = el;
		u.each(this.tests,function(i,test) {
			test.render();
		});

	};
	iqtest.impl.Test.prototype.render=function() {
		var me=this;

		u.each(me.results,function(i,result) {
			if (!result.written) {
				u.event(this.group.itemEnd,this.group,result);
			}
		});


	};
	iqtest.writer =function (el) {
         var group = new iqtest.impl.TestGroup();
         group.writer(el);
         return group;
    };
    iqtest.impl.apiroot.writer=iqtest.writer;
}(iqtest));

