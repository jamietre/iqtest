var x={
    inputroot: "../",
    outputroot: "../dist",
    groups: [
    {
        input: "redist/when.js,redist/timeout.js,redist/buster-core.js,redist/buster-eventEmitter.js,redist/buster-assertions.js,iqtest.js,iqtest.assertions.js",
        output:
        {
            action: "combine",
            target: "iqtest-all.js"
        }
    },
    {
        input: "redist/when.js,redist/timeout.js,redist/buster-core.js,redist/buster-eventEmitter.js,redist/buster-assertions.js,iqtest.js,iqtest.assertions.js,iqtest-browser-harness.js",
        output:
        {
            action: "combine",
            target: "iqtest-browser-default.js"
        }
    
    }
    ]
}