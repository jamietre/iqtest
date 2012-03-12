
### Summary

iqtest: A promise-aware testing framework for Javascript

3/12/2012: version 0.1

The framework itself does not require anything other than when.js and timeout.js from https://github.com/cujojs/when

The example uses a test harness for web browsers that requires jquery. You can run this without jQuery and create your own analysis tool for its output.

Source repository: https://github.com/jamietre/iqtest

### Overview

This is all so new, but here's an example.

An example

	iqtest
		.writer($('#output'))
		.test("Test 1",function(a) {
		
			a.areEqual(0,glob,"global value is 0")
				.isTrue(false,"Should fail")
				.then(function() {
					a.areEqual(3,3,"Should fail 3=3");
				}); 
		
			a.areEqual(2,wait(2),"Waited 2 secs")
				.isTrue(waitcb(3,a.callback()),"Waited 3 secs");
		
			var cb = callback(function() {
				return 123;
			});
			a.areEqual(124,waitcb(3,cb),"Hoping to get 123");
		
			
			a.areEqual(124,promise(function(cb) {
		    		$('#sample').hide('slow',cb);
		    	}, function(response) {
		   			return "xxx";
		    	}),"Hoping to get 'xxx'")
		
			.then(function() {
				a.isFalse(y,"y is false");
				a.areEqual(10,glob,"global got set by wait");	
				y=true;
			}).then(function()
			{
				a.areEqual(true,y,"y is now true");
		
			});
		
			a.areEqual(1,1,"Numbers are equal");
			// then try a callback
		})


*Overview*


----
## Usage

**mapster**: Bind to all selected images.

    $('img').mapster(options);

**select**: Cause an area to become "selected"

    $('area').mapster('select');

Programatically select elements from the image map. The programmatic selection/deselection methods will not honor the staticState property.

**deselect**: Cause an area to become "selected"

    $('area').mapster('deselect');

**set**: select or deselect an element. If `selected` is true, the area is selected, if false, it is deselected.

    $('area').mapster('set',selected);

You can also select or deselect areas using a their `mapKey`. This is an attribute on each area in your HTML that identifies it. You define a mapKey using a configuration option: `mapKey: 'data-key'`.

    $('img').mapster('set',true,'key1,key2');

If two areas share the same value for the `mapKey` they will be automatically grouped together when activated. You can also use the values of the mapKey to select areas from code.

MapKeys can contain more than one value. The first value always defines groups when you mouse over. Other values can be used to create logical groups. For example:

    <img id="usamap" src="map.jpeg" usemap="#usa">
    <map name="usa">
		<area data-key="maine,new-england,really-cold" shape="poly" coords="...">
		<area data-key="new-hampshire,new-england,really-cold" shape="poly" coords="...">
		<area data-key="vermont,new-england,really-cold" shape="poly" coords="...">
		<area data-key="connecticut,new-england" shape="poly" coords="...">
		<area data-key="rhode-island,new-england" shape="poly" coords="...">
		<area data-key="massachusetts,new-england" shape="poly" coords="...">
		<!-- more states... -->
    </map>

    $('#usamap').mapster( { mapKey: 'data-key' } );

Mousing over each state would cause just that state to be higlighted. You can also select other logical groups from code code:

    // select all New England states
    $('img').mapster('set',true,'new-england');

    // select just Maine, New Hampshire & Vermont
    $('img').mapster('set',true,'really-cold');

Groups created this way are *independent* of the primary group. If you select "new-england" from code, you can't unselect just "MA" by clicking on it. You would have to unselect "new-england" from code. 

To simply indentify a set of areas to turn on or off, but not treat them as a logical group, you can use CSS classes and select areas directly, or use the <code>keys</code> option to identify the primary keys associated with a group (see documentation).


----
## Options

Please see github repository for complete documentation.

## Zepto Compatibility

Yes, but you need to use the "jquery.imagemapster.zepto.js" build. This patches a few holes in Zepto that ImageMapster needs. It is safe to use the zepto version with jQuery.

## Build instructions

The source code is broken into several modules to make management easier and to make it possible to create feature-targeted builds. A rakefile is included that creates and minifies the two release builds (with and without Zepto support):

`rake`

## Markdown

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
