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
		tpl = {
			group:'<pre><h1>Starting test group "<iq-name></iq-name>": <iq-groupresult></iq-groupresult></h1>'+
				'<div><div></div></div></pre>',
			testStart: '<h2>Starting test "<iq-name></iq-name>": <iq-testresult></iq-testresult></h2><div></div>',
			testEnd: '<h3><iq-count></iq-count> tests items finished.</h3>',
			itemStart: '<span style="color: blue;font-style: italic;">Running test #<iq-count></iq-count>: '
					+'<iq-assertFuncName></iq-assertFuncName> "<iq-desc></iq-desc>"....</span><br/>',
			itemEnd: '<span><iq-fulltext></iq-fulltext></span><br/>',
			resultSuccess: '<span style="color:green"><iq-resulttext></iq-resulttext></span>',
			resultFail:'<span style="color:red"><iq-resulttext></iq-resulttext></span>',
			log: '<span style="color:purple"><iq-message></iq-message></span><br/>'
		};
	
	iqtest.templates=tpl;


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
	u.extend(iqtest.impl.TestGroup.prototype,
	{
		writer: function(el) {
			var wrap = $(el);
			wrap.empty();

			this.outputTarget = wrap;
			return this;
		},
		groupStart: function(group) {
			var groupWrapper = u.tmpReplace($(tpl.group).clone(),group);
			this.outputTarget.append(groupWrapper);
			// should be the innermost div
			this.groupWrapper = groupWrapper;
			this.target = groupWrapper.find('div:only-child:last');

		},
		groupEnd: function(group) {
			var result = getResultOutput(group.passed);
			this.groupWrapper.find('iq-groupresult').replaceWith(result);
		},
		render: function(el) {
			this.outputTarget = el;
			u.each(this.tests,function(i,test) {
				test.render();
			});

		}
	});

	u.extend(iqtest.impl.Test.prototype,
	{
		testStart: function(test) {
			
			var content= u.tmpReplace($(tpl.testStart).clone(),test);
			this.target = content.filter('div');
			this.group.target.append(content);
		},
		testEnd: function(test) {
			var result,
				content = u.tmpReplace($(tpl.testEnd).clone(),test);
			this.target.append(content);
			
			result = getResultOutput(test.passed);
			this.target.find('iq-testresult').replaceWith(result);
		},
		itemStart: function(testinfo)
		{
			var tempItem= u.tmpReplace($(tpl.itemStart),testinfo);
			this.itemTarget = tempItem;
			this.target.append(tempItem);
		},
		itemEnd: function(response) {
			// this can get called without itemStart (prob should create a different kind of event for errors but...)

			if (response.passed) {
				this.itemTarget.remove();
			} else {
				this.itemTarget.replaceWith(u.tmpReplace($(tpl.itemEnd).clone(),response));
			}
			this.itemTarget=null;
			response.written=true;
		},
		log: function(message) {
			this.target.append(u.tmpReplace($(tpl.log).clone(),{message: message}));
		},
		render: function() {
			var me=this;

			u.each(me.results,function(i,result) {
				if (!result.written) {
					u.event(this.group.itemEnd,this.group,result);
				}
			});
		}
	});


	iqtest.writer =function (el) {
         var group = new iqtest.impl.TestGroup();
         group.writer(el);
         return group;
    };
}(iqtest));

