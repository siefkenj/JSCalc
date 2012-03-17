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

test("Lexer Tests", function() {
    tokenEqual(new Token('number', '4'), knownTokens.FOUR);
    
    let tokens = tokenize('4*4');
    tokenArrayEqual(tokens, [knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
    let tokens = tokenize(' 4 *  \t4');
    tokenArrayEqual(tokens, [knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
    let tokens = tokenize(' [4 *  \t4');
    tokenArrayEqual(tokens, [knownTokens.LEFT_SQUARE_BRACKET, knownTokens.FOUR, knownTokens.TIMES, knownTokens.FOUR]);
    let tokens = tokenize('4.4');
    equal(tokens[0].value, 4.4, 'Float paring parsing')
    let tokens = tokenize('4.4e3');
    equal(tokens[0].value, 4400, 'Float paring parsing')
    let tokens = tokenize('4.4e+3');
    equal(tokens[0].value, 4400, 'Float paring parsing')
    let tokens = tokenize('4.4e-3');
    equal(tokens[0].value, 4.4e-3, 'Float paring parsing')
    let tokens = tokenize('4.4E-3');
    equal(tokens[0].value, 4.4e-3, 'Float paring parsing')
    let tokens = tokenize('4.4e3e3');
    equal(tokens[0].value, 4.4e3, 'Float paring parsing')
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
test("Parser Tests", function() {
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

module("BigNumber Tests")
test("BigNumber Tests", function() {
    equal((new BigNatural('123')).toString(), '123', 'Initialization from string');
    equal((new BigNatural(123)).toString(), '123', 'Initialization from number');
    equal((new BigNatural('12357943984829578409202939488572983894578435')).toString(), '12357943984829578409202939488572983894578435', 'Initialization from string');
    equal((new BigNatural('0')).eq(new BigNatural(0)), true, 'Comparison of zero');
    equal((new BigNatural('0')).eq(new BigNatural([0])), true, 'Comparison of zero');
    equal((new BigNatural(0)).eq(new BigNatural([0])), true, 'Comparison of zero');
    let x = new BigNatural('12357943984829578409202939488572983894578435');
    let y = new BigNatural('988989189432675462789392012938888888888881470');
    let z = new BigNatural('17');
    equal(x.add(y).toString(), '1001347133417505041198594952427461872783459905', 'Add');
    equal(y.add(x).toString(), '1001347133417505041198594952427461872783459905', 'Add');
    equal(y.sub(x).toString(), '976631245447845884380189073450315904994303035', 'Subtract');
    equal(y.mul(x).toString(), '12221873004611012186891046368657631678605694331581707602856984633007678192429484333099450', 'Multiply');
    equal(x.mul(y).toString(), '12221873004611012186891046368657631678605694331581707602856984633007678192429484333099450', 'Multiply');
    equal(y.mod(x).toString(), '353670646309190053156853853050177322606670', 'Mod');
    equal(y.mod(new BigNatural(17)).toString(), '9', 'GCD');
    let [dividand, remainder] = y.divideWithRemainder(x);
    equal(dividand.toString(), '80', 'Division')
    equal(remainder.toString(), '353670646309190053156853853050177322606670', 'Division remainder')
    let [dividand, remainder] = y.divideWithRemainder(z);
    equal(dividand.toString(), '58175834672510321340552471349346405228757733', 'Division')
    equal(remainder.toString(), '9', 'Division remainder')
});
