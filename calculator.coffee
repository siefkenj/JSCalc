###
    Evaluator for math expressions
 
    Copyright (C) 2012  Jason Siefken
 
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
 
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
 
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
###

### *********************************************************
 * This is where new evaluators are created.  Evaluators
 * take in an abstract syntax tree (made of Node objects)
 * and returns some 'evaluated' expression.  The evaluated
 * expression could be a number or a string representation
 * of the AST or anything.  To create an evaluator, create
 * an object constantsList and functionList.  constantsList
 * is used to directly substitute constant expressions for 
 * their values.  functionList is called back to every time
 * an operator is encountered while recursively evaluating
 * the AST.
 *************************************************************
###


EvaluationError = (message) ->
    @message = message
    @name = "EvaluationError"



# Evaluator takes in a Node tree and recursively applies
# itself, first looking for functions in functionList and then
# falling back to defaultFunction if those are unavailable.
# When evaluating a number, numberWrapper(x) is returned.  This
# can be used to coarse types during evaluation.
class Evaluator
    constructor: (constantsList, functionList, defaultFunction, numberWrapper) ->
        @constantsList = constantsList or {}
        @functionList = functionList or {}
        @defaultFunction = defaultFunction or (name, args) ->
            throw new EvaluationError("Unknown function \"" + name + "\"")

        @numberWrapper = numberWrapper or (x) ->
            x

    evaluate: (ast) ->
        if ast instanceof Array
            return ast.map(@evaluate.bind(this))
        else if ast instanceof Node
            func = @functionList[ast.token.value]
            if typeof func is "undefined"
                return @defaultFunction(ast.token.value, @evaluate(ast.children))
            else
                return func.apply(this, @evaluate(ast.children))
        else return @constantsList[ast.value]    if ast.constant is true
        @numberWrapper ast.value

    # returns a function that when called, evaluates the ast.
    makeEvaluator: ->
        @evaluate.bind this


###
 * Make a numerical evaluator based on javascript
 * math functions and a symbolic evaluator that
 * returns a string representation of the AST
###
evaluateNumeric = undefined
evaluateComplexNumeric = undefined
evaluateString = undefined
evaluateRPNString = undefined
(->
    constantsList = undefined
    functionList = undefined
    defaultFunction = undefined
    numberWrapper = undefined
    evaluator = undefined

    # Some general purpose math functions
    sum = (array) ->
        return array if typeof array is "number"
        accum = 0
        i = 0

        while i < array.length
            accum += array[i]
            i++
        accum
    mean = (array) ->
        return array if typeof array is "number"
        sum(array) / array.length
    variance = (array) ->
        return array * array if typeof array is "number"
        ave = mean(array)
        sum(array.map((a) ->
            (a - ave) * (a - ave)
        )) / array.length
    std = (array) ->
        return array if typeof array is "number"
        Math.sqrt variance(array)
    # Extra trig functions
    sec = (x) ->
        1 / Math.cos(x)
    csc = (x) ->
        1 / Math.sin(x)
    cot = (x) ->
        1 / Math.tan(x)
    sinh = (x) ->
        (Math.exp(x) - Math.exp(-x)) / 2
    cosh = (x) ->
        (Math.exp(x) + Math.exp(-x)) / 2
    tanh = (x) ->
        (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x))
    asinh = (x) ->
        Math.log x + Math.sqrt(x * x + 1)
    acosh = (x) ->
        Math.log x + Math.sqrt(x * x - 1)
    atanh = (x) ->
        Math.log((x + 1) / (x - 1)) / 2
    # unwraps the comma operator. This function is mean to take things like [[1,2],3] -> [1,2,3]
    comma = (a, b) ->
        if a instanceof Array
            a.concat [ b ]
        else
            [ a, b ]

    ###
    # An evaluator that uses javascript arithmetic to evaluate the expression
    ###

    # Set up the constants and functions for evaluateNumeric
    constantsList =
        pi: Math.PI
        e: Math.E
        phi: (1 + Math.sqrt(5)) / 2

    functionList =
        sin: Math.sin
        cos: Math.cos
        tan: Math.tan
        asin: Math.asin
        acos: Math.acos
        atan: Math.atan
        arcsin: Math.asin
        arccos: Math.acos
        arctan: Math.atan
        atan2: (l) ->
            Math.atan2 l[0], l[1]

        sec: sec
        csc: csc
        cot: cot
        sinh: sinh
        cosh: cosh
        tanh: tanh
        asinh: asinh
        acosh: acosh
        atanh: atanh
        arcsinh: asinh
        arccosh: acosh
        arctanh: atanh
        deg: (x) ->
            Math.PI * x / 180

        "^": Math.pow
        exp: Math.exp
        ln: Math.log
        lg: (a) ->
            Math.log(a) / Math.log(2)

        log: (a) ->
            Math.log(a) / Math.log(10)

        abs: Math.abs
        sqrt: Math.sqrt
        ceil: Math.ceil
        floor: Math.floor
        "+": (a, b) ->
            a + b

        "-": (a, b) ->
            a - b

        "*": (a, b) ->
            a * b

        "/": (a, b) ->
            a / b

        "%": (a, b) ->
            (a % b + b) % b

        mod: (a, b) ->
            (a % b + b) % b

        negate: (a) ->
            -a

        "!": (a) ->
            return Infinity    if a > 170
            ret = 1
            i = 1

            while i <= a
                ret *= i
                i++
            ret

        ">": (a, b) ->
            a > b

        "<": (a, b) ->
            a < b

        ">=": (a, b) ->
            a >= b

        "<=": (a, b) ->
            a <= b

        "==": (a, b) ->
            a is b

        ",": comma
        mean: mean
        ave: mean
        var: variance
        variance: variance
        std: std

    evaluator = new Evaluator(constantsList, functionList)
    evaluateNumeric = evaluator.makeEvaluator()

    ###
    # An evaluator that uses the Complex type and javascript builtin arithmetic
    # to evaluate expressions allowing for a complex result.
    ###

    # Set up the constants and functions for evaluateNumeric
    constantsList =
        pi: new Complex(Math.PI, 0)
        e: new Complex(Math.E, 0)
        phi: new Complex((1 + Math.sqrt(5)) / 2, 0)
        i: new Complex(0, 1)
        I: new Complex(0, 1)

    functionList =
        re: ComplexMath.re
        real: ComplexMath.re
        im: ComplexMath.im
        imag: ComplexMath.im
        arg: ComplexMath.arg
        Arg: ComplexMath.arg
        sin: ComplexMath.sin
        cos: ComplexMath.cos
        tan: ComplexMath.tan
        asin: ComplexMath.asin
        acos: ComplexMath.acos
        atan: ComplexMath.atan
        arcsin: ComplexMath.asin
        arccos: ComplexMath.acos
        arctan: ComplexMath.atan
        atan2: ComplexMath.atan2
        sec: ComplexMath.sec
        csc: ComplexMath.csc
        cot: ComplexMath.cot
        sinh: ComplexMath.sinh
        cosh: ComplexMath.cosh
        tanh: ComplexMath.tanh
        asinh: ComplexMath.asinh
        acosh: ComplexMath.acosh
        atanh: ComplexMath.atanh
        arcsinh: ComplexMath.asinh
        arccosh: ComplexMath.acosh
        arctanh: ComplexMath.atanh
        deg: (x) ->
            x.mul new Complex(Math.PI / 180, 0)

        "^": ComplexMath.pow
        exp: ComplexMath.exp
        ln: ComplexMath.log
        log: ComplexMath.log
        abs: ComplexMath.norm
        sqrt: ComplexMath.sqrt
        ceil: ComplexMath.ceil
        floor: ComplexMath.floor
        round: ComplexMath.round
        "+": ComplexMath.add
        "-": ComplexMath.sub
        "*": ComplexMath.mul
        "/": ComplexMath.div
        "//": (a, b) ->
            ComplexMath.floor ComplexMath.div(a, b)

        negate: ComplexMath.negate
        "%": ComplexMath.mod
        mod: ComplexMath.mod
        "!": ComplexMath.factorial
        "==": ComplexMath.equal
        ">": ComplexMath.gt
        "<": ComplexMath.lt
        "<=": ComplexMath.lte
        ">=": ComplexMath.gte
        ",": comma

    numberWrapper = (x) ->
        new Complex(x, 0)

    evaluator = new Evaluator(constantsList, functionList, null, numberWrapper)
    evaluateComplexNumeric = evaluator.makeEvaluator()

    ###
    # An evaluator that returns a string representation of the math expression
    ###

    # Should be { 'pi': 'π', 'e': 'e', 'phi': 'φ' } but javascript has unicode problems
    constantsList =
        pi: "\u03C0"
        e: "e"
        phi: "\u03C6"
        i: "i"
        I: "i"

    functionList =
        sin: (a) ->
            "sin(" + a + ")"

        cos: (a) ->
            "cos(" + a + ")"

        tan: (a) ->
            "tan(" + a + ")"

        atan2: (l) ->
            "atan2(" + l + ")"
        # Again with the unicode issues '\u00B0' == '°'
        deg: (a) ->
            a + "\u00B0"

        exp: (a) ->
            "exp(" + a + ")"

        sqrt: (a) ->
            "sqrt(" + a + ")"

        log: (a) ->
            "log(" + a + ")"

        ln: (a) ->
            "ln(" + a + ")"

        "^": (a, b) ->
            "(" + a + "^" + b + ")"

        abs: (a) ->
            "|" + a + "|"

        "+": (a, b) ->
            "(" + a + "+" + b + ")"

        "-": (a, b) ->
            "(" + a + "-" + b + ")"

        "*": (a, b) ->
            "(" + a + "*" + b + ")"

        "/": (a, b) ->
            "(" + a + "/" + b + ")"

        "//": (a, b) ->
            "(" + a + "//" + b + ")"

        negate: (a) ->
            "-(" + a + ")"

        "!": (a) ->
            "" + a + "!"

        ",": comma
        "%": (a, b) ->
            "(" + a + " mod " + b + ")"

    defaultFunction = (name, args) ->
        name + "(" + args + ")"

    evaluator = new Evaluator(constantsList, functionList, defaultFunction)
    evaluateString = evaluator.makeEvaluator()
    
    ###
    # An evaluator that returns the RPN form of the expression
    ###

    # Should be { 'pi': 'π', 'e': 'e', 'phi': 'φ' } but javascript has unicode problems
    constantsList =
        pi: "\u03C0"
        e: "e"
        phi: "\u03C6"
        i: "i"
        I: "i"

    functionList = deg: (a) ->
        a + "\u00B0"

    defaultFunction = (name, args) ->
        args.join(" ") + " " + name

    evaluator = new Evaluator(constantsList, functionList, defaultFunction)
    evaluateRPNString = evaluator.makeEvaluator()
)()
