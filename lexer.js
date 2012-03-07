
const TOKENS = { operators: { '+': true, '-': true, '*': true, '/': true, '^': true, '=': true, '!': true, '==': true, '<': true, '<=': true, '>': true, '>=': true, '!=': true },
                 brackets: { '(': true, ')': true, '[': true, ']': true, '{': true, '}': true } };

// A few helper functions
function isWhiteSpace(ch) {
    return (ch === '\u0009') || (ch === ' ') || (ch === '\u00A0');
}
 
function isLetter(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}
 
function isDecimalDigit(ch) {
    return (ch >= '0') && (ch <= '9');
}


// Accepts a string, an array of strings, or an object and tells whether
// source starts with that string or a key in the object
function startsWith(source, substr) {
    if (Array.isArray(substr)) {
        for (let i = 0; i < substr.length; i++) {
            if (substr[i] === source.slice(0, substr[i].length)) {
                return substr[i];
            }
        }
    } else if (typeof substr === 'object') {
        let maxLen = 0;
        for (let k in substr) {
            maxLen = Math.max(maxLen, k.length);
        }
        // We want to match the longest token that starts with the same thing as source
        for (let l = maxLen; l > 0; l--) {
            if (source.slice(0, l) in substr) {
                return source.slice(0, l);
            }
        }
    } else {
        if (substr === source.slice(0, substr.length)) {
            return substr;
        }
    }
    return false;
}

function Token() {
    this._init.apply(this, arguments);
}

Token.prototype = {
    _init: function(type, value, position) {
        this.type = type;
        this.value = value;
        if (this.type === 'number') {
            this.value = parseFloat(value);
        }
        this.position = position;
    },

    toString: function() {
        //return '<'+this.type+' "'+this.value+'" at '+this.position+'>';
        return '\''+this.value+'\'';
    }
};

function Lexer() {
    this._init.apply(this, arguments);
}

Lexer.prototype = {
    _init: function(source) {
        this.source = source;
        this.index = 0;
    },

    // returns the token at the position pos or, if
    // pos == null, returns the token at this.index and
    // advances this.index
    get: function() {
        // get the first non-whitespace token at the current index
        this.eatWhitespace();
        let tokenString, token = null;
        if (tokenString = this.getOperator()) {
            token = new Token('operator', tokenString, this.index);
        } else if (tokenString = this.getBracket()) {
            token = new Token('bracket', tokenString, this.index);
        } else if (tokenString = this.getNumber()) {
            token = new Token('number', tokenString, this.index);
        } else if (tokenString = this.getIdentifier()) {
            token = new Token('identifier', tokenString, this.index);
        }
        
        if (token) {
            this.index += tokenString.length;
        }

        return token;

    },

    // returns the operator in source at position pos
    getOperator: function(pos, source) {
        pos = pos || this.index || 0;
        source = source || this.source;

        return startsWith(source.slice(pos), TOKENS.operators) || null;
    },

    getBracket: function(pos, source) {
        pos = pos || this.index || 0;
        source = source || this.source;

        return startsWith(source.slice(pos), TOKENS.brackets) || null;
    },

    getNumber: function(pos, source) {
        let currPos = pos || this.index || 0;
        let currSource = source || this.source;
        
        let start = currPos;
        let c = currSource.charAt(currPos);
        while (isDecimalDigit(c) || c === '.') {
            currPos++;
            c = currSource.charAt(currPos);
        }

        return currSource.slice(start, currPos) || null;
    },
    
    getIdentifier: function(pos, source) {
        let currPos = pos || this.index || 0;
        let currSource = source || this.source;
        
        let start = currPos;
        let c;
        while (isLetter(currSource.charAt(currPos))) {
            currPos++;
        }

        return currSource.slice(start, currPos) || null;
    },

    findMatchingBracketPos: function(pos, source) {
        pos = pos || this.index || 0;
        source = source || this.source;
        
        let bracket = source.charAt(pos);
        let closingBracket = { '(': ')', '[': ']', '{': '}' }[bracket];
        
        function findClosing(offset, expr) {
            if (offset >= expr.length) {
                return null;
            }
            if (expr.charAt(offset) === closingBracket) {
                return offset;
            }
            if (expr.charAt(offset) === bracket) {
                return findClosing(findClosing(offset + 1, expr) + 1, expr);
            }
            return findClosing(offset + 1, expr);
        }

        return findClosing(pos + 1, source);
    },

    eatWhitespace: function(pos, source) {
        let currPos = pos || this.index || 0;
        let currSource = source || this.source;

        while (isWhiteSpace(currSource.charAt(currPos))) {
            currPos++;
        }
        
        // If we gave no arguments, we expect to change the internal state
        if (pos == null && source == null) {
            this.index = currPos;
        }
        
        return currPos;
    }
};
