JSCalc is a javascript-based mathematical parser and calculator. 
It allows one to type math naturally and have it do the right thing.

To start using JSCalc, open `calc.html` in a web browser.


Features
--------

 * Implicit multiplication: '4pi' is recognized as '4*pi'
 * Prefix, infix, and suffix operations: 'sin(4)', '4^4', '4!'
 * Bracket agnostic: use '()', '{}', or '[]' to group expressions.  They can be mixed aswell!
 * Order of operations respected (If they weren't, it'd be a pretty bad calculator)
 * RPN parsing (with `Parse.parseRPN`)
 * Scientific notation number input (e.g., '1.23e-10')
 * Complex arithmetic using `evaluateComplexNumeric`
 * Input hexadecimal (0x000), octal (0o000), and binary (0b000) numbers


Requirements
------------

The pre-compiled version should work in any modern browser.
To compile the coffee source you will need coffeescript installed
(available as a Node.js package)

To compile, run

	coffee -c --bare lexer.coffee
	coffee -c --bare parser.coffee
	coffee -c --bare calculator.coffee
	coffee -c --bare bignum.coffee

For development (to have coffeescript automatically 
recompile changes when a file is modified), run
	
	coffee -c --watch --bare lexer.coffee &
	coffee -c --watch --bare parser.coffee &
	coffee -c --watch --bare calculator.coffee &
	coffee -c --watch --bare bignum.coffee &


License
-------

GPL 3
