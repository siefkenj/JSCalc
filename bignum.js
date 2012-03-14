/*
 *   Bignumber support for javascript.
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


const LOG10 = Math.log(10);
const CHUNK_SIZE = 10;
const CHUNK_DIGITS = Math.round(Math.log(CHUNK_SIZE)/LOG10);


// trims zeros from the end of an array
function trimZeros(array) {
    while (array.length > 0 && array[array.length - 1] === 0) {
        array.pop();
    }
    return array;
}


// Implementation of arbitrary percision natural numbers
function BigNatural() {
    this._init.apply(this, arguments);
}
BigNatural.prototype = {
    _init: function(num) {
        this.nums = [];
        if (typeof num === 'number') {
            while (num >= 1) {
                let chunk = (num % CHUNK_SIZE);
                this.nums.push(chunk)
                num = (num - chunk) / CHUNK_SIZE;
            }
        } else if (typeof num === 'string') {
            for (let i = num.length; i > 0; i -= CHUNK_DIGITS) {
                this.nums.push(parseInt(num.slice(Math.max(i - CHUNK_DIGITS, 0), i), 10));
            }
        // If we pass in an array, assume it is already in least-significant chunk first order
        // so just duplicate it
        } else if (num instanceof Array || num instanceof BigNatural) {
            let arr;
            if (num instanceof Array) {
                arr = num;
            } else {
                arr = num.nums;
            }
            this.nums = trimZeros(arr.slice());
        } else {
            throw {name: 'Initialization Error', message: 'Unknown initialization type ' + num};
        }
    },

    toString: function() {
        // ensures a chunk is formatted with the appropriate number of
        // leading zeros
        function formatChunk(n) {
            let ret = '' + n;
            let leading = Array(Math.max(0, CHUNK_DIGITS - ret.length) + 1).join('0');
            return leading + ret;
        }
        if (this.nums.length === 0) {
            return '0';
        }
        return this.nums[this.nums.length - 1] + this.nums.slice(0, this.nums.length - 1).reverse().map(formatChunk).join('');
    },

    // returns 1 if a>b, -1 if a<b and 0 if a==b
    _compareArrays: function(a, b) {
        // Special case, the empty array is equal to the array with just one zero
        if (   a.length === 0 && b.length === 1 && b[0] === 0
            || b.length === 0 && a.length === 1 && a[0] === 0
            || a.length === 0 && b.length === 0) {
            
            return 0;
        }

        if (a.length > b.length) {
            return 1;
        } else if (a.length < b.length) {
            return -1;
        }
        // At this point we have the same number of digits
        // Compare most-significant to least-significant
        for (let i = a.length; i >= 0; i--) {
            if (a[i] > b[i]) {
                return 1;
            } else if (a[i] < b[i]) {
                return -1;
            }
        }
        return 0;
    },

    _sumArraysWithCarry: function(a, b) {
        // We will act like we have an infinite number of zeros in front of us
        function getElm(array, elm) {
            return typeof array[elm] === 'undefined' ? 0 : array[elm];
        }

        let ret = [];
        let carry = 0;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            let chunkSum = getElm(a, i) + getElm(b, i) + carry;
            let chunk = chunkSum % CHUNK_SIZE;
            carry = (chunkSum - chunk) / CHUNK_SIZE;
            ret.push(chunk);
        }
        if (carry > 0) {
            ret.push(carry);
        }
        return ret;
    },
    
    // This function assumes that this >= other.  If this assumption is not  met, it will
    // return bogus answers!
    _subtractArrays: function(a, b) {
        let complement = this._arrayPAdicCompliment, sum = this._sumArraysWithCarry;
        return complement(sum(complement(a), b));
    },

    // returns a array that looks like the (CHUNK_SIZE-1)-adic representation of -array.
    // For example, if CHUNK_SIZE = 10, it returns the 9s-complement of the number.
    // This is used to turn subtraction into addition
    _arrayPAdicCompliment: function(array) {
        return array.map(function(d){ return CHUNK_SIZE - d - 1; });
    },

    _arrayDivideWithRemainder: function(a, b) {
        if (b.length === 0 || (b.length === 1 && b[0] === 0)) {
            throw {name: 'Division By Zero Error', message: 'Division by zero'};
        }

        let dividand = [], remainder=[];
        // If by chopping off the least significant digit, we are still greater, 
        // we should do long division by recursively calling ourself
        let cmp = this._compareArrays(a.slice(1), b);
        if (cmp === 0 || cmp === 1) {
            [dividand, remainder] = this._arrayDivideWithRemainder(a.slice(1), b);
            remainder.unshift(a[0]);
            a = remainder;
        }

        // If we're of comparable size, implement division via subtraction
        let divChunk = 0;
        cmp = this._compareArrays(a, b);
        while (cmp === 0 || cmp === 1) {
            a = trimZeros(this._subtractArrays(a, b));
            divChunk++;
            cmp = this._compareArrays(a, b);
        }
        dividand.unshift(divChunk);
        return [trimZeros(dividand), a];
    },

    // shifts by CHUNK_SIZE n times.  I.e., returns the number *CHUNK_SIZE^n
    shift: function(n) {
        let ret = Array(n);
        for (let i = n - 1; i >= 0; i--) {
            ret[i] = 0;
        }
        return new BigNatural(ret.concat(this.nums));
    },
    
    add: function(other) {
        return new BigNatural(this._sumArraysWithCarry(this.nums, other.nums));
    },

    // This function assumes that this >= other.  If this assumption is not  met, it will
    // return bogus answers!
    sub: function(other) {
        let complement = this._arrayPAdicCompliment, sum = this._sumArraysWithCarry;
        return new BigNatural(complement(sum(complement(this.nums), other.nums)));
    },

    mul: function(other) {
        // We will act like we have an infinite number of zeros in front of us
        function getElm(array, elm) {
            return typeof array[elm] === 'undefined' ? 0 : array[elm];
        }
        let ret = new BigNatural(0);
        for (let digit = 0; digit < other.nums.length; digit++){
            let currArray = [];
            let carry = 0;
            for (pos = 0; pos < this.nums.length; pos++) {
                let chunkProduct = other.nums[digit]*this.nums[pos] + carry;
                let chunk = chunkProduct % CHUNK_SIZE;
                carry = (chunkProduct - chunk) / CHUNK_SIZE;
                currArray.push(chunk);
            }
            currArray.push(carry);
            ret = ret.add((new BigNatural(currArray)).shift(digit));
        }

        return ret;
    },

    mod: function(other) {
        if (other.eq(new BigNatural(0))) {
            return new BigNatural(0);
        }

        // We can be a little bit efficient.  If the number we mod out by is
        // way, way bigger than us, first mod out by a multiple
        let ret = new BigNatural(this);
        if (this.nums.length >= other.nums.length + 2) {
            ret = ret.mod(other.shift(1));
        }
        while (ret.gte(other)) {
            ret = new BigNatural(ret.sub(other));
        }

        return ret;
    },

    gcd: function(other) {
        a = this;
        b = other;
        while (!(b.isZero())) {
            [a, b] = [b, a.mod(b)];
        }
        return a;
    },
    
    // returns this/other as a whole number.  No decimal places!
    div: function(other) {
        return this.divideWithRemainder(other)[0];
    },
    
    // returns [dividand, remainder] such that dividand*other + remainder == this
    divideWithRemainder: function(other) {
        let [dividand, remainder] = this._arrayDivideWithRemainder(this.nums, other.nums);
        return [new BigNatural(dividand), new BigNatural(remainder)];
    },
    
    // Does rich comparison.  I.e., this>other returns 1, this==other returns 0, this<other returns -1
    cmp: function(other) {
        return this._compareArrays(this.nums, other.nums);
    },

    isZero: function() {
        return this.nums.length === 0 || (this.nums.length === 1 && this.nums[0] === 0);
    },
    
    isOne: function() {
        return (this.nums.length === 1 && this.nums[0] === 1);
    },

    eq: function(other) {
        return this.cmp(other) === 0;
    },
    
    gt: function(other) {
        return this.cmp(other) === 1;
    },

    lt: function(other) {
        return this.cmp(other) === -1;
    },
    
    gte: function(other) {
        let cmp = this.cmp(other)
        return cmp === 1 || cmp === 0;
    },

    lte: function(other) {
        let cmp = this.cmp(other)
        return cmp === -1 || cmp === 0;
    },
}

function BigInt() {
    this._init.apply(this, arguments);
}

BigInt.prototype = {
    _init: function(num, sign) {
        this.num;
        this.sign = 1;
        if (typeof num === 'number') {
            if (num < 0) {
                this.sign = -1;
                num = -num;
            }
        } else if (typeof num === 'string') {
            if (num.charAt(0) === '-') {
                this.sign = -1;
                num = num.slice(1);
            }
        } else if (num instanceof BigNatural) {
            if (sign === -1) {
                this.sign = -1;
            }
            num = num.nums;
        } else if (num instanceof Array) {
            if (sign === -1) {
                this.sign = -1;
            }
        }
        this.num = new BigNatural(num);
    },

    toString: function() {
        let sign = this.sign === 1 ? '' : '-';
        return sign + this.num;
    },
    
    // returns negative of itself
    negate: function() {
        return new BigInt(this.num, -this.sign);
    },

    // returns the absolute value of itself
    abs: function() {
        return new BigInt(this.num, 1);
    },

    add: function(other) {
        let sign;
        if (this.sign === other.sign) {
            sign = this.sign;
            return new BigInt(this.num.add(other.num), sign);
        } else {
            // Use the method of complementation to add a negative and a positive
            let bigger, smaller;
            if (this.num.cmp(other.num) === 1) {
                bigger = this.num;
                smaller = other.num;
                sign = this.sign;
            } else {
                bigger = other.num;
                smaller = this.num;
                sign = other.sign;
            }
            let sum = bigger.sub(smaller);
            // If we are the bigger number in absolute value, the sign we have at the end is the our sign
            return new BigInt(sum, sign);
        }
    },

    mul: function(other) {
        let sign = this.sign * other.sign;
        return new BigInt(this.num.mul(other.num), sign);
    },

    div: function(other) {
        return this.divideWithRemainder(other)[0];
    },

    // returns [dividand, remainder] which satisfy the relationship dividand*other+remainder = this
    divideWithRemainder: function(other) {
        // The result should satisfy dividand*other+remainder = this, so get the signs right!
        let dividandSign = 1, remainderSign = 1;
        if (this.sign === -1 && other.sign === 1) {
            dividandSign = -1;
            remainderSign = -1;
        } else if (this.sign === 1 && other.sign === -1) {
            dividandSign = -1;
            remainderSign = 1;
        } else if (this.sign === -1 && other.sign === -1) {
            dividandSign = 1;
            remainderSign = -1;
        }
        
        this.sign * other.sign;
        let [dividand, remainder] = this.num.divideWithRemainder(other.num);
        return [new BigInt(dividand, dividandSign), new BigInt(remainder, remainderSign)];
    },

    gcd: function(other) {
        return this.num.gcd(other.num);
    },

    // Does rich comparison.  I.e., this>other returns 1, this==other returns 0, this<other returns -1
    cmp: function(other) {
        if (this.sign > other.sign) {
            return 1;
        } else if (this.sign < other.sign) {
            return -1;
        }

        // At this point we know we both have the same sign
        if (this.sign === 1) {
            return this.num.cmp(other.num);
        } else {
            return -this.num.cmp(other.num);
        }
    },
    
    isZero: function() {
        return this.nums.length === 0 || (this.nums.length === 1 && this.nums[0] === 0);
    },
    
    isOne: function() {
        return (this.nums.length === 1 && this.nums[0] === 1 && this.sign === 1);
    },
}


function Complex() {
    this._init.apply(this, arguments);
}

Complex.prototype = {
    _init: function(re, im) {
        this.re = re;
        this.im = im;
    },

    toString: function() {
        return this.re.toFixed(5) + ' ' + this.im.toFixed(5) +'i';
    },

    add: function(other) {
        return new Complex(this.re + other.re, this.im + other.im);
    },

    mul: function(other) {
        //(a+bi)*(c+di) = ac-bd + (ad+bc)i
        let a = this.re, b = this.im;
        let c = other.re, d = other.im;
        return new Complex(a*c-b*d, a*d+b*c);
    },

    conj: function() {
        return new Complex(this.re, -this.im);
    },

    norm: function() {
        return Math.sqrt(this.re*this.re + this.im*this.im);
    },

    arg: function() {
        return Math.atan2(this.im, this.re);
    }
}

ComplexMath = {
    fromPolar: function(mag, arg) {
        let a = mag*Math.cos(arg), b = mag*Math.sin(arg);
        return new Complex(a,b);
    },

    sqrt: function(c) {
        let mag = c.norm(), arg = c.arg();
        console.log(mag,arg)
        return ComplexMath.fromPolar(Math.sqrt(mag), arg/2);
    },

    add: function(a, b) {
        return a.add(b);
    },

    mul: function(a, b) {
        return a.mul(b);
    }
}
