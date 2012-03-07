function EvaluationError(message) {
    this.message = message;
    this.name = 'EvaluationError';
}

// evaluate the ast using javascript math functions
function evaluate(ast) {
    const FUNCTIONS = { 'sin': Math.sin, 'cos': Math.cos, 'tan': Math.tan,
                        '^': Math.pow, 'exp': Math.exp, 'log': Math.log, 'abs': Math.abs,
                        'ln': Math.log, 'sqrt': Math.sqrt,
                        '+': function(a,b){ return a+b; },
                        '-': function(a,b){ return a-b; },
                        '*': function(a,b){ return a*b; },
                        '/': function(a,b){ return a/b; },
                        'negate': function(a){ return -a; },
                        '!': function(a) { ret = 1; for (let i = 1; i <= a; i++) {ret *= i;} return ret; },
                        '>': function(a,b) { return a > b; },
                        '<': function(a,b) { return a < b; },
                        '>=': function(a,b) { return a >= b; },
                        '<=': function(a,b) { return a <= b; },
                        '==': function(a,b) { return a == b; }
                        }
    const CONSTANTS = { 'pi': Math.PI, 'e': Math.E, 'phi': (1+Math.sqrt(5))/2 };

    if (ast instanceof Array) {
        return ast.map(evaluate);
    }
    if (ast instanceof Node) {
        let func = FUNCTIONS[ast.token.value];
        if (typeof func === 'undefined') {
            throw new EvaluationError("Unknown function '"+ast.token.value+"'");
        }
        return func.apply(this, evaluate(ast.children));
    }
    if (ast.constant === true) {
        return CONSTANTS[ast.value];
    }
    return ast.value;
}

// Turn the ast into conventional math notation
function evaluateString(ast) {
    const FUNCTIONS = { 'sin': function(a){ return 'sin('+a+')'; },
                        'cos': function(a){ return 'cos('+a+')'; },
                        'tan': function(a){ return 'tan('+a+')'; },
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
                        'negate': function(a){ return '-(' + a +')'; },
                        '!': function(a) { return ''+a+'!'; }
                        }
    const CONSTANTS = { 'pi': 'π', 'e': 'e', 'phi': 'φ' };

    if (ast instanceof Array) {
        return ast.map(evaluateString);
    }
    if (ast instanceof Node) {
        let func = FUNCTIONS[ast.token.value];
        if (typeof func === 'undefined') {
            console.log('error with' + ast.token.vaue)
            throw new EvaluationError("Unknown function '"+ast.token.value+"'");
        }
        return func.apply(this, evaluateString(ast.children));
    }
    if (ast.constant === true) {
        return CONSTANTS[ast.value];
    }
    return ast.value;
}
