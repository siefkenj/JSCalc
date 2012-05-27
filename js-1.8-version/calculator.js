/*
 *   Evaluator for math expressions.
 *
 *   Copyright (C) 2012  Jason Siefken
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


/*********************************************************
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
 ***********************************************************/

function EvaluationError(message) {
    this.message = message;
    this.name = 'EvaluationError';
}

// Evaluator takes in a Node tree and recursively applies 
// itself, first looking for functions in functionList and then
// falling back to defaultFunction if those are unavailable.
// When evaluating a number, numberWrapper(x) is returned.  This
// can be used to coarse types during evaluation.
function Evaluator() {
    this._init.apply(this, arguments);
}
Evaluator.prototype = {
    _init: function(constantsList, functionList, defaultFunction, numberWrapper) {
        this.constantsList = constantsList || {};
        this.functionList = functionList || {};
        this.defaultFunction = defaultFunction || function(name, args){ throw new EvaluationError('Unknown function "'+name+'"'); };
        this.numberWrapper = numberWrapper || function(x){ return x; };
    },

    evaluate: function(ast) {
        if (ast instanceof Array) {
            return ast.map(this.evaluate.bind(this));
        } else if (ast instanceof Node) {
            let func = this.functionList[ast.token.value];
            if (typeof func === 'undefined') {
                return this.defaultFunction(ast.token.value, this.evaluate(ast.children));
            } else {
                return func.apply(this, this.evaluate(ast.children));
            }
        } else if (ast.constant === true) {
            return this.constantsList[ast.value];
        }
        return this.numberWrapper(ast.value);
    },
    
    // returns a function that when called, evaluates the ast.
    makeEvaluator: function() {
        return this.evaluate.bind(this);
    }
}


/************************************************
 * Make a numerical evaluator based on javascript
 * math functions and a symbolic evaluator that
 * returns a string representation of the AST
 * ***********************************************/

let evaluateNumeric, evaluateComplexNumeric, evaluateString, evaluateRPNString;
(function() {
    let constantsList, functionList, defaultFunction, numberWrapper, evaluator;
    // Some general purpose math functions
    function sum(array) {
        if (typeof array === 'number') {
            return array;
        }
        let accum = 0;
        for (let i = 0; i < array.length; i++) {
            accum += array[i];
        }
        return accum;
    }
    function mean(array){
        if (typeof array === 'number') {
            return array;
        }
        return sum(array)/array.length;
    }
    function variance(array) {
        if (typeof array === 'number') {
            return array*array;
        }
        let ave = mean(array);
        return sum(array.map(function(a){ return (a-ave)*(a-ave); }))/array.length;
    }
    function std(array) {
        if (typeof array === 'number') {
            return array;
        }
        return Math.sqrt(variance(array));
    }
    // Extra trig functions
    function sec(x) {
        return 1/Math.cos(x);
    }
    function csc(x) {
        return 1/Math.sin(x);
    }
    function cot(x) {
        return 1/Math.tan(x);
    }
    function sinh(x) {
        return (Math.exp(x) - Math.exp(-x))/2;
    }
    function cosh(x) {
        return (Math.exp(x) + Math.exp(-x))/2;
    }
    function tanh(x) {
        return (Math.exp(x) - Math.exp(-x))/(Math.exp(x) + Math.exp(-x));
    }
    function asinh(x) {
        return Math.log(x+Math.sqrt(x*x+1));
    }
    function acosh(x) {
        return Math.log(x+Math.sqrt(x*x-1));
    }
    function atanh(x) {
        return Math.log((x+1)/(x-1))/2;
    }

    // unwraps the comma operator. This function is mean to take things like [[1,2],3] -> [1,2,3]
    function comma(a,b) {
        if (a instanceof Array) {
            return a.concat([b]);
        } else {
            return [a, b];
        }
        
    }

    //
    // An evaluator that uses javascript arithmetic to evaluate the expression
    //

    // Set up the constants and functions for evaluateNumeric
    constantsList = { 'pi': Math.PI, 'e': Math.E, 'phi': (1+Math.sqrt(5))/2 };
    functionList = {    
                    'sin': Math.sin, 'cos': Math.cos, 'tan': Math.tan,
                    'asin': Math.asin, 'acos': Math.acos, 'atan': Math.atan,
                    'arcsin': Math.asin, 'arccos': Math.acos, 'arctan': Math.atan,
                    'atan2': function(l){ return Math.atan2(l[0],l[1]); },
                    'sec': sec, 'csc': csc, 'cot': cot,
                    'sinh': sinh, 'cosh': cosh, 'tanh': tanh,
                    'asinh': asinh, 'acosh': acosh, 'atanh': atanh,
                    'arcsinh': asinh, 'arccosh': acosh, 'arctanh': atanh,
                    'deg': function(x) { return Math.PI*x/180; },
                    '^': Math.pow, 'exp': Math.exp, 
                    'ln': Math.log, 
                    'lg': function(a) { return Math.log(a)/Math.log(2); }, 
                    'log': function(a) { return Math.log(a)/Math.log(10); }, 
                    'abs': Math.abs,
                    'sqrt': Math.sqrt,
                    'ceil': Math.ceil,
                    'floor': Math.floor,
                    '+': function(a,b){ return a+b; },
                    '-': function(a,b){ return a-b; },
                    '*': function(a,b){ return a*b; },
                    '/': function(a,b){ return a/b; },
                    '%': function(a,b){ return (a%b + b)%b; },
                    'mod': function(a,b){ return (a%b + b)%b; },
                    'negate': function(a){ return -a; },
                    '!': function(a) { if (a > 170) {return Infinity;} ret = 1; for (let i = 1; i <= a; i++) {ret *= i;} return ret; },
                    '>': function(a,b) { return a > b; },
                    '<': function(a,b) { return a < b; },
                    '>=': function(a,b) { return a >= b; },
                    '<=': function(a,b) { return a <= b; },
                    '==': function(a,b) { return a == b; },
                    ',': comma,
                    'mean': mean,
                    'ave': mean,
                    'var': variance,
                    'variance': variance,
                    'std': std
                   };
    evaluator = new Evaluator(constantsList, functionList);
    evaluateNumeric = evaluator.makeEvaluator();    //evaluateNumeric is brought in by closure
    
    //
    // An evaluator that uses the Complex type and javascript builtin arithmetic
    // to evaluate expressions allowing for a complex result.
    //

    // Set up the constants and functions for evaluateNumeric
    constantsList = { 'pi': new Complex(Math.PI, 0), 
                      'e': new Complex(Math.E, 0), 
                      'phi': new Complex((1+Math.sqrt(5))/2, 0), 
                      'i': new Complex(0, 1), 
                      'I': new Complex(0, 1) };
    functionList = {
                    're': ComplexMath.re, 'real': ComplexMath.re,
                    'im': ComplexMath.im, 'imag': ComplexMath.im,
                    'arg': ComplexMath.arg, 'Arg': ComplexMath.arg,
                    'sin': ComplexMath.sin, 'cos': ComplexMath.cos, 'tan': ComplexMath.tan,
                    'asin': ComplexMath.asin, 'acos': ComplexMath.acos, 'atan': ComplexMath.atan,
                    'arcsin': ComplexMath.asin, 'arccos': ComplexMath.acos, 'arctan': ComplexMath.atan,
                    'atan2': ComplexMath.atan2,
                    'sec': ComplexMath.sec, 'csc': ComplexMath.csc, 'cot': ComplexMath.cot,
                    'sinh': ComplexMath.sinh, 'cosh': ComplexMath.cosh, 'tanh': ComplexMath.tanh,
                    'asinh': ComplexMath.asinh, 'acosh': ComplexMath.acosh, 'atanh': ComplexMath.atanh,
                    'arcsinh': ComplexMath.asinh, 'arccosh': ComplexMath.acosh, 'arctanh': ComplexMath.atanh,
                    'deg': function(x) { return x.mul(new Complex(Math.PI/180, 0)); },
                    '^': ComplexMath.pow, 'exp': ComplexMath.exp, 
                    'ln': ComplexMath.log, 
                    'log': ComplexMath.log, 
                    'abs': ComplexMath.norm,
                    'sqrt': ComplexMath.sqrt,
                    'ceil': ComplexMath.ceil,
                    'floor': ComplexMath.floor,
                    'round': ComplexMath.round,
                    '+': ComplexMath.add,
                    '-': ComplexMath.sub,
                    '*': ComplexMath.mul,
                    '/': ComplexMath.div,
                    '//': function(a,b){ return ComplexMath.floor(ComplexMath.div(a,b)); },
                    'negate': ComplexMath.negate,
                    '%': ComplexMath.mod,
                    'mod': ComplexMath.mod,
                    '!': ComplexMath.factorial,
                    '==': ComplexMath.equal,
                    '>': ComplexMath.gt, '<': ComplexMath.lt, '<=': ComplexMath.lte, '>=': ComplexMath.gte,
                    ',': comma,
//                    'mean': mean,
//                    'ave': mean,
//                    'var': variance,
//                    'variance': variance,
//                    'std': std
                   };
    numberWrapper = function(x){ return new Complex(x, 0); };
    evaluator = new Evaluator(constantsList, functionList, null, numberWrapper);
    evaluateComplexNumeric = evaluator.makeEvaluator();    //evaluateNumeric is brought in by closure

    //
    // An evaluator that returns a string representation of the math expression
    //

    // Should be { 'pi': 'π', 'e': 'e', 'phi': 'φ' } but javascript has unicode problems
    constantsList = { 'pi': '\u03C0', 'e': 'e', 'phi': '\u03C6', 'i': 'i', 'I': 'i' };
    functionList = {
                    'sin': function(a){ return 'sin('+a+')'; },
                    'cos': function(a){ return 'cos('+a+')'; },
                    'tan': function(a){ return 'tan('+a+')'; },
                    'atan2': function(l){ return 'atan2(' + l +')'; },
                    // Again with the unicode issues '\u00B0' == '°'
                    'deg': function(a) { return a + '\u00B0'; },
                    'exp': function(a){ return 'exp('+a+')'; },
                    'sqrt': function(a){ return 'sqrt('+a+')'; },
                    'log': function(a){ return 'log('+a+')'; },
                    'ln': function(a){ return 'ln('+a+')'; },
                    '^': function(a,b){ return '('+a+'^'+b+')'; },
                    'abs': function(a){ return '|'+a+'|'; },
                    '+': function(a,b){ return '('+a+'+'+b+')'; },
                    '-': function(a,b){ return '('+a+'-'+b+')'; },
                    '*': function(a,b){ return '('+a+'*'+b+')'; },
                    '/': function(a,b){ return '('+a+'/'+b+')'; },
                    '//': function(a,b){ return '('+a+'//'+b+')'; },
                    'negate': function(a){ return '-(' + a +')'; },
                    '!': function(a) { return ''+a+'!'; },
                    ',': comma,
                    '%': function(a,b){ return '('+a+' mod '+b+')'; },
                   };
    defaultFunction = function(name, args) { return name + '(' + args + ')'; };

    evaluator = new Evaluator(constantsList, functionList, defaultFunction);
    evaluateString = evaluator.makeEvaluator();
    

    //
    // Evaluator that outputs the RPN form of the expression
    //

    constantsList = { 'pi': '\u03C0', 'e': 'e', 'phi': '\u03C6' };
    functionList = {
                    'deg': function(a) { return a + '\u00B0'; }
                   };
    defaultFunction = function(name, args) {
        return args.join(' ') + ' ' + name;
    }
    evaluator = new Evaluator(constantsList, functionList, defaultFunction);
    evaluateRPNString = evaluator.makeEvaluator();
})();
