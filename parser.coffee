###
   Parser for math expressions

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

# This is a list of all operators and their precidence.  If an
# operator does not show up on this list, it is assumed to be a prefix
# operator with precidence prefix['default'].
OPERATORS =
    infix:
        "+": 1
        "-": 1
        "*": 2
        "/": 2
        "//": 2
        "^": 4
        "%": 1
        "=": 0
        "==": 0
        "<": 0
        "<=": 0
        ">": 0
        ">=": 0
        "!=": 0
        ",": -1 # a comma expression should always be enclosed in brackets, so commas are safe having the lowest precidencce level
        default: 1

    prefix:
        "-": 2
        negate: 2
        default: 5

    suffix:
        "!": 3
        deg: 3
        default: 2

    rightAssociative:
        "^": true
        "=": true

CONSTANTS =
    pi: true
    e: true
    phi: true
    i: true
    I: true


deepcopy = (array) ->
    return array.map(deepcopy) if array instanceof Array
    array

# returns the precedence of the token op
getPrecidence = (op) ->
    opType = (if typeof op.opType is "undefined" then "infix" else op.opType)
    (if (op.value of OPERATORS[opType]) then OPERATORS[opType][op.value] else OPERATORS[opType]["default"])

# compares the precedence of two operators, taking into account associativity
greaterPrecidence = (op1, op2) ->
    return false    unless op1?
    return true    unless op2?
    # If we made it this far, we are infix.  If we are left associative, we should 
    # be > to have greater precedence.  If we are right associative, we should be >=
    unless OPERATORS.rightAssociative[op1.value] and OPERATORS.rightAssociative[op2.value]
        getPrecidence(op1) > getPrecidence(op2)
    else
        getPrecidence(op1) >= getPrecidence(op2)

# Basic node type for representing an AST
class Node
    constructor: (type, token, children) ->
        @type = type
        @token = token
        @children = children or []
    toString: ->
        prettyList = @children.map((item) ->
            return "" + item.value    if item.type is "number"
            "" + item
        )
        @token.value + "[ " + prettyList.join(",") + " ]"

# Main parser object. This is what you want to hand your math string
# off to.
class Parser
    constructor: (source) ->
        @source = source
        @tokens = []

    # Returns a list of tokens.  All identifier tokens are
    # turned into either operators or numbers depending on whether
    # they are in the CONSTANTS object.
    tokenize: (source) ->
        source = source or @source or ""
        lexer = new Lexer(source)
        token = undefined
        tokens = []
        while token = lexer.get()
            # A string identifier is assumed to either be a numerical constant
            # or a prefix function
            if token.type is "identifier"
                if token.value of CONSTANTS
                    token.type = "number"
                    token.constant = true
                else
                    token.type = "operator"
                    token.opType = "prefix"
            tokens.push token
        tokens

    # Computes an AST from RPN source. All infix operators are assume
    # to be binary and all other operators are assumed to be unary.
    # An explicit list of the arity of each operator could be kept,
    # but it seems that atan2 would be the only exception. . ..
    parseRPN: (source) ->
        tokens = @tokenize(source)
        argumentList = []
        while tokens.length > 0
            token = tokens.shift()
            if token.type is "operator"
                children = undefined
                node = undefined
                # Decide if the operator is binary or unary
                if token.value of OPERATORS.infix
                    # Binary, so peel off the last two argument
                    children = argumentList.splice(-2, 2)
                else
                    children = argumentList.splice(-1, 1)
                node = new Node("operator", token, children)
                argumentList.push node
            else
                argumentList.push token
        argumentList

    # Returns an AST made by parsing source (or this.source if source is undefined)
    parse: (source) ->
        tokens = @tokenize(source)
        # Match up all sets of parenthesis first
        tokens = @computeBracketTree(tokens)
        # We allow implicit multiplication, like '4pi'=='4*pi'.
        tokens = @insertImplicitMultiplication(tokens)
        # Parsing suffixes would require us to walk up the AST as we create it, yuck!
        # To work around this issue, we will pre-process the token string and
        # make all suffix operators into prefix operators.  computeAST treats suffix
        # operators as prefix operators for this reason.
        tokens = @suffixesToPrefixes(tokens)
        @computeASTForm tokens

    # Move all suffixes in the string to a prefix location based
    # on their precedence.  e.g., '3*4!' -> '3*!4'
    suffixesToPrefixes: (tokens) ->
        movePrefix = (tokens, suffixOp) ->
            ret = []
            while tokens.length > 0
                token = tokens.pop()
                # If we are a suffix operator, recursively call ourselves with a suffixOp
                if token.type is "operator" and token.value of OPERATORS.suffix
                    token.opType = "suffix"
                    # Whenever we have move an operator from a suffix to a prefix, 
                    # we need to place it in a sub-array, which has the effect of 
                    # adding parenthesis.  e.g., '3!^4' = '(!3)^4', which is 
                    # different from '!3^4' = '!(3^4)'
                    ret.unshift movePrefix(tokens, token)
                # If we are not a suffix operator and we were called with an empty suffix,
                # there is nothing to do.  Just prepend ourselves to ret.
                else if typeof suffixOp is "undefined"
                    ret.unshift token
                # If we were called with a suffixOp, we do the heavy lifting
                else
                    # If the current token is an operator, compare its precedence with
                    # ours.  If it is greater, add the operator to the list and continue.
                    # If not, put the operator back on the list of tokens, and prepend
                    # the suffixOp to ret.
                    if token.type is "operator"
                        if greaterPrecidence(token, suffixOp)
                            ret.unshift token
                            ret = movePrefix(tokens, suffixOp).concat(ret)
                        else
                            tokens.push token
                            ret.unshift suffixOp
                        return ret
                    # If we are not an operator (i.e., we are a number, identifier, or Array),
                    # we need to check the previous token to determine whether we should insert
                    # the suffixOp right before where we are, or whether we should just continue.
                    if tokens.length > 0 and tokens[tokens.length - 1].type is "operator" and greaterPrecidence(tokens[tokens.length - 1], suffixOp)
                        ret.unshift token
                        ret.unshift tokens.pop()
                    else
                        ret.unshift token
                        ret.unshift suffixOp
                        return ret
            # If we got to this point and we have a suffixOp, it means we're at the front of
            # the token list.  Clean up and return the right thing! (for example, '2!!' will reach this point)
            ret.unshift suffixOp    if typeof suffixOp isnt "undefined"
            return ret

        return movePrefix deepcopy(tokens)

    # Turns a list of tokens into an abstract syntax tree
    computeASTForm: (tokens) ->
        treeize = (tokens, operator) ->
            ret = []
            while tokens.length > 0
                token = tokens.shift()
                if token.type is "number"
                    ret.push token
                else if token instanceof Array
                    ret = ret.concat(treeize(token))
                else if token.type is "operator"
                    # if there is nothing on the stack, it means we
                    # start with the operator.  i.e., we are a prefix
                    # operator, not an infix operator!
                    if ret.length is 0
                        token.opType = "prefix"
                        # the '-' sign is overloaded.  If it is a prefix, call 
                        # it 'negate' instead
                        token.value = "negate" if token.value is "-"
                        ret.push new Node("operator", token, treeize(tokens, token))
                    # if we are an infix operator,
                    # recursively call ourselves as the operator
                    # precidence increases
                    else if greaterPrecidence(token, operator)
                        token.opType = "infix"
                        ret = [ new Node("operator", token, ret.concat(treeize(tokens, token))) ]
                    # if we encounter something of lower precedence, undo what we've done,
                    # 'cause we want to return priority to the caller
                    else
                        tokens.unshift token
                        return ret
            ret
        treeize deepcopy(tokens)

    # Takes a list of tokens and returns a nested list
    # where parenthesis turns into sublists.  E.g., '[a,b,(,c,d,)]' -> '[a,b,[c,d]]'
    computeBracketTree: (tokens) ->
        treeize = (tokens, closingBracket) ->
            ret = []
            while tokens.length > 0
                # shift modifies state. i.e., tokens is not one shorter
                token = tokens.shift()
                if token.value is closingBracket
                    return ret
                else if token.type is "bracket"
                    closingBracket = {"(": ")", "{": "}", "[": "]"}[token.value]
                    ret.push treeize(tokens, closingBracket)
                else
                    ret.push token
            return ret
        return treeize deepcopy(tokens)

    # If two numbers are next to eachother with no operation inbetween,
    # they should be implicitly multiplied
    insertImplicitMultiplication: (tokens) ->
        # Looks at the next thing in tokens and decides whether
        # there should be an implicit multiplication before it. 
        # The rules are summarized as:
        #      '3 4' -> '3*4'
        #      '3 (4)' -> '3*(4)'
        #      '3 sin(2)' -> '3*sin(2)'
        shouldInsertBeforeNextToken = (tokens) ->
            return false if tokens.length is 0
            if (tokens[0] instanceof Array) or (tokens[0].type is "number") or (tokens[0].opType is "prefix" and tokens[0].type is "operator")
                return true
            return false

        insertMul = (tokens) ->
            ret = []
            while tokens.length > 0
                # shift modifies state. i.e., tokens is now one shorter
                token = tokens.shift()
                # We possibly insert after a number, suffix operator, or array
                if (token.type is "number" or (token.type is "operator" and token.value of OPERATORS.suffix)) and shouldInsertBeforeNextToken(tokens)
                    ret.push token
                    ret.push new Token("operator", "*", -1)
                else if token instanceof Array
                    ret.push insertMul(token)
                    ret.push new Token("operator", "*", -1)    if shouldInsertBeforeNextToken(tokens)
                else
                    ret.push token
            ret.push tokens[0] if tokens.length > 0
            return ret
        return insertMul deepcopy(tokens)
