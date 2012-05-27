###
 *     Bignumber support for javascript.
 *
 *     Copyright (C) 2012    Jason Siefken
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with this program.    If not, see <http://www.gnu.org/licenses/>.
###


LOG10 = Math.log(10)
CHUNK_SIZE = 10
CHUNK_DIGITS = Math.round(Math.log(CHUNK_SIZE) / LOG10)

# trims zeros from the end of an array
trimZeros = (array) ->
    array.pop() while array.length > 0 and array[array.length - 1] is 0
    return array

# Implementation of arbitrary percision natural numbers
class BigNatural
    constructor: (num) ->
        @nums = []
        if typeof num is "number"
            while num >= 1
                chunk = (num % CHUNK_SIZE)
                @nums.push chunk
                num = (num - chunk) / CHUNK_SIZE
        else if typeof num is "string"
            i = num.length

            while i > 0
                @nums.push parseInt(num.slice(Math.max(i - CHUNK_DIGITS, 0), i), 10)
                i -= CHUNK_DIGITS
        # If we pass in an array, assume it is already in least-significant chunk first order
        # so just duplicate it
        else if num instanceof Array or num instanceof BigNatural
            arr = undefined
            if num instanceof Array
                arr = num
            else
                arr = num.nums
            @nums = trimZeros(arr.slice())
        else
            throw
                name: "Initialization Error"
                message: "Unknown initialization type " + num

    _constructor: BigNatural
    toString: ->
        # ensures a chunk is formatted with the appropriate number of
        # leading zeros
        formatChunk = (n) ->
            ret = "" + n
            leading = Array(Math.max(0, CHUNK_DIGITS - ret.length) + 1).join("0")
            leading + ret
        return "0"    if @nums.length is 0
        @nums[@nums.length - 1] + @nums.slice(0, @nums.length - 1).reverse().map(formatChunk).join("")

    # returns 1 if a>b, -1 if a<b and 0 if a==b
    _compareArrays: (a, b) ->
        # Special case, the empty array is equal to the array with just one zero
        return 0 if (a.length is 0 and b.length is 1 and b[0] is 0) or (b.length is 0 and a.length is 1 and a[0] is 0) or (a.length is 0 and b.length is 0)

        if a.length > b.length
            return 1
        else return -1 if a.length < b.length
        
        # At this point we have the same number of digits
        # Compare most-significant to least-significant
        i = a.length
        while i >= 0
            if a[i] > b[i]
                return 1
            else return -1 if a[i] < b[i]
            i--
        return 0

    _sumArraysWithCarry: (a, b) ->
        # We will act like we have an infinite number of zeros in front of us
        getElm = (array, elm) ->
            return (if typeof array[elm] is "undefined" then 0 else array[elm])

        ret = []
        carry = 0
        i = 0

        while i < Math.max(a.length, b.length)
            chunkSum = getElm(a, i) + getElm(b, i) + carry
            chunk = chunkSum % CHUNK_SIZE
            carry = (chunkSum - chunk) / CHUNK_SIZE
            ret.push chunk
            i++
        ret.push carry    if carry > 0
        ret

    # This function assumes that this >= other.  If this assumption is not  met, it will
    # return bogus answers!
    _subtractArrays: (a, b) ->
        complement = @_arrayPAdicCompliment
        sum = @_sumArraysWithCarry
        complement sum(complement(a), b)

    # returns a array that looks like the (CHUNK_SIZE-1)-adic representation of -array.
    # For example, if CHUNK_SIZE = 10, it returns the 9s-complement of the number.
    # This is used to turn subtraction into addition
    _arrayPAdicCompliment: (array) ->
        array.map (d) ->
            CHUNK_SIZE - d - 1

    _arrayDivideWithRemainder: (a, b) ->
        if b.length is 0 or (b.length is 1 and b[0] is 0)
            throw
                name: "Division By Zero Error"
                message: "Division by zero"

        dividand = []
        remainder = []
        # If by chopping off the least significant digit, we are still greater,
        # we should do long division by recursively calling ourself
        cmp = @_compareArrays(a.slice(1), b)
        if cmp is 0 or cmp is 1
            [ dividand, remainder ] = @_arrayDivideWithRemainder(a.slice(1), b)
            remainder.unshift a[0]
            a = remainder

        # If we're of comparable size, implement division via subtraction
        divChunk = 0
        cmp = @_compareArrays(a, b)
        while cmp is 0 or cmp is 1
            a = trimZeros(@_subtractArrays(a, b))
            divChunk++
            cmp = @_compareArrays(a, b)
        dividand.unshift divChunk
        return [ trimZeros(dividand), a ]

    # shifts by CHUNK_SIZE n times.  I.e., returns the number *CHUNK_SIZE^n
    shift: (n) ->
        ret = Array(n)
        i = n - 1

        while i >= 0
            ret[i] = 0
            i--
        new @_constructor(ret.concat(@nums))

    add: (other) ->
        new @_constructor(@_sumArraysWithCarry(@nums, other.nums))

    # This function assumes that this >= other.  If this assumption is not  met, it will
    # return bogus answers!
    sub: (other) ->
        complement = @_arrayPAdicCompliment
        sum = @_sumArraysWithCarry
        new @_constructor(complement(sum(complement(@nums), other.nums)))

    mul: (other) ->
        # We will act like we have an infinite number of zeros in front of us
        getElm = (array, elm) ->
            (if typeof array[elm] is "undefined" then 0 else array[elm])
        ret = new @_constructor(0)
        digit = 0

        while digit < other.nums.length
            currArray = []
            carry = 0
            pos = 0
            while pos < @nums.length
                chunkProduct = other.nums[digit] * @nums[pos] + carry
                chunk = chunkProduct % CHUNK_SIZE
                carry = (chunkProduct - chunk) / CHUNK_SIZE
                currArray.push chunk
                pos++
            currArray.push carry
            ret = ret.add((new @_constructor(currArray)).shift(digit))
            digit++
        ret

    mod: (other) ->
        return new @_constructor(0)    if other.eq(new @_constructor(0))

        # We can be a little bit efficient.  If the number we mod out by is
        # way, way bigger than us, first mod out by a multiple
        ret = new @_constructor(this)
        ret = ret.mod(other.shift(1)) if @nums.length >= other.nums.length + 2
        ret = new @_constructor(ret.sub(other)) while ret.gte(other)
        return ret

    gcd: (other) ->
        a = this
        b = other
        [ a, b ] = [ b, a.mod(b) ]    until (b.isZero())
        a

    # returns this/other as a whole number.  No decimal places!
    div: (other) ->
        @divideWithRemainder(other)[0]

    # returns [dividand, remainder] such that dividand*other + remainder == this
    divideWithRemainder: (other) ->
        [dividand, remainder] = @_arrayDivideWithRemainder(@nums, other.nums)
        return [ new @_constructor(dividand), new @_constructor(remainder) ]

    #  Does rich comparison.  I.e., this>other returns 1, 
    #  this==other returns 0, this<other returns -1
    cmp: (other) ->
        @_compareArrays @nums, other.nums

    isZero: ->
        @nums.length is 0 or (@nums.length is 1 and @nums[0] is 0)

    isOne: ->
        @nums.length is 1 and @nums[0] is 1

    eq: (other) ->
        @cmp(other) is 0

    gt: (other) ->
        @cmp(other) is 1

    lt: (other) ->
        @cmp(other) is -1

    gte: (other) ->
        cmp = @cmp(other)
        cmp is 1 or cmp is 0

    lte: (other) ->
        cmp = @cmp(other)
        cmp is -1 or cmp is 0

class BigInt
    constructor: (num, sign) ->
        @num
        @sign = 1
        if typeof num is "number"
            if num < 0
                @sign = -1
                num = -num
        else if typeof num is "string"
            if num.charAt(0) is "-"
                @sign = -1
                num = num.slice(1)
        else if num instanceof BigNatural
            @sign = -1    if sign is -1
            num = num.nums
        else @sign = -1    if sign is -1    if num instanceof Array
        @num = new BigNatural(num)

    _constructor: BigInt
    toString: ->
        sign = (if @sign is 1 then "" else "-")
        sign + @num

    # returns negative of itself
    negate: ->
        new @_constructor(@num, -@sign)

    # returns the absolute value of itself
    abs: ->
        new @_constructor(@num, 1)

    add: (other) ->
        sign = undefined
        if @sign is other.sign
            sign = @sign
            new @_constructor(@num.add(other.num), sign)
        else
            bigger = undefined
            smaller = undefined
            # Use the method of complementation to add a negative and a positive
            if @num.cmp(other.num) is 1
                bigger = @num
                smaller = other.num
                sign = @sign
            else
                bigger = other.num
                smaller = @num
                sign = other.sign
            sum = bigger.sub(smaller)
            # If we are the bigger number in absolute value, the sign we have at 
            # the end is the our sign
            return new @_constructor(sum, sign)

    mul: (other) ->
        sign = @sign * other.sign
        new @_constructor(@num.mul(other.num), sign)

    div: (other) ->
        @divideWithRemainder(other)[0]

    # returns [dividand, remainder] which satisfy the relationship 
    # dividand*other+remainder = this
    divideWithRemainder: (other) ->
        # The result should satisfy dividand*other+remainder = this, so get the signs right!
        dividandSign = 1
        remainderSign = 1
        if @sign is -1 and other.sign is 1
            dividandSign = -1
            remainderSign = -1
        else if @sign is 1 and other.sign is -1
            dividandSign = -1
            remainderSign = 1
        else if @sign is -1 and other.sign is -1
            dividandSign = 1
            remainderSign = -1
        @sign * other.sign
        [dividand, remainder] = @num.divideWithRemainder(other.num)
        return [ new @_constructor(dividand, dividandSign), new @_constructor(remainder, remainderSign) ]

    gcd: (other) ->
        @num.gcd other.num

    cmp: (other) ->
        if @sign > other.sign
            return 1
        else return -1 if @sign < other.sign

        # At this point we know we both have the same sign
        if @sign is 1
            @num.cmp other.num
        else
            -@num.cmp(other.num)

    isZero: ->
        @nums.length is 0 or (@nums.length is 1 and @nums[0] is 0)

    isOne: ->
        @nums.length is 1 and @nums[0] is 1 and @sign is 1


COMPLEX_PERCISION = 10e10
class Complex
    constructor: (re, im) ->
        @re = re
        @im = im

    _constructor: Complex
    toString: ->
        imToString = (x) ->
            if x is 1
                return "i"
            else return "-i"    if x is -1
            x + "i"
        
        # Check if we are NaN
        return "NaN" if isNaN(@re) and isNaN(@im)

        # Round to 10 digits
        re = Math.round(@re * COMPLEX_PERCISION) / COMPLEX_PERCISION
        im = Math.round(@im * COMPLEX_PERCISION) / COMPLEX_PERCISION
        if re is 0 and im is 0
            return "0"
        else if im is 0
            return "" + re
        else return imToString(im)    if re is 0
        if im < 0
            re + " - " + imToString(Math.abs(im))
        else
            re + " + " + imToString(im)

    isReal: (a) ->
        a = a or this
        return true    if Math.abs(a.im) < 1 / COMPLEX_PERCISION
        false

    isImaginary: (a) ->
        a = a or this
        return true    if Math.abs(a.re) < 1 / COMPLEX_PERCISION
        false

    eq: (other) ->
        re = Math.round(@re * COMPLEX_PERCISION) / COMPLEX_PERCISION
        im = Math.round(@im * COMPLEX_PERCISION) / COMPLEX_PERCISION
        otherRe = Math.round(other.re * COMPLEX_PERCISION) / COMPLEX_PERCISION
        otherIm = Math.round(other.im * COMPLEX_PERCISION) / COMPLEX_PERCISION
        re is otherRe and im is otherIm

    add: (other) ->
        new Complex(@re + other.re, @im + other.im)

    sub: (other) ->
        new Complex(@re - other.re, @im - other.im)

    mul: (other) ->
        # (a+bi)*(c+di) = ac-bd + (ad+bc)i
        a = @re
        b = @im
        c = other.re
        d = other.im
        new Complex(a * c - b * d, a * d + b * c)

    div: (other) ->
        # The straight-forward way is numerically unstable, so use a more
        # convoluted method for division
        a = @re
        b = @im
        c = other.re
        d = other.im
        abs = Math.abs
        if abs(c) >= abs(d)
            denom = c + d*(d/c)
            return new Complex((a+b*(d/c))/denom, (b-a*(d/c))/denom)
        else
            denom = d + c*(c/d)
            return new Complex((a*(c/d)+b)/denom, (b*(c/d)-a)/denom)

    conj: ->
        new Complex(@re, -@im)

    norm: ->
        # Follow advice from numerical analists as the straight-forward code can overflow
        # easily.
        #   Math.sqrt @re * @re + @im * @im
        re = @re
        im = @im
        return 0 if re is 0 and im is 0
        abs = Math.abs
        return abs(re)*Math.sqrt(1+(im/re)*(im/re)) if abs(re) >= abs(im)
        return abs(im)*Math.sqrt(1+(re/im)*(re/im)) if abs(re) < abs(im)

    arg: ->
        ret = Math.atan2(@im, @re)
        # Math.atan2(-0, 1) == -pi, but we want Math.atan2(-0,1) == Math.atan2(0,1) !!
        return (if ret is -Math.PI then Math.PI else ret)

ComplexMath =
    i: new Complex(0, 1)
    minusI: new Complex(0, -1)
    iOverTwo: new Complex(0, 1 / 2)
    one: new Complex(1, 0)
    minusOne: new Complex(-1, 0)
    pi: new Complex(Math.PI, 0)
    equal: (a, b) ->
        a.eq b

    gt: (a, b) ->
        (a.norm() - b.norm()) > 1 / COMPLEX_PERCISION

    lt: (a, b) ->
        (a.norm() - b.norm()) < -1 / COMPLEX_PERCISION

    gte: (a, b) ->
        ComplexMath.equal(a, b) or ComplexMath.gt(a, b)

    lte: (a, b) ->
        ComplexMath.equal(a, b) or ComplexMath.lt(a, b)

    re: (z) ->
        new Complex(z.re, 0)

    im: (z) ->
        new Complex(z.im, 0)

    arg: (z) ->
        new Complex(z.arg(), 0)

    norm: (z) ->
        new Complex(z.norm(), 0)

    fromPolar: (mag, arg) ->
        a = mag * Math.cos(arg)
        b = mag * Math.sin(arg)
        new Complex(a, b)

    floor: (z) ->
        new Complex(Math.floor(z.re), Math.floor(z.im))

    ceil: (z) ->
        new Complex(Math.ceil(z.re), Math.ceil(z.im))

    round: (z) ->
        new Complex(Math.round(z.re), Math.round(z.im))

    # If the real part or imaginary part of b is zero, mod
    # treats a,b as purely real or purely imaginary.
    mod: (a, b) ->
        if a instanceof Array
            b = a[1]
            a = a[0]
        re = ((a.re % b.re) + b.re) % b.re
        im = ((a.im % b.im) + b.im) % b.im
        if isNaN(re) and isNaN(im)
            return new Complex(NaN, NaN)
        else if isNaN(re)
            return new Complex(0, im)
        else return new Complex(re, 0)    if isNaN(im)
        new Complex(re, im)

    conj: (z) ->
        z.conj()

    negate: (z) ->
        new Complex(-z.re, -z.im)

    sqrt: (z) ->
        mag = z.norm()
        arg = z.arg()
        ComplexMath.fromPolar Math.sqrt(mag), arg / 2

    add: (a, b) ->
        a.add b

    sub: (a, b) ->
        a.sub b

    mul: (a, b) ->
        a.mul b

    div: (a, b) ->
        a.div b

    log: (z) ->
        mag = z.norm()
        arg = z.arg()
        new Complex(Math.log(mag), arg)

    exp: (z) ->
        mag = z.norm()
        arg = z.arg()
        cos = Math.cos(arg)
        sin = Math.sin(arg)
        ComplexMath.fromPolar Math.exp(mag * cos), mag * sin

    pow: (a, b) ->
        # If b is a reasonable integer, just do some repeated multiplication
        if b.isReal() and Math.round(b.re) is b.re and b.re < 10000
            exponent = b.re

            # We are going to use the fact that x^1011 = x^100*x^10*x^1 (in binary) 
            # to reduce our number of multiplications.  Keep track of the square of 
            # the previous number and only multiply it to our buffer
            # if the binary digit of the power is 1.
            currentPower = a
            buffer = new Complex(1,0)
            binaryDigits = Math.floor(Math.log(exponent)/Math.log(2))
            for i in [0..binaryDigits]
                if (exponent>>i) % 2 is 1
                    buffer = ComplexMath.mul(buffer, currentPower)
                currentPower = ComplexMath.mul(currentPower, currentPower)
            return buffer
            
        return ComplexMath.exp ComplexMath.mul(ComplexMath.log(a), b)

    factorial: (z) ->
        return new Complex(NaN, NaN)    if not z.isReal() or z.re < -1 / COMPLEX_PERCISION
        x = z.re
        return new Complex(Infinity, 0)    if x > 170
        accum = 1
        while x > 1
            accum = accum * x
            x = x - 1
        new Complex(accum, 0)

    sin: (z) ->
        # sin(c) = (e^(ic)-e^(-ic))/(2i)
        twoI = new Complex(0, 2)
        ComplexMath.div ComplexMath.sub(ComplexMath.exp(ComplexMath.mul(ComplexMath.i, z)), ComplexMath.exp(ComplexMath.mul(ComplexMath.minusI, z))), twoI

    cos: (z) ->
        # sin(c) = (e^(ic)+e^(-ic))/(2)
        two = new Complex(2, 0)
        ComplexMath.div ComplexMath.add(ComplexMath.exp(ComplexMath.mul(ComplexMath.i, z)), ComplexMath.exp(ComplexMath.mul(ComplexMath.minusI, z))), two

    tan: (z) ->
        ComplexMath.sin(z).div ComplexMath.cos(z)

    asin: (z) ->
        # asin(z) = -ilog(iz+sqrt(1-z^2))
        ComplexMath.mul ComplexMath.log(ComplexMath.add(ComplexMath.mul(ComplexMath.i, z), ComplexMath.sqrt(ComplexMath.sub(ComplexMath.one, z.mul(z))))), ComplexMath.minusI

    acos: (z) ->
        # acos(z) = -ilog(z+isqrt(1-z^2))
        sq = ComplexMath.sqrt(ComplexMath.sub(ComplexMath.one, z.mul(z)))
        ComplexMath.mul ComplexMath.log(ComplexMath.add(z, ComplexMath.mul(z, ComplexMath.i))), ComplexMath.minusI

    atan: (z) ->
        # atan(z) = i(log(1-iz)-log(1+iz))/2
        lgm = ComplexMath.log(ComplexMath.sub(ComplexMath.one, ComplexMath.mul(ComplexMath.i, z)))
        lgp = ComplexMath.log(ComplexMath.add(ComplexMath.one, ComplexMath.mul(ComplexMath.i, z)))
        ComplexMath.mul ComplexMath.iOverTwo, ComplexMath.sub(lgm, lgp)

    # atan2 defined for real arguments only
    atan2: (a, b) ->
        new Complex(Math.atan2(a.re, b.re), 0)

    sec: (z) ->
        ComplexMath.one.div ComplexMath.cos(z)

    csc: (z) ->
        ComplexMath.one.div ComplexMath.sin(z)

    cot: (z) ->
        ComplexMath.one.div ComplexMath.tan(z)

    sinh: (z) ->
        # sinh(z) = -isin(iz)
        ComplexMath.minusI.mul ComplexMath.sin(ComplexMath.i.mul(z))

    cosh: (z) ->
        # cosh(z) = cos(iz)
        ComplexMath.cos ComplexMath.i.mul(z)

    tanh: (z) ->
        # tanh(z) = -itan(iz)
        ComplexMath.minusI.mul ComplexMath.tan(ComplexMath.i.mul(z))

    asinh: (z) ->
        #  asin(z) = log(z+sqrt(1+z^2))
        ComplexMath.log z.add(ComplexMath.sqrt(ComplexMath.one.add(z.mul(z))))

    acosh: (z) ->
        # acos(z) = log(z+sqrt(-1+z^2))
        ComplexMath.log z.add(ComplexMath.sqrt(ComplexMath.minusOne.add(z.mul(z))))

    atanh: (z) ->
        # atan(z) = (log(1+z)-log(1-z))/2
        ComplexMath.log(ComplexMath.one.add(z)).sub(ComplexMath.log(ComplexMath.one.sub(z))).div new Complex(2, 0)
