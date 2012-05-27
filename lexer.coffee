###
   Lexer for math expressions

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

TOKENS =
    operators:
        "+": true
        "-": true
        "*": true
        "/": true
        "//": true
        "^": true
        "=": true
        "!": true
        "==": true
        "<": true
        "<=": true
        ">": true
        ">=": true
        "!=": true
        ",": true
        deg: true
        "%": true

    brackets:
        "(": true
        ")": true
        "[": true
        "]": true
        "{": true
        "}": true

# Some helper functions
max = (l) ->
    ret = l[0]
    for i in l[1..]
        ret = Math.max(ret, i)
    return ret

isWhiteSpace = (ch) ->
    (ch is '\u0009') or (ch is ' ') or (ch is '\u00A0')

# Accepts a string, an array of strings, or an object and tells whether
# source starts with that string or a key in the object
startsWith = (source, substr) ->
    if substr instanceof Array
        for prefix in substr
            if prefix is source[0..prefix.length-1]
                return prefix
    else if typeof substr is "object"
        # We want to match the longest token that starts with the same thing as source
        matches = (k for k of substr when k is source[0..k.length-1])
        ret = matches[0]
        for m in matches[1..]
            if m.length > ret.length
                ret = m
        return ret
    else
        return substr if substr is source[0..substr.length-1]

    return false


class Token
    constructor: (@type, @value, @position) ->
        # If our number is a string, check what base it is in and convert it to the
        # appropriate internal representation
        if @type is "number" and typeof @value is "string"
            switch @value.charAt(1)
                when 'x'
                    @value = parseInt(@value.slice(2), 16)
                when 'b'
                    @value = parseInt(@value.slice(2), 2)
                when 'o'
                    @value = parseInt(@value.slice(2), 8)
                else
                    @value = parseFloat(value)
    toString: ->
        return "'#{@value}'"

class Lexer
    constructor: (@source) ->
        @index = 0

    # returns the token at the position pos or, if
    # pos == null, returns the token at this.index and
    # advances this.index
    get: ->
        # Get the first non-whitespace token at the current index
        @eatWhitespace()
        tokenString = undefined
        token = null
        # we must attempt to grab tokens in this order, or else we'll tokenize incorrectly!
        for [tokenType, func] in [["operator", @getOperator], ["bracket", @getBracket], ["number", @getNumber], ["identifier", @getIdentifier]]
            tokenString = func()
            if tokenString
                token = new Token(tokenType, tokenString, @index)
                break
        @index += tokenString.length if token
        return token

    # returns an operator at the current index
    getOperator: (pos=@index or 0, source=@source) =>
        return startsWith(source.slice(pos), TOKENS.operators) or null

    # returns a bracket at the current index
    getBracket: (pos, source) =>
        pos = pos or @index or 0
        source = source or @source
        return startsWith(source.slice(pos), TOKENS.brackets) or null

    # returns a number at the current index
    getNumber: (pos, source) =>
        currPos = pos or @index or 0
        currSource = source or @source
        currSource = currSource.slice(currPos)

        # Match numbers in hex '0x000' format
        match = currSource.match(/^0x[0-9A-Fa-f]+/)
        return match[0] if match
        # Match numbers in binary '0b000' format
        match = currSource.match(/^0b[01]+/)
        return match[0] if match
        # Match numbers in octal '0o000' format
        match = currSource.match(/^0o[0-7]+/)
        return match[0] if match

        # If we aren't a number in a special base, look for a 
        # regular number (possibly in scientific notation)
        #
        # Match numbers, including numbers in scientific notation using
        # 1.234E10 format.
        match = currSource.match(/^(\d+\.?\d*|\d*\.?\d+)(([eE][+-]?)?\d+)?/)
        return match[0] if match
        return null

    getIdentifier: (pos=@index or 0, source=@source) =>
        match = source.slice(pos).match(/^[A-Za-z]\w*/)
        return match[0] if match
        return null

    eatWhitespace: (pos=@index or 0, source=@source) =>
        while isWhiteSpace(source.charAt(pos))
            pos++
        # If we didn't pass in any arguments, we should change the internal state
        @index = pos if arguments.length is 0
        return pos
