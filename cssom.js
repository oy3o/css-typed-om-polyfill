/**
 * Moonlight CSS Typed OM Polyfill
 * 
 * Features:
 * - Zero-Allocation Lexer with Raw Token Capture
 * - Algebraic Simplification Engine (Strict Type Safety)
 * - Recursive Fallback Parsing for CSS Variables
 * - Enhanced Error Handling and Type Safety
 * 
 */

(function (global) {
    'use strict';

    // --- 0. Environment Check ---
    if (typeof global === 'undefined') return;
    if (global.CSS && global.CSS.number && global.CSSNumericValue) {
        console.log("%c Moonlight %c Native Support Detected. Sleeping. ",
            "background:#bd93f9;color:white", "background:#333;color:white");
        return;
    }

    // --- 1. High-Performance Constants ---
    const UNIT_MAP = {
        '%': 'percent', 'percent': 'percent',
        'px': 'length', 'cm': 'length', 'mm': 'length', 'in': 'length',
        'pt': 'length', 'pc': 'length',
        'em': 'length', 'rem': 'length', 'vw': 'length', 'vh': 'length',
        'vmin': 'length', 'vmax': 'length', 'ch': 'length', 'ex': 'length',
        'q': 'length', 'vi': 'length', 'vb': 'length',
        'deg': 'angle', 'rad': 'angle', 'grad': 'angle', 'turn': 'angle',
        's': 'time', 'ms': 'time',
        'Hz': 'frequency', 'kHz': 'frequency',
        'dpi': 'resolution', 'dpcm': 'resolution', 'dppx': 'resolution',
        'fr': 'flex',
        'number': 'number', '': 'number'
    };

    const BASE_TYPES = {
        length: 0, angle: 0, time: 0, frequency: 0,
        resolution: 0, flex: 0, percent: 0
    };

    const STRICT_PROPS = {
        'width': 1, 'height': 1, 'min-width': 1, 'min-height': 1,
        'max-width': 1, 'max-height': 1,
        'top': 1, 'left': 1, 'right': 1, 'bottom': 1,
        'margin': 1, 'padding': 1, 'font-size': 1,
        'transform': 1, 'rotate': 1, 'scale': 1, 'translate': 1,
        'opacity': 1, 'z-index': 1,
        'flex-grow': 1, 'flex-shrink': 1, 'order': 1
    };

    // LRU Cache for kebab-case conversion
    class LRUCache {
        constructor(maxSize = 1000) {
            this.maxSize = maxSize;
            this.cache = new Map();
        }
        get(key) {
            if (!this.cache.has(key)) return undefined;
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        set(key, value) {
            if (this.cache.has(key)) {
                this.cache.delete(key);
            } else if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, value);
        }
    }

    const KEBAB_CACHE = new LRUCache(500);

    // --- 2. Algebraic Engine ---

    const createType = (unit) => {
        const t = { ...BASE_TYPES };
        const cat = UNIT_MAP[unit];
        if (!cat) {
            throw new TypeError(`Unknown unit: ${unit}`);
        }
        if (cat !== 'number' && t.hasOwnProperty(cat)) {
            t[cat] = 1;
        }
        return t;
    };

    // Type compatibility checker
    const areTypesCompatible = (type1, type2) => {
        // Special case: percent and length are compatible in CSS
        // e.g., calc(100% - 20px) is valid
        const hasPercent1 = type1.percent > 0;
        const hasPercent2 = type2.percent > 0;
        const hasLength1 = type1.length > 0;
        const hasLength2 = type2.length > 0;

        // If one has percent and the other has length (but not both), they're compatible
        if ((hasPercent1 || hasLength1) && (hasPercent2 || hasLength2)) {
            // Check all other dimensions are zero
            for (let key in BASE_TYPES) {
                if (key === 'percent' || key === 'length') continue;
                if (type1[key] !== 0 || type2[key] !== 0) return false;
            }
            return true;
        }

        // Otherwise, types must match exactly
        for (let key in BASE_TYPES) {
            if (type1[key] !== type2[key]) return false;
        }
        return true;
    };

    function simplifySum(args, _skipRecursion = false) {
        const hasVar = args.some(a => a instanceof CSSVariableReferenceValue);

        // Fast Path: Pure Units
        if (!hasVar && args.length === 2 &&
            args[0] instanceof CSSUnitValue &&
            args[1] instanceof CSSUnitValue &&
            args[0].unit === args[1].unit) {
            return new CSSUnitValue(args[0].value + args[1].value, args[0].unit);
        }

        let flat = [];
        let hasSum = false;
        for (let arg of args) {
            if (arg instanceof CSSMathSum) {
                hasSum = true;
                flat.push(...arg.values);
            } else {
                flat.push(arg);
            }
        }
        const target = hasSum ? flat : args;

        // If variables exist, return without folding
        if (hasVar) {
            return target.length === 1 ? target[0] : target;
        }

        // Type compatibility check
        let hasNum = false;
        let hasDimension = false;
        let firstDimType = null;

        for (let arg of target) {
            if (arg instanceof CSSUnitValue) {
                if (arg.unit === 'number') {
                    hasNum = true;
                } else {
                    hasDimension = true;
                    const argType = arg.type();

                    if (!firstDimType) {
                        firstDimType = argType;
                    } else if (!areTypesCompatible(firstDimType, argType)) {
                        throw new TypeError(
                            `Incompatible types in sum: Cannot add ${JSON.stringify(firstDimType)} and ${JSON.stringify(argType)}`
                        );
                    }
                }
            }
        }

        // Pure numbers cannot mix with dimensions
        if (hasNum && hasDimension) {
            throw new TypeError("Incompatible types: Cannot add Number and Dimension.");
        }

        // Fold compatible units (only exact same unit)
        const bucket = {};
        const complex = [];

        for (let arg of target) {
            if (arg instanceof CSSUnitValue) {
                // Only fold identical units, not compatible ones (e.g., don't fold % and px)
                bucket[arg.unit] = (bucket[arg.unit] || 0) + arg.value;
            } else {
                complex.push(arg);
            }
        }

        const folded = [];
        for (let u in bucket) {
            folded.push(new CSSUnitValue(bucket[u], u));
        }

        const result = [...folded, ...complex];
        if (result.length === 0) return new CSSUnitValue(0, 'number');
        if (result.length === 1 && complex.length === 0) return result[0];

        return result;
    }

    function simplifyProduct(args) {
        if (args.some(a => a instanceof CSSVariableReferenceValue)) return null;

        let scalar = 1;
        let unitVal = null;
        let sumNode = null;
        let other = [];

        for (let arg of args) {
            let val = null;

            // Resolve scalars (including Invert/Negate)
            if (arg instanceof CSSUnitValue && arg.unit === 'number') {
                val = arg.value;
            } else if (arg instanceof CSSMathNegate &&
                arg.value instanceof CSSUnitValue &&
                arg.value.unit === 'number') {
                val = -arg.value.value;
            } else if (arg instanceof CSSMathInvert &&
                arg.value instanceof CSSUnitValue &&
                arg.value.unit === 'number') {
                if (arg.value.value === 0) {
                    throw new RangeError("Division by zero");
                }
                val = 1 / arg.value.value;
            }

            if (val !== null) {
                scalar *= val;
                continue;
            }

            if (arg instanceof CSSUnitValue) {
                if (unitVal) {
                    other.push(arg); // Multiple dimensions
                } else {
                    unitVal = arg;
                }
            } else if (arg instanceof CSSMathSum) {
                if (sumNode) {
                    other.push(arg);
                } else {
                    sumNode = arg;
                }
            } else {
                other.push(arg);
            }
        }

        if (scalar === 0) return new CSSUnitValue(0, 'number');
        if (!unitVal && !sumNode && other.length === 0) {
            return new CSSUnitValue(scalar, 'number');
        }
        if (unitVal && !sumNode && other.length === 0) {
            return new CSSUnitValue(unitVal.value * scalar, unitVal.unit);
        }

        // Distribution: (A + B) * s
        if (sumNode && !unitVal && other.length === 0 && scalar !== 1) {
            const distributed = sumNode.values.map(t =>
                t.mul(new CSSUnitValue(scalar, 'number'))
            );
            return new CSSMathSum(...distributed);
        }

        return null;
    }

    // --- 3. The Lexer (Moonlight Scanner) ---
    const TT = {
        EOF: 0, ERR: 1, NUM: 2, DIM: 3, OP: 4,
        OPEN: 5, CLOSE: 6, COMMA: 7, IDENT: 8, FUNC: 9
    };

    class Scanner {
        constructor(text) {
            this.text = text;
            this.len = text.length;
            this.pos = 0;
            this.type = TT.EOF;
            this.str = '';
            this.num = 0;
            this.unit = '';
            this.raw = '';
        }

        scan() {
            // Skip whitespace
            while (this.pos < this.len && this.text.charCodeAt(this.pos) <= 32) {
                this.pos++;
            }

            if (this.pos >= this.len) {
                this.type = TT.EOF;
                return;
            }

            const start = this.pos;
            const c = this.text.charCodeAt(this.pos);

            // Operators & Punctuation
            if (c === 40) { // (
                this.type = TT.OPEN;
                this.pos++;
                this.raw = '(';
                return;
            }
            if (c === 41) { // )
                this.type = TT.CLOSE;
                this.pos++;
                this.raw = ')';
                return;
            }
            if (c === 44) { // ,
                this.type = TT.COMMA;
                this.pos++;
                this.raw = ',';
                return;
            }
            if (c === 42 || c === 47 || c === 43) { // * / +
                this.type = TT.OP;
                this.str = this.text[this.pos++];
                this.raw = this.str;
                return;
            }

            // Minus (could be OP or start of IDENT/NUM)
            if (c === 45) { // -
                const next = this.pos + 1;
                if (next < this.len) {
                    const c2 = this.text.charCodeAt(next);
                    if ((c2 >= 48 && c2 <= 57) || c2 === 46) { // digit or .
                        this._number();
                        return;
                    }
                    if (c2 === 45 || this._isIdentStart(c2)) { // --custom or -webkit
                        this._ident();
                        return;
                    }
                }
                this.type = TT.OP;
                this.str = '-';
                this.pos++;
                this.raw = '-';
                return;
            }

            if ((c >= 48 && c <= 57) || c === 46) { // digit or .
                this._number();
                return;
            }
            if (this._isIdentStart(c)) {
                this._ident();
                return;
            }

            this.type = TT.ERR;
            this.str = this.text[this.pos++];
            this.raw = this.str;
        }

        _number() {
            const start = this.pos;

            // Sign
            if (this.text[this.pos] === '+' || this.text[this.pos] === '-') {
                this.pos++;
            }

            // Integer and decimal part
            let hasDigit = false;
            while (this.pos < this.len) {
                const c = this.text.charCodeAt(this.pos);
                if (c >= 48 && c <= 57) { // 0-9
                    this.pos++;
                    hasDigit = true;
                } else if (c === 46) { // .
                    this.pos++;
                } else {
                    break;
                }
            }

            // Scientific notation
            if (this.pos < this.len) {
                const c = this.text.charCodeAt(this.pos);
                if (c === 69 || c === 101) { // E or e
                    let p = this.pos + 1;
                    if (p < this.len &&
                        (this.text.charCodeAt(p) === 43 ||
                            this.text.charCodeAt(p) === 45)) { // + or -
                        p++;
                    }
                    const sciStart = p;
                    while (p < this.len &&
                        this.text.charCodeAt(p) >= 48 &&
                        this.text.charCodeAt(p) <= 57) {
                        p++;
                    }
                    if (p > sciStart) { // Valid scientific notation
                        this.pos = p;
                    }
                }
            }

            const numStr = this.text.slice(start, this.pos);
            this.num = parseFloat(numStr);

            if (!isFinite(this.num)) {
                throw new TypeError(`Invalid number: ${numStr}`);
            }

            // Unit
            const uStart = this.pos;
            if (this.pos < this.len && this.text.charCodeAt(this.pos) === 37) { // %
                this.pos++;
                this.type = TT.DIM;
                this.unit = 'percent';
            } else {
                while (this.pos < this.len &&
                    this._isIdentChar(this.text.charCodeAt(this.pos))) {
                    this.pos++;
                }
                const rawUnit = this.text.slice(uStart, this.pos).toLowerCase();

                if (!rawUnit) {
                    this.type = TT.NUM;
                    this.unit = 'number';
                } else {
                    if (!UNIT_MAP.hasOwnProperty(rawUnit)) {
                        throw new TypeError(`Invalid unit: ${rawUnit}`);
                    }
                    this.type = TT.DIM;
                    this.unit = rawUnit;
                }
            }

            this.raw = this.text.slice(start, this.pos);
        }

        _ident() {
            const start = this.pos;

            while (this.pos < this.len &&
                this._isIdentChar(this.text.charCodeAt(this.pos))) {
                this.pos++;
            }

            this.str = this.text.slice(start, this.pos);

            // Lookahead for Function
            let p = this.pos;
            while (p < this.len && this.text.charCodeAt(p) <= 32) p++;

            if (p < this.len && this.text.charCodeAt(p) === 40) { // (
                this.pos = p + 1; // Consume '('
                this.type = TT.FUNC;
                this.str = this.str.toLowerCase();
                this.raw = this.text.slice(start, this.pos);
            } else {
                this.type = TT.IDENT;
                this.raw = this.str;
            }
        }

        _isIdentStart(c) {
            return (c >= 65 && c <= 90) ||   // A-Z
                (c >= 97 && c <= 122) ||  // a-z
                c === 95 ||               // _
                c === 45 ||               // -
                c > 127;                  // Non-ASCII
        }

        _isIdentChar(c) {
            return this._isIdentStart(c) ||
                (c >= 48 && c <= 57);     // 0-9
        }
    }

    // --- 4. CSS Typed OM Core Classes ---

    class CSSStyleValue {
        constructor() {
            if (this.constructor === CSSStyleValue) {
                throw new TypeError("CSSStyleValue is an abstract class");
            }
        }

        toString() { return ''; }

        static parse(prop, val) {
            return Parser.parse(prop, val);
        }

        static parseAll(prop, val) {
            return [Parser.parse(prop, val)];
        }
    }

    class CSSNumericValue extends CSSStyleValue {
        add(...args) {
            return new CSSMathSum(this, ...args);
        }

        sub(...args) {
            return new CSSMathSum(
                this,
                ...args.map(a => CSSNumericValue.from(a).negate())
            );
        }

        mul(...args) {
            return new CSSMathProduct(this, ...args);
        }

        div(...args) {
            return new CSSMathProduct(
                this,
                ...args.map(a => CSSNumericValue.from(a).invert())
            );
        }

        min(...args) {
            return new CSSMathMin(this, ...args);
        }

        max(...args) {
            return new CSSMathMax(this, ...args);
        }

        negate() {
            return new CSSMathNegate(this);
        }

        invert() {
            return new CSSMathInvert(this);
        }

        to(unit) {
            if (this instanceof CSSUnitValue && this.unit === unit) {
                return this;
            }
            // Simplified conversion - full implementation would handle unit conversion
            return new CSSUnitValue(this.value, unit);
        }

        type() {
            throw new Error("type() method not implemented in subclass");
        }

        static from(v) {
            if (v instanceof CSSNumericValue) return v;
            if (typeof v === 'number') return new CSSUnitValue(v, 'number');
            if (v instanceof CSSVariableReferenceValue) {
                // Allow variables in numeric contexts
                return v;
            }
            throw new TypeError(
                `Cannot convert to CSSNumericValue: ${v}`
            );
        }
    }

    class CSSUnitValue extends CSSNumericValue {
        constructor(val, unit) {
            super();
            if (typeof val !== 'number') {
                throw new TypeError("Value must be a number");
            }
            if (!isFinite(val)) {
                throw new TypeError("Value must be finite");
            }
            if (typeof unit !== 'string') {
                throw new TypeError("Unit must be a string");
            }
            if (!UNIT_MAP.hasOwnProperty(unit)) {
                throw new TypeError(`Invalid unit: ${unit}`);
            }

            this.value = val;
            this.unit = unit;
        }

        toString() {
            // Better precision handling
            let s = this.value;

            // Round to 6 decimal places, but remove trailing zeros
            if (Math.abs(s) < 1e10 && Math.abs(s) > 1e-6) {
                s = Math.round(s * 1e6) / 1e6;
            }

            const str = String(s);

            if (this.unit === 'number') {
                return str;
            } else if (this.unit === 'percent') {
                return str + '%';
            } else {
                return str + this.unit;
            }
        }

        type() {
            return createType(this.unit);
        }
    }

    class CSSVariableReferenceValue extends CSSStyleValue {
        constructor(variable, fallback = null) {
            super();

            if (typeof variable !== 'string') {
                throw new TypeError("Variable must be a string");
            }

            this.variable = variable;
            this.fallback = fallback;
        }

        toString() {
            return `var(${this.variable}${this.fallback ? ', ' + this.fallback.toString() : ''
                })`;
        }

        type() {
            return {};
        }

        // Math Interop
        add(...args) { return new CSSMathSum(this, ...args); }
        mul(...args) { return new CSSMathProduct(this, ...args); }
        sub(...args) {
            return new CSSMathSum(
                this,
                ...args.map(a => CSSNumericValue.from(a).negate())
            );
        }
        div(...args) {
            return new CSSMathProduct(
                this,
                ...args.map(a => CSSNumericValue.from(a).invert())
            );
        }
        negate() { return new CSSMathNegate(this); }
        invert() { return new CSSMathInvert(this); }
    }

    class CSSUnparsedValue extends CSSStyleValue {
        constructor(members) {
            super();

            if (!Array.isArray(members)) {
                throw new TypeError("Members must be an array");
            }

            this.members = members;
        }

        toString() {
            return this.members.join('');
        }

        [Symbol.iterator]() {
            return this.members[Symbol.iterator]();
        }

        get length() {
            return this.members.length;
        }
    }

    class CSSKeywordValue extends CSSStyleValue {
        constructor(value) {
            super();

            if (typeof value !== 'string') {
                throw new TypeError("Keyword value must be a string");
            }

            this.value = value;
        }

        toString() {
            return this.value;
        }
    }

    // --- 5. Math Objects ---

    const fmt = (v) => {
        let s = v.toString();
        return s.startsWith('calc(') ? s.slice(5, -1) : s;
    };

    const wrap = (v) => {
        return (v instanceof CSSMathSum || v instanceof CSSMathNegate)
            ? `(${fmt(v)})`
            : fmt(v);
    };

    class CSSMathValue extends CSSNumericValue { }

    class CSSMathSum extends CSSMathValue {
        constructor(...args) {
            super();

            if (args.length === 0) {
                throw new TypeError("CSSMathSum requires at least one argument");
            }

            const input = args.map(CSSNumericValue.from);
            const sim = simplifySum(input, true);

            if (sim instanceof CSSUnitValue) {
                // Return the simplified unit value directly
                return sim;
            } else if (Array.isArray(sim)) {
                // Store the array directly to avoid recursion
                this.values = sim;
            } else {
                // Single value
                this.values = [sim];
            }
        }

        toString() {
            if (!this.values || this.values.length === 0) {
                return 'calc(0)';
            }

            const parts = this.values.map((v, i) => {
                if (i === 0) {
                    return fmt(v);
                } else if (v instanceof CSSMathNegate) {
                    return ' - ' + fmt(v.value);
                } else {
                    return ' + ' + fmt(v);
                }
            });

            return `calc(${parts.join('')})`;
        }

        type() {
            if (!this.values || this.values.length === 0) {
                return { ...BASE_TYPES };
            }

            // Merge types: if any value has percent OR length, result has both
            let hasPercent = false;
            let hasLength = false;
            const result = { ...BASE_TYPES };

            for (let v of this.values) {
                if (v && v.type) {
                    const t = v.type();
                    if (t.percent > 0) hasPercent = true;
                    if (t.length > 0) hasLength = true;

                    // Merge other dimensions
                    for (let key in BASE_TYPES) {
                        if (key === 'percent' || key === 'length') continue;
                        if (t[key] > 0) result[key] = Math.max(result[key], t[key]);
                    }
                }
            }

            // If we have both percent and length, set both flags
            // This represents calc(% ± length) which is valid
            if (hasPercent || hasLength) {
                result.percent = hasPercent ? 1 : 0;
                result.length = hasLength ? 1 : 0;
            }

            return result;
        }
    }

    class CSSMathProduct extends CSSMathValue {
        constructor(...args) {
            super();

            if (args.length === 0) {
                throw new TypeError("CSSMathProduct requires at least one argument");
            }

            this.values = args.map(CSSNumericValue.from);
            const sim = simplifyProduct(this.values);

            if (sim) {
                return sim;
            }
        }

        toString() {
            let n = [], d = [];

            this.values.forEach(v => {
                if (v instanceof CSSMathInvert) {
                    d.push(v.value);
                } else {
                    n.push(v);
                }
            });

            if (!n.length) {
                n.push(new CSSUnitValue(1, 'number'));
            }

            const ns = n.map(wrap).join(' * ');
            const ds = d.map(wrap).join(' * ');

            if (!ds) {
                return `calc(${ns})`;
            } else {
                return `calc(${ns} / ${d.length > 1 ? `(${ds})` : ds})`;
            }
        }

        type() {
            return this.values.reduce((acc, v) => {
                if (v && v.type) {
                    return Object.assign(acc, v.type());
                }
                return acc;
            }, { ...BASE_TYPES });
        }
    }

    class CSSMathNegate extends CSSMathValue {
        constructor(v) {
            super();

            this.value = CSSNumericValue.from(v);

            // Simplification
            if (this.value instanceof CSSUnitValue) {
                return new CSSUnitValue(-this.value.value, this.value.unit);
            }
            if (this.value instanceof CSSMathNegate) {
                return this.value.value;
            }
        }

        toString() {
            return `calc(-1 * ${wrap(this.value)})`;
        }

        type() {
            return this.value.type ? this.value.type() : {};
        }
    }

    class CSSMathInvert extends CSSMathValue {
        constructor(v) {
            super();

            this.value = CSSNumericValue.from(v);

            // Simplification
            if (this.value instanceof CSSUnitValue &&
                this.value.unit === 'number') {
                if (this.value.value === 0) {
                    throw new RangeError("Cannot invert zero");
                }
                return new CSSUnitValue(1 / this.value.value, 'number');
            }
        }

        toString() {
            return `calc(1 / ${wrap(this.value)})`;
        }

        type() {
            return {};
        }
    }

    class CSSMathMin extends CSSMathValue {
        constructor(...args) {
            super();

            if (args.length === 0) {
                throw new TypeError("CSSMathMin requires at least one argument");
            }

            this.values = args.map(CSSNumericValue.from);
        }

        toString() {
            return `min(${this.values.map(v => v.toString()).join(', ')})`;
        }

        type() {
            return this.values[0] && this.values[0].type
                ? this.values[0].type()
                : {};
        }
    }

    class CSSMathMax extends CSSMathValue {
        constructor(...args) {
            super();

            if (args.length === 0) {
                throw new TypeError("CSSMathMax requires at least one argument");
            }

            this.values = args.map(CSSNumericValue.from);
        }

        toString() {
            return `max(${this.values.map(v => v.toString()).join(', ')})`;
        }

        type() {
            return this.values[0] && this.values[0].type
                ? this.values[0].type()
                : {};
        }
    }

    class CSSMathClamp extends CSSMathValue {
        constructor(min, val, max) {
            super();

            this.lower = CSSNumericValue.from(min);
            this.value = CSSNumericValue.from(val);
            this.upper = CSSNumericValue.from(max);
        }

        toString() {
            return `clamp(${this.lower}, ${this.value}, ${this.upper})`;
        }

        type() {
            return this.value.type ? this.value.type() : {};
        }
    }

    // --- 6. Transforms ---

    class CSSTransformComponent extends CSSStyleValue {
        constructor() {
            super();
            this.is2D = true;
        }

        toMatrix() {
            if (typeof DOMMatrix !== 'undefined') {
                return new DOMMatrix(this.toString());
            }
            throw new Error("DOMMatrix not available");
        }
    }

    class CSSTranslate extends CSSTransformComponent {
        constructor(x, y, z) {
            super();
            this.x = CSSNumericValue.from(x);
            this.y = CSSNumericValue.from(y);
            this.z = z ? CSSNumericValue.from(z) : new CSSUnitValue(0, 'px');
            this.is2D = !z || (z instanceof CSSUnitValue && z.value === 0);
        }
        toString() {
            return this.is2D
                ? `translate(${this.x}, ${this.y})`
                : `translate3d(${this.x}, ${this.y}, ${this.z})`;
        }
    }

    class CSSRotate extends CSSTransformComponent {
        constructor(...args) {
            super();

            if (args.length === 1) {
                this.x = new CSSUnitValue(0, 'number');
                this.y = new CSSUnitValue(0, 'number');
                this.z = new CSSUnitValue(1, 'number');
                this.angle = CSSNumericValue.from(args[0]);
                this.is2D = true;
            } else if (args.length === 4) {
                this.x = CSSNumericValue.from(args[0]);
                this.y = CSSNumericValue.from(args[1]);
                this.z = CSSNumericValue.from(args[2]);
                this.angle = CSSNumericValue.from(args[3]);
                this.is2D = false;
            } else {
                throw new TypeError(
                    "CSSRotate requires 1 or 4 arguments"
                );
            }
        }

        toString() {
            return this.is2D
                ? `rotate(${this.angle})`
                : `rotate3d(${this.x}, ${this.y}, ${this.z}, ${this.angle})`;
        }
    }

    class CSSScale extends CSSTransformComponent {
        constructor(x, y, z) {
            super();
            this.x = CSSNumericValue.from(x);
            this.y = CSSNumericValue.from(y !== undefined ? y : x);
            this.z = z ? CSSNumericValue.from(z) : new CSSUnitValue(1, 'number');
            this.is2D = !z || (z instanceof CSSUnitValue && z.value === 1);
        }

        toString() {
            return this.is2D
                ? `scale(${this.x}, ${this.y})`
                : `scale3d(${this.x}, ${this.y}, ${this.z})`;
        }
    }

    class CSSSkew extends CSSTransformComponent {
        constructor(x, y) {
            super();
            this.ax = CSSNumericValue.from(x);
            this.ay = CSSNumericValue.from(y);
        }

        toString() {
            return `skew(${this.ax}, ${this.ay})`;
        }
    }

    class CSSSkewX extends CSSTransformComponent {
        constructor(x) {
            super();
            this.ax = CSSNumericValue.from(x);
        }

        toString() {
            return `skewX(${this.ax})`;
        }
    }

    class CSSSkewY extends CSSTransformComponent {
        constructor(y) {
            super();
            this.ay = CSSNumericValue.from(y);
        }

        toString() {
            return `skewY(${this.ay})`;
        }
    }

    class CSSPerspective extends CSSTransformComponent {
        constructor(length) {
            super();
            this.length = CSSNumericValue.from(length);
        }

        toString() {
            return `perspective(${this.length})`;
        }
    }

    class CSSMatrixComponent extends CSSTransformComponent {
        constructor(a, b, c, d, e, f) {
            super();
            this.a = CSSNumericValue.from(a);
            this.b = CSSNumericValue.from(b);
            this.c = CSSNumericValue.from(c);
            this.d = CSSNumericValue.from(d);
            this.e = CSSNumericValue.from(e);
            this.f = CSSNumericValue.from(f);
            this.is2D = true;
        }

        toString() {
            return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
        }
    }

    class CSSTransformValue extends CSSStyleValue {
        constructor(transforms) {
            super();

            if (!Array.isArray(transforms)) {
                throw new TypeError("Transforms must be an array");
            }

            this.length = transforms.length;
            this.is2D = transforms.every(c => c.is2D);

            for (let i = 0; i < transforms.length; i++) {
                this[i] = transforms[i];
            }
        }

        toString() {
            return Array.from(this).map(t => t.toString()).join(' ');
        }

        [Symbol.iterator]() {
            let i = 0;
            const self = this;
            return {
                next: () => ({
                    value: self[i],
                    done: i++ >= self.length
                })
            };
        }

        toMatrix() {
            if (typeof DOMMatrix === 'undefined') {
                throw new Error("DOMMatrix not available");
            }

            let m = new DOMMatrix();
            for (let i = 0; i < this.length; i++) {
                m = m.multiply(this[i].toMatrix());
            }
            return m;
        }
    }

    // --- 7. Parser ---

    const Parser = {
        parse(prop, text) {
            text = String(text).trim();

            if (!text) {
                throw new TypeError(`Empty value for property "${prop}"`);
            }

            // Special handling for transform
            if (prop === 'transform') {
                try {
                    return this.parseTransform(text);
                } catch (e) {
                    if (STRICT_PROPS[prop] && !text.includes('var(')) {
                        throw new TypeError(`Invalid transform: ${text}`);
                    }
                    return new CSSUnparsedValue([text]);
                }
            }

            try {
                const s = new Scanner(text);
                s.scan();
                const res = this.expr(s);

                if (s.type !== TT.EOF) {
                    throw new Error("Unexpected tokens after expression");
                }

                return res;
            } catch (e) {
                // Strict properties must parse correctly unless they contain variables
                if (STRICT_PROPS[prop] && !text.includes('var(')) {
                    throw new TypeError(
                        `Invalid value for ${prop}: ${text}. Error: ${e.message}`
                    );
                }

                // Fallback to unparsed value
                return new CSSUnparsedValue([text]);
            }
        },

        expr(s) {
            let left = this.term(s);

            while (s.type === TT.OP && (s.str === '+' || s.str === '-')) {
                const op = s.str;
                s.scan();
                const right = this.term(s);

                left = (op === '+')
                    ? new CSSMathSum(left, right)
                    : new CSSMathSum(left, new CSSMathNegate(right));
            }

            return left;
        },

        term(s) {
            let left = this.unary(s);

            while (s.type === TT.OP && (s.str === '*' || s.str === '/')) {
                const op = s.str;
                s.scan();
                const right = this.unary(s);

                left = (op === '*')
                    ? new CSSMathProduct(left, right)
                    : new CSSMathProduct(left, new CSSMathInvert(right));
            }

            return left;
        },

        unary(s) {
            // Handle unary minus
            if (s.type === TT.OP && s.str === '-') {
                s.scan();
                return new CSSMathNegate(this.unary(s));
            }

            // Handle unary plus (just ignore it)
            if (s.type === TT.OP && s.str === '+') {
                s.scan();
                return this.unary(s);
            }

            return this.factor(s);
        },

        factor(s) {
            // Numbers and dimensions
            if (s.type === TT.NUM || s.type === TT.DIM) {
                const n = new CSSUnitValue(s.num, s.unit);
                s.scan();
                return n;
            }

            // Parentheses
            if (s.type === TT.OPEN) {
                s.scan();
                const n = this.expr(s);

                if (s.type !== TT.CLOSE) {
                    throw new Error("Expected closing parenthesis");
                }

                s.scan();
                return n;
            }

            // Functions
            if (s.type === TT.FUNC) {
                const name = s.str;
                const funcStart = s.pos;
                s.scan(); // consume 'func('

                // Special handling for var()
                if (name === 'var') {
                    if (s.type !== TT.IDENT) {
                        throw new Error("Expected variable name after var(");
                    }

                    const varName = s.str;
                    s.scan();

                    let fallback = null;

                    if (s.type === TT.COMMA) {
                        s.scan();

                        // Capture fallback using text slicing to preserve format
                        const fbStart = s.pos;
                        let balance = 0;

                        while (s.type !== TT.EOF) {
                            if (s.type === TT.CLOSE && balance === 0) {
                                break;
                            }

                            if (s.type === TT.OPEN) {
                                balance++;
                            } else if (s.type === TT.FUNC) {
                                balance++;
                            } else if (s.type === TT.CLOSE) {
                                balance--;
                            }

                            s.scan();
                        }

                        const fbEnd = s.pos;
                        const fbText = s.text.slice(fbStart, fbEnd).trim();

                        if (fbText) {
                            fallback = new CSSUnparsedValue([fbText]);
                        }
                    }

                    if (s.type !== TT.CLOSE) {
                        throw new Error("Expected closing parenthesis for var()");
                    }

                    s.scan();
                    return new CSSVariableReferenceValue(varName, fallback);
                }

                // Other functions
                const args = [];

                if (s.type !== TT.CLOSE) {
                    while (true) {
                        args.push(this.expr(s));

                        if (s.type === TT.COMMA) {
                            s.scan();
                        } else {
                            break;
                        }
                    }
                }

                if (s.type !== TT.CLOSE) {
                    throw new Error(`Expected closing parenthesis for ${name}()`);
                }

                s.scan(); // consume ')'

                // Handle different function types
                if (name === 'calc') {
                    if (args.length !== 1) {
                        throw new Error("calc() requires exactly one argument");
                    }
                    return args[0];
                }

                if (name === 'min') {
                    if (args.length === 0) {
                        throw new Error("min() requires at least one argument");
                    }
                    return new CSSMathMin(...args);
                }

                if (name === 'max') {
                    if (args.length === 0) {
                        throw new Error("max() requires at least one argument");
                    }
                    return new CSSMathMax(...args);
                }

                if (name === 'clamp') {
                    if (args.length !== 3) {
                        throw new Error("clamp() requires exactly 3 arguments");
                    }
                    return new CSSMathClamp(args[0], args[1], args[2]);
                }

                throw new Error(`Unknown function: ${name}()`);
            }

            // Keywords
            if (s.type === TT.IDENT) {
                const v = new CSSKeywordValue(s.str);
                s.scan();
                return v;
            }

            throw new Error(
                `Unexpected token: ${s.type} (${s.str || s.raw || 'EOF'})`
            );
        },

        parseTransform(text) {
            const s = new Scanner(text);
            s.scan();
            const list = [];

            while (s.type !== TT.EOF) {
                if (s.type !== TT.FUNC) {
                    throw new Error(
                        `Expected transform function, got: ${s.type}`
                    );
                }

                const name = s.str;
                s.scan();

                const args = [];

                if (s.type !== TT.CLOSE) {
                    while (true) {
                        args.push(this.expr(s));

                        if (s.type === TT.COMMA) {
                            s.scan();
                        } else {
                            break;
                        }
                    }
                }

                if (s.type !== TT.CLOSE) {
                    throw new Error(
                        `Expected closing parenthesis for ${name}()`
                    );
                }

                s.scan();

                // Create appropriate transform component
                if (name === 'translate' || name === 'translate3d') {
                    list.push(new CSSTranslate(
                        args[0],
                        args[1] || new CSSUnitValue(0, 'px'),
                        args[2]
                    ));
                } else if (name === 'translatex') {
                    list.push(new CSSTranslate(
                        args[0],
                        new CSSUnitValue(0, 'px')
                    ));
                } else if (name === 'translatey') {
                    list.push(new CSSTranslate(
                        new CSSUnitValue(0, 'px'),
                        args[0]
                    ));
                } else if (name === 'translatez') {
                    list.push(new CSSTranslate(
                        new CSSUnitValue(0, 'px'),
                        new CSSUnitValue(0, 'px'),
                        args[0]
                    ));
                } else if (name === 'rotate' || name === 'rotate3d') {
                    if (args.length === 1) {
                        list.push(new CSSRotate(args[0]));
                    } else if (args.length === 4) {
                        list.push(new CSSRotate(args[0], args[1], args[2], args[3]));
                    } else {
                        throw new Error(
                            `Invalid number of arguments for ${name}()`
                        );
                    }
                } else if (name === 'rotatex') {
                    list.push(new CSSRotate(
                        new CSSUnitValue(1, 'number'),
                        new CSSUnitValue(0, 'number'),
                        new CSSUnitValue(0, 'number'),
                        args[0]
                    ));
                } else if (name === 'rotatey') {
                    list.push(new CSSRotate(
                        new CSSUnitValue(0, 'number'),
                        new CSSUnitValue(1, 'number'),
                        new CSSUnitValue(0, 'number'),
                        args[0]
                    ));
                } else if (name === 'rotatez') {
                    list.push(new CSSRotate(args[0]));
                } else if (name === 'scale' || name === 'scale3d') {
                    list.push(new CSSScale(args[0], args[1], args[2]));
                } else if (name === 'scalex') {
                    list.push(new CSSScale(
                        args[0],
                        new CSSUnitValue(1, 'number')
                    ));
                } else if (name === 'scaley') {
                    list.push(new CSSScale(
                        new CSSUnitValue(1, 'number'),
                        args[0]
                    ));
                } else if (name === 'scalez') {
                    list.push(new CSSScale(
                        new CSSUnitValue(1, 'number'),
                        new CSSUnitValue(1, 'number'),
                        args[0]
                    ));
                } else if (name === 'skew') {
                    list.push(new CSSSkew(
                        args[0],
                        args[1] || new CSSUnitValue(0, 'deg')
                    ));
                } else if (name === 'skewx') {
                    list.push(new CSSSkewX(args[0]));
                } else if (name === 'skewy') {
                    list.push(new CSSSkewY(args[0]));
                } else if (name === 'perspective') {
                    list.push(new CSSPerspective(args[0]));
                } else if (name === 'matrix') {
                    if (args.length === 6) {
                        list.push(new CSSMatrixComponent(
                            args[0], args[1], args[2],
                            args[3], args[4], args[5]
                        ));
                    } else {
                        throw new Error("matrix() requires 6 arguments");
                    }
                } else {
                    throw new Error(`Unknown transform function: ${name}()`);
                }
            }

            return new CSSTransformValue(list);
        }
    };

    // --- 8. DOM Integration ---

    const toKebab = (prop) => {
        let cached = KEBAB_CACHE.get(prop);
        if (cached !== undefined) return cached;

        const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        KEBAB_CACHE.set(prop, kebab);
        return kebab;
    };

    const COMMA_SEPARATED_PROPS = {
        'transition': 1,
        'animation': 1,
        'box-shadow': 1,
        'text-shadow': 1,
        'background': 1,
        'background-image': 1,
        'font-family': 1,
        'stroke-dasharray': 1,
        'transform': 0  // Space-separated
    };

    class StylePropertyMapReadOnly {
        constructor(element) {
            if (!element || !element.style) {
                throw new TypeError("Element must have a style property");
            }

            this._el = element;
            this._style = element.style;
        }

        get(prop) {
            const kProp = toKebab(prop);
            const val = this._style.getPropertyValue(kProp);

            if (!val) return null;

            try {
                return Parser.parse(kProp, val);
            } catch (e) {
                console.warn(`Moonlight: Parse error for ${kProp}:`, e.message);
                return new CSSUnparsedValue([val]);
            }
        }

        getAll(prop) {
            const kProp = toKebab(prop);
            const val = this._style.getPropertyValue(kProp);

            if (!val) return [];

            try {
                // For comma-separated properties, split and parse each
                if (COMMA_SEPARATED_PROPS[kProp]) {
                    const parts = val.split(',').map(p => p.trim());
                    return parts.map(p => {
                        try {
                            return Parser.parse(kProp, p);
                        } catch (e) {
                            return new CSSUnparsedValue([p]);
                        }
                    });
                }

                return [Parser.parse(kProp, val)];
            } catch (e) {
                return [new CSSUnparsedValue([val])];
            }
        }

        has(prop) {
            return !!this._style.getPropertyValue(toKebab(prop));
        }

        get size() {
            return this._style.length;
        }

        *entries() {
            for (let i = 0; i < this._style.length; i++) {
                const p = this._style[i];
                const v = this.get(p);
                if (v !== null) {
                    yield [p, v];
                }
            }
        }

        *keys() {
            for (let i = 0; i < this._style.length; i++) {
                yield this._style[i];
            }
        }

        *values() {
            for (let i = 0; i < this._style.length; i++) {
                const v = this.get(this._style[i]);
                if (v !== null) {
                    yield v;
                }
            }
        }

        forEach(callback, thisArg) {
            for (let i = 0; i < this._style.length; i++) {
                const p = this._style[i];
                const v = this.get(p);
                if (v !== null) {
                    callback.call(thisArg, v, p, this);
                }
            }
        }

        [Symbol.iterator]() {
            return this.entries();
        }
    }

    class StylePropertyMap extends StylePropertyMapReadOnly {
        set(prop, ...values) {
            const kProp = toKebab(prop);

            if (values.length === 0) {
                throw new TypeError(
                    "Failed to execute 'set': 1 argument required, but only 0 present."
                );
            }

            const valStr = values.map(v => {
                if (v && typeof v.toString === 'function') {
                    return v.toString();
                }
                return String(v);
            }).join(' ');

            this._style.setProperty(kProp, valStr);
        }

        append(prop, ...values) {
            const kProp = toKebab(prop);

            if (values.length === 0) {
                throw new TypeError(
                    "Failed to execute 'append': 1 argument required."
                );
            }

            const newPart = values.map(v => {
                if (v && typeof v.toString === 'function') {
                    return v.toString();
                }
                return String(v);
            }).join(' ');

            const current = this._style.getPropertyValue(kProp);

            if (!current) {
                this._style.setProperty(kProp, newPart);
            } else {
                const separator = COMMA_SEPARATED_PROPS[kProp] ? ', ' : ' ';
                this._style.setProperty(kProp, current + separator + newPart);
            }
        }

        delete(prop) {
            const kProp = toKebab(prop);
            this._style.removeProperty(kProp);
        }

        clear() {
            this._style.cssText = '';
        }
    }

    // Install attributeStyleMap on HTMLElement
    if (typeof HTMLElement !== 'undefined' &&
        !HTMLElement.prototype.hasOwnProperty('attributeStyleMap')) {
        const mapCache = new WeakMap();

        Object.defineProperty(HTMLElement.prototype, 'attributeStyleMap', {
            enumerable: true,
            configurable: true,
            get() {
                if (!mapCache.has(this)) {
                    mapCache.set(this, new StylePropertyMap(this));
                }
                return mapCache.get(this);
            }
        });
    }

    // --- 9. Exports ---

    const exports = {
        // Core
        CSSStyleValue,
        CSSNumericValue,
        CSSUnitValue,
        CSSKeywordValue,
        CSSUnparsedValue,
        CSSVariableReferenceValue,

        // Math
        CSSMathValue,
        CSSMathSum,
        CSSMathProduct,
        CSSMathNegate,
        CSSMathInvert,
        CSSMathMin,
        CSSMathMax,
        CSSMathClamp,

        // Transform
        CSSTransformValue,
        CSSTransformComponent,
        CSSTranslate,
        CSSRotate,
        CSSScale,
        CSSSkew,
        CSSSkewX,
        CSSSkewY,
        CSSPerspective,
        CSSMatrixComponent,

        // Maps
        StylePropertyMap,
        StylePropertyMapReadOnly
    };

    for (let k in exports) global[k] ??= exports[k];

    // CSS Namespace
    global.CSS = global.CSS || {};

    // Create factory methods for all units
    for (let u in UNIT_MAP) u && (global.CSS[u] = v => new CSSUnitValue(v, u));
})(typeof window !== 'undefined' ? window : this);