function zip(a, b) {
    let ret = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        ret.push([a[i],b[i]]);
    }
    return ret;
}

$(document).ready(function() {

module("Lexer Tests", {
    setup: function() {
        tokenEqual = function(a, b, message) {
            equal(a.type, b.type, message);
            equal(a.value, b.value, message);
        }

        tokenArrayEqual = function(a, b, message) {
            zip(a,b).forEach(function(elm) {
                tokenEqual(elm[0],elm[1], message);
            });
        }

        knownTokens = {
            FOUR: new Token('number', '4'),
            TIMES: new Token('operator', '*'),
            LEFT_SQUARE_BRACKET: new Token('bracket', '['),
            SINE: new Token('identifier', 'sin')
        }

        tokenize = function(source) {
            let lexer = new Lexer(source);
            let token, tokens = [];
            while (token = lexer.get()) {
                tokens.push(token);
            }
            return tokens;
        }
    }
});

test("Parsing", function() {
    tokenEqual(new Token('number', '4'), knownTokens.FOUR);
    
    let tokens = tokenize('4*4');
    tokenArrayEqual(tokens, [knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
    let tokens = tokenize(' 4 *  \t4');
    tokenArrayEqual(tokens, [knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
    let tokens = tokenize(' [4 *  \t4');
    tokenArrayEqual(tokens, [knownTokens.LEFT_SQUARE_BRACKET, knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
});


module("Parser Tests", {
    setup: function() {
        tokenEqual = function(a, b, message) {
            equal(a.type, b.type, message);
            equal(a.value, b.value, message);
        };

        tokenArrayEqual = function(a, b, message) {
            zip(a,b).forEach(function(elm) {
                tokenEqual(elm[0],elm[1], message);
            });
        };

        astEqual = function(a, b, message) {
            if (a instanceof Array && b instanceof Array) {
                equal(a.length, b.length, message)
                zip(a,b).forEach(function(elm) {
                    astEqual(elm[0], elm[1], message);
                });
            } else if (a instanceof Node && b instanceof Node) {
                if (!(a.type === 'NOCHECK' || b.type === 'NOCHECK')) {
                    equal(a.type, b.type, message);
                }
                tokenEqual(a.token, b.token, message);
                astEqual(a.children, b.children, message);
            } else if (a instanceof Token && b instanceof Token) {
                tokenEqual(a, b, message);
            } else {
                throw {name: 'ComparisonError', message: 'Comparison of ' + a + ' and ' + b + ' Failed'};
            }
        };

        knownTokens = {
            FOUR: new Token('number', '4'),
            TIMES: new Token('operator', '*'),
            LEFT_SQUARE_BRACKET: new Token('bracket', '['),
            SINE: new Token('identifier', 'sin')
        };

        // Helper function so that ASTs aren't so hard to type!
        // ['+', 4, ['-', 2, 3]] will create the corresponding tree structure out of
        // Node elements
        listToAST = function(list) {
            if (list instanceof Array) {
                let token = new Token('NOCHECK', list[0]);
                return new Node(token.value, token, list.slice(1).map(listToAST));
            } else {
                let token = new Token('NOCHECK', list);
                if (typeof list === 'number') {
                    token = new Token('number', list);
                }
                return token;
            }
        }

        astToList = function(ast) {
            if (ast instanceof Node) {
                let ret = [];
                ret.push(ast.token.value);
                ret = ret.concat(astToList(ast.children));
                return ret;
            } else if (ast instanceof Array) {
                return ast.map(astToList);
            } else if (ast instanceof Token) {
                return ast.value;
            }
            
            throw {name: 'ConstructionError', message: 'Error constructing list from AST ' + ast};
        }

        parse = function(string) {
            let parser = new Parser(string);
            return parser.parse()[0];
        }
    }
});
test("Sample test", function() {
    astEqual(new Node(knownTokens.FOUR.value, knownTokens.FOUR, []), 
             new Node(knownTokens.FOUR.value, knownTokens.FOUR, []));
    astEqual(listToAST(['+', ['*', 3, 3] ,4]), listToAST(['+', ['*', 3, 3] ,4]), 'Test astEqual test function');
    deepEqual(astToList(parse('3*3+4')), ['+', ['*', 3, 3] ,4]);
    deepEqual(astToList(parse('3+3*4')), ['+', 3, ['*', 3, 4]]);
    deepEqual(astToList(parse('(3+3)*4')), ['*', ['+', 3, 3], 4]);
    deepEqual(astToList(parse('-3-4')), ['-', ['negate', 3], 4]);
    deepEqual(astToList(parse('-3^2')), ['negate', ['^', 3, 2]]);
    deepEqual(astToList(parse('3*3!')), ['*', 3, ['!', 3]]);
    deepEqual(astToList(parse('5!!')), ['!', ['!', 5]]);
    deepEqual(astToList(parse('3^4^5')), ['^', 3, ['^', 4, 5]]);
    deepEqual(astToList(parse('7*3^4^(5 + 2)')), ['*', 7, ['^', 3, ['^', 4, ['+', 5, 2]]]]);
    deepEqual(astToList(parse('sin 2')), ['sin', 2]);
    deepEqual(astToList(parse('sin(2)')), ['sin', 2]);
    deepEqual(astToList(parse('4pi')), ['*', 4, 'pi'], 'implicit multiplication');
    deepEqual(astToList(parse('4 pi/5')), ['/', ['*', 4, 'pi'], 5], 'implicit multiplication');
});

});
