rem copy src files first
sharpbatcher -v -c iqtest.build
sharplinter -ph best *.min.js -f "..\dist\iqtest.js"
sharplinter -ph best *.min.js -f "..\dist\iqtest-default.js"
pause