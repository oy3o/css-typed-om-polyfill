(function () {
    'use strict'

    console.log('CSS Typed OM Polyfill: Initializing...')

    // --- Helper: Simple unit definitions ---
    const LENGTH_UNITS = ['px', 'em', 'rem', 'vw', 'vh', 'vmin', 'vmax', 'cm', 'mm', 'in', 'pt', 'pc', 'ch', 'ex', 'cap', 'ic', 'lh', 'rlh', 'q']
    const ANGLE_UNITS = ['deg', 'rad', 'grad', 'turn']
    const TIME_UNITS = ['s', 'ms']
    const FREQUENCY_UNITS = ['hz', 'khz']
    const RESOLUTION_UNITS = ['dpi', 'dpcm', 'dppx']
    const FLEX_UNITS = ['fr']
    const PERCENTAGE_UNIT = ['%']
    const NUMBER_UNIT_TYPE = 'number'

    const ALL_UNITS = [
        ...LENGTH_UNITS, ...ANGLE_UNITS, ...TIME_UNITS,
        ...FREQUENCY_UNITS, ...RESOLUTION_UNITS, ...FLEX_UNITS, PERCENTAGE_UNIT[0]
    ]

    function getUnitCategory(unit) {
        if (typeof unit !== 'string') return 'unknown'
        unit = unit.toLowerCase()
        if (LENGTH_UNITS.includes(unit)) return 'length'
        if (ANGLE_UNITS.includes(unit)) return 'angle'
        if (TIME_UNITS.includes(unit)) return 'time'
        if (FREQUENCY_UNITS.includes(unit)) return 'frequency'
        if (RESOLUTION_UNITS.includes(unit)) return 'resolution'
        if (FLEX_UNITS.includes(unit)) return 'flex'
        if (PERCENTAGE_UNIT.includes(unit)) return 'percent'
        if (unit === NUMBER_UNIT_TYPE) return NUMBER_UNIT_TYPE
        return 'unknown'
    }

    const conversionRates = {
        time: { ms: 1, s: 1000 },
        angle: { deg: 1, rad: 180 / Math.PI, grad: 400 / 360, turn: 360 },
    }

    // --- CSSStyleValue (Base Class) ---
    class CSSStyleValue {
        constructor() {
            if (this.constructor === CSSStyleValue) {
                throw new TypeError("Illegal constructor: CSSStyleValue is an abstract base class.")
            }
        }
    }

    // --- Simple Numeric Value Parser ---
    function parseSimpleCssNumericValue(text) {
        text = text.trim()
        const unitMatch = text.match(/^(-?(?:\d*\.\d+|\d+\.?\d*))(%|[a-zA-Z]+)?$/)
        if (unitMatch) {
            const value = parseFloat(unitMatch[1])
            if (!isFinite(value)) return null
            const unit = unitMatch[2] ? unitMatch[2].toLowerCase() : undefined

            if (unit === undefined) return new CSSNumericValue(value, NUMBER_UNIT_TYPE)
            if (unit === '%') return new CSSUnitValue(value, '%')
            if (ALL_UNITS.includes(unit)) return new CSSUnitValue(value, unit)
            return null
            // Unknown unit
        }
        if (/^(-?(?:\d*\.\d+|\d+\.?\d*))$/.test(text)) {
            const value = parseFloat(text)
            if (isFinite(value)) return new CSSNumericValue(value, NUMBER_UNIT_TYPE)
        }
        return null
    }

    // --- Parenthesis Matcher ---
    function findMatchingParen(str, startIndex = 0) {
        let level = 0
        if (str[startIndex] !== '(') return -1
        for (let i = startIndex; i < str.length; i++) {
            if (str[i] === '(') level++
            else if (str[i] === ')') {
                level--
                if (level === 0) return i
            }
        }
        return -1
    }

    // --- Function Argument Parser ---
    function parseFunctionArguments(argsString, functionName = 'function') {
        argsString = argsString.trim()
        if (argsString === '') return []
        const args = []
        let currentArg = ''
        let parenDepth = 0
        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i]
            if (char === '(') {
                parenDepth++
                currentArg += char
            }
            else if (char === ')') {
                currentArg += char
                parenDepth = Math.max(0, parenDepth - 1)
            } else if (char === ',' && parenDepth === 0) {
                const argTrimmed = currentArg.trim()
                if (argTrimmed === '') throw new Error(`Empty argument found in ${functionName}()`)
                args.push(parseCssMathExpression(argTrimmed))
                // Use MATH parser
                currentArg = ''
            } else {
                currentArg += char
            }
        }
        const lastArgTrimmed = currentArg.trim()
        if (lastArgTrimmed === '') {
            if (argsString.endsWith(',')) throw new Error(`Trailing comma in ${functionName}()`)
            if (args.length === 0) throw new Error(`No arguments provided to ${functionName}()`)
        } else {
            args.push(parseCssMathExpression(lastArgTrimmed))
            // Use MATH parser
        }
        return args
    }


    // --- Recursive CSS Math Expression Parser ---
    function parseCssMathExpression(expression) {
        expression = expression.trim()

        // 1. Outermost Parentheses
        if (expression.startsWith('(') && findMatchingParen(expression, 0) === expression.length - 1) {
            return parseCssMathExpression(expression.slice(1, -1))
        }

        // 2. Addition/Subtraction (right-to-left)
        let parenLevel = 0
        for (let i = expression.length - 1; i >= 0; i--) {
            const char = expression[i]
            if (char === ')') parenLevel++
            else if (char === '(') parenLevel--
            else if (parenLevel === 0 && (char === '+' || char === '-')) {
                const prevChar = expression[i - 1]
                const nextChar = expression[i + 1]
                // CSS requires spaces around binary +/- for calc()
                if (/\s/.test(prevChar) || /\s/.test(nextChar)) {
                    const left = expression.slice(0, i)
                    const right = expression.slice(i + 1)
                    if (left.trim() !== '' && right.trim() !== '') {
                        // Check it's not unary following another operator/paren/start
                        let prevNonSpaceIndex = i - 1
                        while (prevNonSpaceIndex >= 0 && /\s/.test(expression[prevNonSpaceIndex])) prevNonSpaceIndex--
                        if (prevNonSpaceIndex >= 0 && !['(', '+', '-', '*', '/'].includes(expression[prevNonSpaceIndex])) {
                            // Binary operator confirmed
                            const leftVal = parseCssMathExpression(left)
                            // Might be VarRef
                            const rightVal = parseCssMathExpression(right)
                            // Might be VarRef
                            if (char === '+') return leftVal.add(rightVal)
                            // Use .add()
                            if (char === '-') return leftVal.sub(rightVal)
                            // Use .sub()
                        }
                    } else {
                        throw new Error(`Invalid syntax: Missing operand around operator '${char}' in "${expression}"`)
                    }
                } // else: likely unary or invalid syntax like "10px-5px"
            }
        }

        // 3. Multiplication/Division (right-to-left)
        parenLevel = 0
        for (let i = expression.length - 1; i >= 0; i--) {
            const char = expression[i]
            if (char === ')') parenLevel++
            else if (char === '(') parenLevel--
            else if (parenLevel === 0 && (char === '*' || char === '/')) {
                const left = expression.slice(0, i)
                const right = expression.slice(i + 1)
                if (left.trim() === '' || right.trim() === '') {
                    throw new Error(`Invalid syntax: Missing operand around operator '${char}' in "${expression}"`)
                }
                const leftVal = parseCssMathExpression(left)
                const rightVal = parseCssMathExpression(right)
                if (char === '*') return leftVal.mul(rightVal)
                // Use .mul()
                if (char === '/') return leftVal.div(rightVal)
                // Use .div()
            }
        }

        // 4. Unary Minus/Plus
        if (expression.startsWith('-')) {
            const operand = parseCssMathExpression(expression.slice(1))
            return operand.negate()
        }
        if (expression.startsWith('+')) {
            return parseCssMathExpression(expression.slice(1))
        }

        // 5. Functions (min, max, var, etc. as terms within calc)
        const funcMatch = expression.match(/^([a-zA-Z-]+)\((.*)\)$/i)
        if (funcMatch) {
            const funcName = funcMatch[1].toLowerCase()
            const funcContent = funcMatch[2]
            switch (funcName) {
                case 'min':
                case 'max':
                    try {
                        const args = parseFunctionArguments(funcContent, funcName)
                        args.forEach(arg => {
                            if (!(arg instanceof CSSNumericValue || arg instanceof CSSVariableReferenceValue))
                                throw new Error(`Invalid argument type ${arg?.constructor?.name}`)
                        })
                        if (args.length === 0)
                            throw new Error(`No arguments for ${funcName}`)
                        return funcName === 'min' ? new CSSMathMin(...args) : new CSSMathMax(...args)
                    } catch (e) {
                        throw new Error(`Failed to parse ${funcName} args: ${e.message}`)
                    }
                case 'clamp':
                    throw new Error(`clamp() not supported`)
                case 'var':
                    const varParts = funcContent.match(/^\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*(.+)\s*)?$/)
                    if (varParts) {
                        const fallback = varParts[2] ? new CSSUnparsedValue([varParts[2].trim()]) : null
                        return new CSSVariableReferenceValue(varParts[1], fallback)
                    } else {
                        throw new Error(`Invalid var() syntax: "${expression}"`)
                    }
                case 'calc':
                    return parseCssMathExpression(funcContent)
                // Nested calc
                default:
                    throw new Error(`Unsupported function "${funcName}()" in math expression.`)
            }
        }

        // 6. Base Case: Simple numeric value
        const simpleValue = parseSimpleCssNumericValue(expression)
        if (simpleValue) return simpleValue

        // 7. Invalid Term
        throw new Error(`Invalid or unsupported term in math expression: "${expression}"`)
    }


    // --- CSSNumericValue (Base for numbers, units, math) ---
    class CSSNumericValue extends CSSStyleValue {
        constructor(value, unitType) {
            super()
            this._value = (unitType === NUMBER_UNIT_TYPE) ? value : NaN
            this._unitType = unitType
        }

        type() {
            const types = { length: 0, angle: 0, time: 0, frequency: 0, resolution: 0, flex: 0, percent: 0 }
            const key = this._unitType
            if (key === NUMBER_UNIT_TYPE) { /* all 0 */ }
            else if (key === 'percent') types.percent = 1
            else if (types.hasOwnProperty(key)) types[key] = 1
            else if (key !== 'mixed' && key !== 'unknown')
                console.warn(`CSSNumericValue.type(): Unknown unit type category "${key}"`)
            return types
        }

        _toNumericValue(val, opName) {
            if (val instanceof CSSNumericValue || val instanceof CSSVariableReferenceValue) return val
            if (typeof val === 'number') return new CSSNumericValue(val, NUMBER_UNIT_TYPE)
            if (typeof val === 'string') {
                try {
                    const parsed = CSSStyleValue.parse('', val)
                    // Use main parser
                    if (parsed instanceof CSSNumericValue ||
                        parsed instanceof CSSVariableReferenceValue
                    ) return parsed
                    throw new TypeError(`String "${val}" parsed to non-numeric type "${parsed?.constructor?.name}" for ${opName}.`)
                } catch (e) {
                    throw new TypeError(`Could not parse string "${val}" for ${opName}: ${e.message}`)
                }
            }
            throw new TypeError(`Cannot use value of type ${typeof val} in numeric ${opName}.`)
        }

        // --- Arithmetic Methods ---
        // These methods handle CSSVariableReferenceValue by creating Math objects.
        add(...values) {
            let result = this
            for (const rawVal of values) {
                const other = this._toNumericValue(rawVal, 'add')
                if (result instanceof CSSMathValue || other instanceof CSSMathValue) {
                    const left = (result instanceof CSSMathSum || result instanceof CSSMathProduct) ? result.values : [result]
                    const right = (other instanceof CSSMathSum || other instanceof CSSMathProduct) ? other.values : [other]
                    result = new CSSMathSum([...left, ...right])
                    continue
                }

                if (result instanceof CSSUnitValue && other instanceof CSSUnitValue) {
                    if (result.unit === other.unit)
                        result = new CSSUnitValue(result.value + other.value, result.unit)
                    else {
                        const cat1 = getUnitCategory(result.unit)
                        const cat2 = getUnitCategory(other.unit)
                        const conv = ['length', 'angle', 'time', 'frequency', 'resolution']
                        if (cat1 !== 'unknown' && cat1 === cat2 && conv.includes(cat1)) {
                            try {
                                const convOther = other.to(result.unit)
                                result = new CSSUnitValue(result.value + convOther.value, result.unit)
                            }
                            catch (e) {
                                result = new CSSMathSum([result, other])
                            }
                        } else result = new CSSMathSum([result, other])
                    }
                } else
                    result = new CSSMathSum([result, other])
            }
            return result
        }
        sub(...values) {
            let result = this
            for (const rawVal of values) {
                const other = this._toNumericValue(rawVal, 'sub')
                // Use add(negate(other)) strategy
                result = result.add(other.negate())
            }
            return result
        }
        mul(...values) {
            let result = this
            for (const rawVal of values) {
                const other = this._toNumericValue(rawVal, 'mul')
                if (result instanceof CSSMathValue || other instanceof CSSMathValue) {
                    const left = (result instanceof CSSMathProduct) ? result.values : [result]
                    const right = (other instanceof CSSMathProduct) ? other.values : [other]
                    result = new CSSMathProduct([...left, ...right])
                    continue
                }
                const typeR = result.type()
                const typeO = other.type()
                const isRUnitless = Object.values(typeR).every(v => v === 0)
                const isOUnitless = Object.values(typeO).every(v => v === 0)
                let direct = null
                if (result instanceof CSSUnitValue && isOUnitless && other instanceof CSSNumericValue)
                    direct = new CSSUnitValue(result.value * other._value, result.unit)
                else if (other instanceof CSSUnitValue && isRUnitless && result instanceof CSSNumericValue)
                    direct = new CSSUnitValue(result._value * other.value, other.unit)
                else if (isRUnitless && isOUnitless && result instanceof CSSNumericValue && other instanceof CSSNumericValue)
                    direct = new CSSNumericValue(result._value * other._value, NUMBER_UNIT_TYPE)
                if (direct)
                    result = direct
                else {
                    const left = (result instanceof CSSMathProduct) ? result.values : [result]
                    const right = (other instanceof CSSMathProduct) ? other.values : [other]
                    result = new CSSMathProduct([...left, ...right])
                }
            }
            return result
        }
        div(...values) {
            let result = this
            for (const rawVal of values) {
                const other = this._toNumericValue(rawVal, 'div')
                // Check for division by zero early if possible (non-var)
                const isZero = (other instanceof CSSUnitValue && other.value === 0) ||
                    (other instanceof CSSNumericValue && other._unitType === NUMBER_UNIT_TYPE && other._value === 0)
                if (isZero) throw new RangeError("Division by zero in CSS calculation.")
                // Use mul(invert(other)) strategy
                result = result.mul(other.invert())
            }
            return result
        }

        // --- Structural Operations ---
        negate() {
            if (this instanceof CSSMathNegate) return this.value
            // -(-x) -> x
            if (this instanceof CSSUnitValue) return new CSSUnitValue(-this.value, this.unit)
            if (this instanceof CSSNumericValue && this._unitType === NUMBER_UNIT_TYPE) return new CSSNumericValue(-this._value, NUMBER_UNIT_TYPE)
            return new CSSMathNegate(this)
            // Wrap others (including VarRef)
        }
        invert() {
            if (this instanceof CSSMathInvert) return this.value
            // 1/(1/x) -> x
            // Check for inversion of zero
            if ((this instanceof CSSUnitValue && this.value === 0) || (this instanceof CSSNumericValue && this._unitType === NUMBER_UNIT_TYPE && this._value === 0)) {
                throw new RangeError("Division by zero (inversion of 0).")
            }
            if (this instanceof CSSNumericValue && this._unitType === NUMBER_UNIT_TYPE) return new CSSNumericValue(1 / this._value, NUMBER_UNIT_TYPE)
            return new CSSMathInvert(this)
            // Wrap others (UnitValue, VarRef, Math)
        }

        // --- Comparison / Conversion ---
        min(...values) {
            const all = [this, ...values].map(v => this._toNumericValue(v, 'min'))
            return new CSSMathMin(...all)
        }
        max(...values) {
            const all = [this, ...values].map(v => this._toNumericValue(v, 'max'))
            return new CSSMathMax(...all)
        }
        equals(...values) { /* ... Simplified structural check ... */
            for (const rawVal of values) {
                let other
                if (rawVal instanceof CSSNumericValue || rawVal instanceof CSSVariableReferenceValue) other = rawVal
                else if (typeof rawVal === 'string' || typeof rawVal === 'number') {
                    try {
                        other = this._toNumericValue(rawVal, 'equals')
                    } catch (e) {
                        return false
                    }
                }
                else return false
                // Cannot compare other types

                // Crude string comparison (unreliable for math) + zero check
                if (this.toString() !== other.toString()) {
                    const isThisZero = (this instanceof CSSUnitValue && this.value === 0) || (this instanceof CSSNumericValue && this._unitType === NUMBER_UNIT_TYPE && this._value === 0)
                    const isOtherZero = (other instanceof CSSUnitValue && other.value === 0) || (other instanceof CSSNumericValue && other._unitType === NUMBER_UNIT_TYPE && other._value === 0)
                    if (!(isThisZero && isOtherZero)) return false
                }
            }
            return true
        }
        to(targetUnit) {
            if (!(this instanceof CSSUnitValue)) throw new TypeError(".to() only supported on CSSUnitValue")
            targetUnit = targetUnit.toLowerCase()
            if (this.unit === targetUnit) return new CSSUnitValue(this.value, this.unit)
            const cat1 = getUnitCategory(this.unit)
            const cat2 = getUnitCategory(targetUnit)
            if (cat1 === 'unknown' || cat2 === 'unknown' || cat1 !== cat2) throw new TypeError(`Cannot convert from "${this.unit}" to "${targetUnit}". Incompatible categories.`)
            if (cat1 === NUMBER_UNIT_TYPE || cat2 === NUMBER_UNIT_TYPE || cat1 === 'percent' || cat2 === 'percent') throw new TypeError(`Cannot convert between units and number/percent using .to().`)
            if (conversionRates[cat1]) {
                const rates = conversionRates[cat1]
                if (rates[this.unit] === undefined || rates[targetUnit] === undefined) throw new TypeError(`Conversion between "${this.unit}" and "${targetUnit}" not supported by polyfill rates.`)
                const valueInBase = this.value * rates[this.unit]
                const convertedValue = valueInBase / rates[targetUnit]
                return new CSSUnitValue(convertedValue, targetUnit)
            }
            throw new TypeError(`Conversion from "${this.unit}" to "${targetUnit}" (category "${cat1}") is not supported by this polyfill.`)
        }
        toSum(...values) {
            if (values.length > 0) throw new TypeError(".toSum() does not accept arguments.")
            return (this instanceof CSSMathSum) ? this : new CSSMathSum([this])
        }

        // --- Default toString ---
        toString() {
            if (this._unitType === NUMBER_UNIT_TYPE) return String(this._value)
            console.warn("CSSNumericValue.toString() called on base/unexpected type:", this.constructor.name)
            return 'calc(?)'
        }
        static parse(cssText) {
            const p = CSSStyleValue.parse('', cssText.trim())
            if (p instanceof CSSNumericValue) return p
            if (p instanceof CSSVariableReferenceValue) throw new TypeError(`Input "${cssText}" parsed as a CSSVariableReferenceValue.`)
            throw new TypeError(`Could not parse "${cssText}" as a CSSNumericValue (parsed as ${p?.constructor?.name || 'unknown'}).`)
        }
    }

    // --- CSSUnitValue ---
    class CSSUnitValue extends CSSNumericValue {
        constructor(value, unit) {
            if (typeof value !== 'number' || !isFinite(value)) throw new TypeError("Value must be finite number.")
            if (typeof unit !== 'string' || unit === '') throw new TypeError("Unit must be non-empty string.")
            const unitLower = unit.toLowerCase()
            const category = getUnitCategory(unitLower)
            if (category === NUMBER_UNIT_TYPE) throw new TypeError(`Cannot create CSSUnitValue with unit type number.`)
            super(value, category)
            // Pass category to parent
            if (category === 'unknown') console.warn(`CSSUnitValue: Created value with unknown unit "${unit}".`)
            this._internalValue = value
            this._unit = unitLower
        }
        get value() {
            return this._internalValue
        }
        set value(v) {
            if (typeof v !== 'number' || !isFinite(v)) throw new TypeError("Value must be finite number.")
            this._internalValue = v
        }
        get unit() {
            return this._unit
        }
        toString() {
            return `${this.value}${this.unit}`
        }
    }

    // --- CSSKeywordValue ---
    class CSSKeywordValue extends CSSStyleValue {
        constructor(value) {
            super()
            if (typeof value !== 'string' || value.trim() === '') throw new TypeError("Keyword value must be non-empty string.")
            // Relaxed identifier check
            if (!/^-?[_a-zA-Z]/.test(value) && !['inherit', 'initial', 'unset', 'revert', 'auto', 'none'].includes(value.toLowerCase())) {
                console.warn(`CSSKeywordValue: Value "${value}" might not be a valid CSS keyword.`)
            }
            this._value = value
        }
        get value() {
            return this._value
        }
        set value(v) {
            if (typeof v !== 'string' || v.trim() === '') throw new TypeError("Keyword value must be non-empty string.")
            this._value = v
        }
        toString() {
            return this.value
        }
    }

    // --- CSSUnparsedValue ---
    // (Declaration moved up for forward reference)
    class CSSUnparsedValue extends CSSStyleValue {
        constructor(members = []) {
            super()
            if (!Array.isArray(members))
                throw new TypeError("CSSUnparsedValue needs an array.")
            if (!members.every(m => typeof m === 'string' || m instanceof CSSVariableReferenceValue)) {
                const invalid = members.find(m => typeof m !== 'string' && !(m instanceof CSSVariableReferenceValue))
                throw new TypeError(`CSSUnparsedValue members must be strings or CSSVariableReferenceValue. Found: ${invalid?.constructor?.name || typeof invalid}`)
            }
            this._members = Object.freeze([...members])
        }
        [Symbol.iterator]() {
            return this._members[Symbol.iterator]()
        }
        get length() { return this._members.length }
        item(i) { return this._members[i] }
        toString() { return this._members.map(m => String(m)).join('') }
        // Implement array-like readonly properties/methods
        entries() { return this._members.entries() }
        forEach(callback, thisArg) { this._members.forEach(callback, thisArg) }
        keys() { return this._members.keys() }
        values() { return this._members.values() }
    }

    // --- CSSVariableReferenceValue ---
    class CSSVariableReferenceValue extends CSSStyleValue { // Doesn't inherit CSSNumericValue!
        constructor(variable, fallback = null) {
            super()
            if (typeof variable !== 'string' || !variable.startsWith('--'))
                throw new TypeError("Variable name must start with '--'.")
            if (fallback !== null && !(fallback instanceof CSSUnparsedValue))
                throw new TypeError("Fallback must be CSSUnparsedValue or null.")
            this.variable = variable.trim()
            this.fallback = fallback
        }
        toString() {
            return `var(${this.variable}${this.fallback ? `, ${this.fallback.toString()}` : ''})`
        }
        type() {
            console.warn("CSSVariableReferenceValue.type(): Type is indeterminate.")
            return {}
        }

        // *** FIX: Add delegating arithmetic methods to provide the interface needed by the parser ***
        _toNumericValue(...values) { return CSSNumericValue.prototype._toNumericValue.call(this, ...values) }
        add(...values) { return CSSNumericValue.prototype.add.call(this, ...values) }
        sub(...values) { return CSSNumericValue.prototype.sub.call(this, ...values) }
        mul(...values) { return CSSNumericValue.prototype.mul.call(this, ...values) }
        div(...values) { return CSSNumericValue.prototype.div.call(this, ...values) }
        min(...values) { return CSSNumericValue.prototype.min.call(this, ...values) }
        max(...values) { return CSSNumericValue.prototype.max.call(this, ...values) }
        negate() { return CSSNumericValue.prototype.negate.call(this) }
        invert() { return CSSNumericValue.prototype.invert.call(this) }
        // Add equals/to/toSum? The parser uses add/sub/mul/div/negate/invert primarily.
        // Let's skip adding the others unless needed, as VarRef isn't truly numeric itself.
    }

    // --- CSSMathValue Base ---
    class CSSMathValue extends CSSNumericValue {
        constructor() {
            super(NaN, 'mixed')
            if (this.constructor === CSSMathValue)
                throw new TypeError("CSSMathValue is abstract.")
            this._operands = []
        }
        get values() { return this._operands }
        // Helper for formatting operands in toString()
        _formatOperand(op, context = 'sum') { // context 'sum' or 'product'
            let opStr = op.toString()
            let needsParens = false
            // Parenthesize lower precedence operations, or functions
            if (context === 'sum' && (op instanceof CSSMathSum)) needsParens = true
            // e.g. a + (b+c)
            if (context === 'product' && (op instanceof CSSMathSum)) needsParens = true
            // e.g. a * (b+c)
            // Always wrap nested calc/min/max/clamp? Safer.
            if (opStr.startsWith('calc(') || opStr.startsWith('min(') || opStr.startsWith('max(') || opStr.startsWith('clamp(')) {
                needsParens = true
                if (opStr.startsWith('calc(')) opStr = opStr.slice(5, -1).trim()
            }
            // Parenthesize negation if it's not a simple negative number/unit
            if (op instanceof CSSMathNegate && !(op.value instanceof CSSUnitValue || (op.value instanceof CSSNumericValue && op.value._unitType === NUMBER_UNIT_TYPE))) {
                needsParens = true
            }
            // Parenthesize inversion if it's not a simple number inversion
            if (op instanceof CSSMathInvert && !(op.value instanceof CSSNumericValue && op.value._unitType === NUMBER_UNIT_TYPE)) {
                needsParens = true
            }

            if (needsParens) {
                // Check again if simple after stripping calc()
                return (opStr.includes(' ') || opStr.includes('(') || opStr.includes(',')) ? `(${opStr})` : opStr
            }
            return opStr
        }
    }

    class CSSMathSum extends CSSMathValue {
        constructor(operands) {
            super()
            if (!Array.isArray(operands) || operands.length === 0)
                throw new TypeError("CSSMathSum needs operands.")
            this._operands = Object.freeze(operands.map((op, i) => {
                if (op instanceof CSSNumericValue || op instanceof CSSVariableReferenceValue) return op
                throw new TypeError(`CSSMathSum operand ${i + 1} invalid type ${op?.constructor?.name}`)
            }))
        }
        get operator() { return "sum" }
        toString() {
            if (this.values.length === 0) return 'calc(0)'
            let result = ''
            for (let i = 0; i < this.values.length; i++) {
                const op = this.values[i]
                let sign = ' + '
                let valueToFormat = op
                if (op instanceof CSSMathNegate) {
                    sign = ' - '
                    valueToFormat = op.value
                }
                if (i === 0 && sign === ' - ') result += '-' + this._formatOperand(valueToFormat, 'sum')
                else {
                    if (i > 0) result += sign
                    result += this._formatOperand(valueToFormat, 'sum')
                }
            }
            return `calc(${result})`
        }
        // Refined type compatibility check
        type() {
            if (this._operands.length === 0) return super.type()
            let commonType = null
            let hasVar = false
            let hasUnknown = false
            for (const op of this._operands) {
                let opType
                if (op instanceof CSSVariableReferenceValue) {
                    hasVar = true
                    opType = {}
                    /* Treat var as empty type for check */
                }
                else if (op instanceof CSSNumericValue) {
                    opType = op.type()
                }
                else {
                    hasUnknown = true
                    continue
                } // Should not happen if constructor validated

                // Skip check if operand is var() - just note its presence
                const isOpVar = (op instanceof CSSVariableReferenceValue)

                if (Object.keys(opType).length === 0 && !isOpVar && !(op instanceof CSSNumericValue && op._unitType === NUMBER_UNIT_TYPE)) {
                    hasUnknown = true
                    continue
                }

                if (!commonType && !hasUnknown) {
                    commonType = { ...opType }
                } // Initialize
                else if (!hasUnknown) {
                    // Check compatibility with commonType, allowing var() presence
                    const currentKeys = Object.keys(commonType).filter(k => commonType[k] !== 0)
                    const opKeys = Object.keys(opType).filter(k => opType[k] !== 0)
                    const currentIsVarPlaceholder = currentKeys.length === 0 && hasVar
                    // Is commonType just from previous vars?

                    if (isOpVar) continue
                    // Don't check compatibility against var() itself

                    let compatible = false
                    // Check against established non-var commonType
                    const commonCategory = currentKeys.find(k => k !== 'percent')
                    const opCategory = opKeys.find(k => k !== 'percent')

                    if (!commonCategory && !opCategory) compatible = true
                    // number/percent + number/percent
                    else if (commonCategory === 'length' && !opCategory) compatible = true
                    // length + number/percent
                    else if (!commonCategory && opCategory === 'length') compatible = true
                    // number/percent + length
                    else if (commonCategory && commonCategory === opCategory) compatible = true
                    // unit + same unit (potentially + percent)
                    // else: incompatible categories

                    if (compatible) {
                        // Update commonType to reflect mix if needed (e.g., adding percent)
                        if (!commonType.length && opType.length) commonType.length = opType.length
                        if (!commonType.percent && opType.percent) commonType.percent = opType.percent
                        // Update other types similarly if applicable
                    } else {
                        console.error(`CSSMathSum incompatible additive types: {${currentKeys.join()}} + {${opKeys.join()}}. Expr:`, this.toString())
                        return {}
                        // Incompatible mix
                    }
                }
            }
            if (hasUnknown && !commonType) return {}
            // Only unknowns
            if (hasVar) console.warn("CSSMathSum.type(): Type includes var(), result indeterminate.")
            return commonType || {}
            // Return combined type (or empty if only vars/unknowns)
        }
    }

    // --- CSSMathProduct ---
    class CSSMathProduct extends CSSMathValue {
        constructor(operands) {
            super()
            if (!Array.isArray(operands) || operands.length === 0) throw new TypeError("CSSMathProduct needs operands.")
            this._operands = Object.freeze(operands.map((op, i) => {
                if (op instanceof CSSNumericValue || op instanceof CSSVariableReferenceValue) return op
                throw new TypeError(`CSSMathProduct operand ${i + 1} invalid type ${op?.constructor?.name}`)
            }))
        }
        get operator() {
            return "product"
        }
        toString() {
            const numTerms = []
            const denTerms = []
            this.values.forEach(op => {
                let valueToFormat = op
                let isDen = false
                if (op instanceof CSSMathInvert) {
                    isDen = true
                    valueToFormat = op.value
                }
                const termStr = this._formatOperand(valueToFormat, 'product')
                // Use product context
                if (isDen) denTerms.push(termStr)
                else numTerms.push(termStr)
            })
            const numStr = numTerms.length === 0 ? '1' : numTerms.join(' * ')
            let result = numStr
            if (denTerms.length > 0) {
                const denStr = denTerms.join(' * ')
                // Wrap denominator if it has spaces or is a function call, indicating complexity or multiple terms
                const wrapDen = denTerms.length > 1 || denStr.includes(' ') || denStr.includes('(')
                result += ` / ${wrapDen ? `(${denStr})` : denStr}`
            }
            return `calc(${result})`
        }
        type() {
            const combined = { length: 0, angle: 0, time: 0, frequency: 0, resolution: 0, flex: 0, percent: 0 }
            let hasVar = false
            let hasUnknown = false
            this._operands.forEach(op => {
                if (op instanceof CSSVariableReferenceValue) {
                    hasVar = true
                    return
                }
                let effType
                let isInverted = op instanceof CSSMathInvert
                const baseVal = isInverted ? op.value : op
                if (baseVal instanceof CSSVariableReferenceValue) {
                    hasVar = true
                    return
                }
                if (!(baseVal instanceof CSSNumericValue)) {
                    hasUnknown = true
                    return
                }
                effType = baseVal.type()
                if (Object.keys(effType).length === 0 && !(baseVal instanceof CSSNumericValue && baseVal._unitType === NUMBER_UNIT_TYPE)) {
                    hasUnknown = true
                    return
                }

                for (const key in effType) {
                    if (combined.hasOwnProperty(key)) combined[key] += (isInverted ? -1 : 1) * effType[key]
                    else {
                        hasUnknown = true
                    } // Should not happen
                }
            })
            if (hasVar) console.warn("CSSMathProduct.type(): Type includes var(), result indeterminate.")
            if (hasUnknown) console.warn("CSSMathProduct.type(): Operands included unknown types.")
            // Basic percentage simplification: L * % -> L etc.
            if (combined.percent === 1) {
                const otherDims = Object.keys(combined).filter(k => k !== 'percent' && combined[k] === 1)
                if (otherDims.length === 1 && Object.values(combined).filter(v => v !== 0).length === 2) {
                    combined.percent = 0
                    // Remove percent if combined like L^1 * %^1
                }
            }
            return combined
        }
    }

    // --- CSSMathNegate ---
    class CSSMathNegate extends CSSMathValue {
        constructor(value) {
            super()
            if (!(value instanceof CSSNumericValue || value instanceof CSSVariableReferenceValue)) throw new TypeError("CSSMathNegate needs CSSNumericValue or CSSVariableReferenceValue.")
            this._value = value
            this._operands = Object.freeze([value])
        }
        get operator() {
            return "negate"
        }
        get value() {
            return this._value
        }
        toString() {
            return `calc(-1 * ${this._formatOperand(this._value, 'product')})`
        } // Use format helper
        type() {
            return this._value.type()
        } // Type delegates to inner value
    }

    // --- CSSMathInvert ---
    class CSSMathInvert extends CSSMathValue {
        constructor(value) {
            super()
            if (!(value instanceof CSSNumericValue || value instanceof CSSVariableReferenceValue)) throw new TypeError("CSSMathInvert needs CSSNumericValue or CSSVariableReferenceValue.")
            // Check zero early
            if ((value instanceof CSSUnitValue && value.value === 0) || (value instanceof CSSNumericValue && value._unitType === NUMBER_UNIT_TYPE && value._value === 0)) {
                throw new RangeError("Division by zero (inversion of 0).")
            }
            this._value = value
            this._operands = Object.freeze([value])
        }
        get operator() { return "invert" }
        get value() { return this._value }
        toString() { return `calc(1 / ${this._formatOperand(this._value, 'product')})` }
        type() {
            const valType = this._value.type()
            const invType = {}
            for (const key in valType) {
                invType[key] = -valType[key]
            } return (this._value instanceof CSSVariableReferenceValue) ? {} : invType
        } // Handle inner var()
    }

    class CSSMathMin extends CSSMathValue {
        constructor(...operands) {
            super()
            if (operands.length === 0) throw new TypeError("CSSMathMin needs >= 1 argument.")
            this._operands = Object.freeze(operands.map((op, i) => {
                if (op instanceof CSSNumericValue || op instanceof CSSVariableReferenceValue) return op
                throw new TypeError(`CSSMathMin operand ${i + 1} invalid type ${op?.constructor?.name}`)
            }))
        }
        get operator() { return "min" }
        toString() { return `min(${this._operands.map(op => op.toString()).join(", ")})` }
        type() { return this._calculateMinMaxType() }
        _calculateMinMaxType() {
            let commonType = null
            let hasVar = false
            let hasUnknown = false
            for (const op of this._operands) {
                let opType
                if (op instanceof CSSVariableReferenceValue) {
                    hasVar = true
                    opType = {}
                }
                else if (op instanceof CSSNumericValue) {
                    opType = op.type()
                }
                else {
                    hasUnknown = true
                    continue
                }
                const isOpVar = (op instanceof CSSVariableReferenceValue)
                if (Object.keys(opType).length === 0 && !isOpVar && !(op instanceof CSSNumericValue && op._unitType === NUMBER_UNIT_TYPE)) {
                    hasUnknown = true
                    continue
                }
                if (!commonType && !hasUnknown) {
                    commonType = { ...opType }
                }
                else if (!hasUnknown && !isOpVar) { /* Check compatibility (length/percent mix allowed) */
                    const commonCat = Object.keys(commonType).find(k => commonType[k] !== 0 && k !== 'percent')
                    const opCat = Object.keys(opType).find(k => opType[k] !== 0 && k !== 'percent')
                    let compat = false
                    if (!commonCat && !opCat) compat = true
                    // num/perc + num/perc
                    else if (commonCat === 'length' && !opCat) compat = true
                    // len + num/perc
                    else if (!commonCat && opCat === 'length') compat = true
                    // num/perc + len
                    else if (commonCat && commonCat === opCat) compat = true
                    // unit + same unit
                    if (compat) {
                        if (opType.percent) commonType.percent = 1
                        /* Update mix */
                    }
                    else {
                        console.error(`${this.constructor.name} incompatible types: {${Object.keys(commonType).filter(k => commonType[k] !== 0)}} vs {${Object.keys(opType).filter(k => opType[k] !== 0)}}`)
                        return {}
                    }
                }
            }
            if (hasUnknown && !commonType) return {}
            if (hasVar) console.warn(`${this.constructor.name}.type(): Includes var(), result indeterminate.`)
            return commonType || {}
        }
    }

    class CSSMathMax extends CSSMathValue {
        constructor(...operands) {
            super()
            if (operands.length === 0) throw new TypeError("CSSMathMax needs >= 1 argument.")
            this._operands = Object.freeze(operands.map((op, i) => {
                if (op instanceof CSSNumericValue || op instanceof CSSVariableReferenceValue) return op
                throw new TypeError(`CSSMathMax operand ${i + 1} invalid type ${op?.constructor?.name}`)
            }))
        }
        get operator() { return "max" }
        toString() { return `max(${this._operands.map(op => op.toString()).join(", ")})` }
        type() { return CSSMathMin.prototype._calculateMinMaxType.call(this) }
    }

    // --- CSSImageValue (Stub) ---
    class CSSImageValue extends CSSStyleValue {
        constructor(t) {
            super()
            this._cssText = t
        }
        toString() { return this._cssText }
    }
    // --- CSSPositionValue (Stub) ---
    class CSSPositionValue extends CSSStyleValue {
        constructor(x, y) {
            super()
            this.x = x
            this.y = y
            /* simplified */
        }
        toString() { return `${this.x} ${this.y}` }
    }
    // --- CSSTransformValue Stubs ---
    class CSSTransformComponent extends CSSStyleValue {
        constructor() {
            super()
            if (this.constructor === CSSTransformComponent) throw new TypeError("Abstract")
            this.is2D = true
        }
    }
    class CSSTranslate extends CSSTransformComponent {
        constructor(x, y, z = null) {
            super()
            this.x = x
            this.y = y
            this.z = z
            this.is2D = (z === null)
        }
        toString() { return this.is2D ? `translate(${this.x}, ${this.y})` : `translate3d(${this.x}, ${this.y}, ${this.z})` }
    }
    class CSSRotate extends CSSTransformComponent {
        constructor(angleOrX, y = null, z = null, angle = null) {
            super()
            this.is2D = (y === null && z === null && angle === null)

            if (this.is2D) {
                if (!(angleOrX instanceof CSSNumericValue) || angleOrX.type().angle !== 1) {
                    // Allow unitless 0? Spec says <angle>
                    if (!((angleOrX instanceof CSSUnitValue && angleOrX.value === 0) || (angleOrX instanceof CSSNumericValue && angleOrX._unitType === NUMBER_UNIT_TYPE && angleOrX._value === 0))) {
                        throw new TypeError(`CSSRotate angle must be CSSNumericValue of type angle, got ${angleOrX?.toString()}`)
                    }
                }
                this.angle = angleOrX
                this.x = this.y = this.z = CSS.number(0); // Store axis for consistency? No, keep null per spec.
            } else {
                // rotate3d(x, y, z, angle)
                const parseNum = (n, name) => {
                    if (typeof n !== 'number') throw new TypeError(`CSSRotate ${name} must be a number.`)
                    return CSS.number(n); // Store as CSSNumericValue internally
                }
                this.x = parseNum(angleOrX, 'x')
                this.y = parseNum(y, 'y')
                this.z = parseNum(z, 'z')

                if (!(angle instanceof CSSNumericValue) || angle.type().angle !== 1) {
                    if (!((angle instanceof CSSUnitValue && angle.value === 0) || (angle instanceof CSSNumericValue && angle._unitType === NUMBER_UNIT_TYPE && angle._value === 0))) {
                        throw new TypeError(`CSSRotate 3D angle must be CSSNumericValue of type angle, got ${angle?.toString()}`)
                    }
                }
                this.angle = angle
            }
        }
        toString() { return this.is2D ? `rotate(${this.angle})` : `rotate3d(${this.x._value}, ${this.y._value}, ${this.z._value}, ${this.angle.toString()})` }
    }
    class CSSScale extends CSSTransformComponent {
        constructor(x, y, z = null) {
            super()
            const parseArg = (arg, name) => {
                let numVal
                if (arg instanceof CSSNumericValue) {
                    if (Object.values(arg.type()).some(v => v !== 0)) { // Must be unitless
                        throw new TypeError(`CSSScale ${name} must be a unitless number, got ${arg.toString()}`)
                    }
                    numVal = arg; // Already correct type
                } else if (typeof arg === 'number' && isFinite(arg)) {
                    numVal = CSS.number(arg); // Convert number to CSSNumericValue
                } else {
                    throw new TypeError(`CSSScale ${name} must be a finite number or unitless CSSNumericValue.`)
                }
                return numVal
            }

            this.x = parseArg(x, 'x')
            // If y is explicitly undefined or null, it defaults to x. If provided, parse it.
            this.y = (y === undefined || y === null) ? this.x : parseArg(y, 'y')

            // If z is explicitly null, it's a 2D scale. If provided, parse it.
            if (z !== null) {
                this.z = parseArg(z, 'z')
                this.is2D = false
            } else {
                this.z = CSS.number(1); // Default z to 1 for internal matrix math, but mark as 2D conceptually
                this.is2D = true
            }
        }
        toString() { return this.is2D ? (this.x == this.y ? `scale(${this.x})` : `scale(${this.x}, ${this.y})`) : `scale3d(${this.x}, ${this.y}, ${this.z})` }
    }
    class CSSTransformValue extends CSSStyleValue {
        constructor(t = []) {
            super()
            if (!Array.isArray(t) || !t.every(i => i instanceof CSSTransformComponent)) throw new TypeError("Invalid args")
            this.transforms = Object.freeze([...t])
        }
        get length() { return this.transforms.length }
        item(i) { return this.transforms[i] }
        get is2D() { return this.transforms.every(i => i.is2D) }
        toString() { return this.transforms.map(i => i.toString()).join(" ") }
        [Symbol.iterator]() { return this.transforms[Symbol.iterator]() }
        entries() { return this.transforms.entries(); }
        keys() { return this.transforms.keys(); }
        values() { return this.transforms.values(); }
        forEach(callback, thisArg) { this.transforms.forEach(callback, thisArg); }
    }

    // --- CSSStyleValue Static Parsers (Implementation) ---
    CSSStyleValue.parse = function (property, cssText) {
        cssText = cssText.trim()
        if (cssText === '') throw new TypeError(`Cannot parse empty string for property "${property}"`)

        // 1. Top-level var()
        const varMatch = cssText.match(/^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*(.+)\s*)?\)$/i)
        if (varMatch) return new CSSVariableReferenceValue(varMatch[1], varMatch[2] ? new CSSUnparsedValue([varMatch[2].trim()]) : null)

        // 2. Top-level math functions
        const mathMatch = cssText.match(/^([a-z-]+)\((.+)\)$/i)
        if (mathMatch) {
            const funcName = mathMatch[1].toLowerCase()
            const content = mathMatch[2]
            switch (funcName) {
                case 'calc':
                    try {
                        return parseCssMathExpression(content)
                    } catch (e) {
                        console.warn(`Parse failed for calc(${content}): ${e.message}`)
                        return new CSSUnparsedValue([cssText])
                    }
                case 'min':
                case 'max':
                    try {
                        const args = parseFunctionArguments(content, funcName)
                        args.forEach(a => {
                            if (!(a instanceof CSSNumericValue || a instanceof CSSVariableReferenceValue)) throw new Error('Invalid arg')
                        })
                        if (args.length === 0) throw new Error('No args')
                        return funcName === 'min' ? new CSSMathMin(...args) : new CSSMathMax(...args)
                    }
                    catch (e) {
                        console.warn(`Parse failed for ${funcName}(${content}): ${e.message}`)
                        return new CSSUnparsedValue([cssText])
                    }
                case 'clamp': console.warn('clamp() not parsed')
                    return new CSSUnparsedValue([cssText])
            }
        }

        // 3. url() -> CSSImageValue stub
        if (cssText.match(/^url\(/i)) return new CSSImageValue(cssText)

        // 4. Simple Number/Unit/Percent
        const simpleNum = parseSimpleCssNumericValue(cssText)
        if (simpleNum) return simpleNum

        // 5. Keyword
        if (/^(-?[_a-zA-Z][_a-zA-Z0-9-]*)$/.test(cssText)) {
            if (!['calc', 'min', 'max', 'clamp', 'var'].includes(cssText.toLowerCase().split('(')[0])) {
                // Avoid treating numbers as keywords unless specific ones
                if (!/^-?\d/.test(cssText) || ['inherit', 'initial', 'unset', 'revert', 'auto', 'none'].includes(cssText.toLowerCase())) {
                    return new CSSKeywordValue(cssText)
                }
            }
        }

        // 6. String Literal
        if (cssText.match(/^(['"]).*\1$/)) return new CSSUnparsedValue([cssText])

        // 7. Color Stubs (rgb, #)
        if (cssText.match(/^(rgb|hsl)a?\(|^#/) || ['transparent', 'currentcolor'].includes(cssText.toLowerCase())) {
            if (cssText.startsWith('rgb') || cssText.startsWith('hsl') || cssText.startsWith('#')) {
                console.warn(`Color value "${cssText}" returned as Unparsed.`)
                return new CSSUnparsedValue([cssText])
            }
            // Named colors / keywords handled above
        }

        // 8. Transform Function Stubs
        if (cssText.match(/^(translate|rotate|scale|skew|matrix|perspective)[XYZ3d]?\(/i)) {
            console.warn(`Transform function "${cssText}" returned as Unparsed.`)
            return new CSSUnparsedValue([cssText])
        }

        // Fallback
        console.warn(`CSSStyleValue.parse: Could not parse "${cssText}". Returning as CSSUnparsedValue.`)
        return new CSSUnparsedValue([cssText])
    }

    CSSStyleValue.parseAll = function (property, cssText) {
        /* ... comma splitting logic (mostly unchanged) ... */
        cssText = cssText.trim()
        if (cssText === '') return []
        const values = []
        let current = ''
        let depth = 0
        let quote = null
        for (let i = 0; i < cssText.length; ++i) {
            const c = cssText[i]
            if (quote) {
                current += c
                if (c === quote && cssText[i - 1] !== '\\') quote = null
            }
            else if (c === '"' || c === "'") {
                current += c
                quote = c
            }
            else if (c === '(') {
                current += c
                depth++
            }
            else if (c === ')') {
                current += c
                depth = Math.max(0, depth - 1)
            }
            else if (c === ',' && depth === 0) {
                values.push(current.trim())
                current = ''
            }
            else {
                current += c
            }
        }
        if (current.trim() || values.length > 0) values.push(current.trim())
        return values.filter(v => v !== '').map(v => {
            try {
                return CSSStyleValue.parse(property, v)
            } catch (e) {
                console.warn(`parseAll segment failed for "${v}": ${e.message}`)
                return new CSSUnparsedValue([v])
            }
        })
    }

    class StylePropertyMap {
        constructor(element) {
            this._element = element
        }
        get size() { return this._element.style.length }
        get(prop) {
            const kprop = this._kebab(prop)
            const v = this._element.style.getPropertyValue(kprop)
            if (!v) return null
            try {
                return CSSStyleValue.parse(kprop, v)
            } catch (e) {
                console.warn(`get failed for ${kprop}: ${e.message}`)
                return new CSSUnparsedValue([v])
            }
        }
        getAll(prop) {
            const kprop = this._kebab(prop)
            const v = this._element.style.getPropertyValue(kprop)
            if (!v) return []
            try {
                return CSSStyleValue.parseAll(kprop, v)
            } catch (e) {
                console.warn(`getAll failed for ${kprop}: ${e.message}`)
                return [new CSSUnparsedValue([v])]
            }
        }
        set(prop, ...vals) {
            const kprop = this._kebab(prop)
            if (vals.length === 0) throw new TypeError('Set requires values.')
            const txt = vals.map(v => v instanceof CSSStyleValue ? v.toString() : String(v)).join(' ').trim()
            try {
                this._element.style.setProperty(kprop, txt)
            } catch (e) {
                console.error(`Set failed for ${kprop}=${txt}: ${e}`)
                throw e
            }
        }
        append(prop, ...vals) {
            const kprop = this._kebab(prop)
            if (vals.length === 0) throw new TypeError('Append requires values.')
            const newTxt = vals.map(v => v instanceof CSSStyleValue ? v.toString() : String(v)).join(' ').trim()
            if (!newTxt) return
            const oldTxt = this._element.style.getPropertyValue(kprop)
            const listProps = ['font-family', 'text-shadow', 'box-shadow', 'filter', 'transition', 'animation']
            const isList = listProps.some(p => kprop.includes(p))
            let finalTxt
            if (oldTxt && isList) finalTxt = `${oldTxt}, ${newTxt}`
            else if (oldTxt) finalTxt = `${oldTxt} ${newTxt}`
            else finalTxt = newTxt
            try {
                this._element.style.setProperty(kprop, finalTxt)
            } catch (e) {
                console.error(`Append failed for ${kprop}=${finalTxt}: ${e}`)
                throw e
            }
        }
        delete(prop) {
            const kprop = this._kebab(prop)
            try {
                this._element.style.removeProperty(kprop)
            } catch (e) {
                console.error(`Delete failed for ${kprop}: ${e}`)
                throw e
            }
        }
        clear() { this._element.style.cssText = '' }
        has(prop) { return this._element.style.getPropertyValue(this._kebab(prop)) !== '' }
        _kebab(s) { return typeof s === 'string' ? s.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`) : s }
        // Iterators... (rely on style object, iterates longhands)
        forEach(cb, thisArg) {
            const s = this._element.style
            for (let i = 0; i < s.length; ++i) {
                const p = s[i]
                const v = this.get(p)
                if (v !== null) cb.call(thisArg, v, p, this)
            }
        }
        [Symbol.iterator]() {
            const s = this._element.style
            let i = 0
            const map = this
            return {
                next() {
                    if (i < s.length) {
                        const p = s[i++]
                        const v = map.get(p)
                        return v !== null ? { value: [p, v], done: false } : this.next()
                    }
                    return { value: undefined, done: true }
                },
                [Symbol.iterator]() { return this }
            }
        }
        entries() { return this[Symbol.iterator]() }
        keys() {
            const s = this._element.style
            let i = 0
            return {
                next() {
                    return i < s.length ? { value: s[i++], done: false } : { value: undefined, done: true }
                },
                [Symbol.iterator]() { return this }
            }
        }
        values() {
            const s = this._element.style
            let i = 0
            const map = this
            return {
                next() {
                    if (i < s.length) {
                        const p = s[i++]
                        const v = map.get(p)
                        return v !== null ? { value: v, done: false } : this.next()
                    }
                    return { value: undefined, done: true }
                },
                [Symbol.iterator]() { return this }
            }
        }
    }



    // --- Global Scope Injection ---
    if (typeof window !== 'undefined') {
        const target = window
        const defineProp = (obj, name, value) => {
            if (!obj.hasOwnProperty(name))
                Object.defineProperty(obj, name, { value, writable: true, enumerable: false, configurable: true })
        }

        // Core Classes
        defineProp(target, 'CSSStyleValue', CSSStyleValue)
        defineProp(target, 'CSSNumericValue', CSSNumericValue)
        defineProp(target, 'CSSUnitValue', CSSUnitValue)
        defineProp(target, 'CSSKeywordValue', CSSKeywordValue)
        defineProp(target, 'CSSUnparsedValue', CSSUnparsedValue)
        defineProp(target, 'CSSVariableReferenceValue', CSSVariableReferenceValue)
        // Math Classes
        defineProp(target, 'CSSMathValue', CSSMathValue)
        defineProp(target, 'CSSMathSum', CSSMathSum)
        defineProp(target, 'CSSMathProduct', CSSMathProduct)
        defineProp(target, 'CSSMathNegate', CSSMathNegate)
        defineProp(target, 'CSSMathInvert', CSSMathInvert)
        defineProp(target, 'CSSMathMin', CSSMathMin)
        defineProp(target, 'CSSMathMax', CSSMathMax)
        // Other Stubs
        defineProp(target, 'CSSImageValue', CSSImageValue)
        defineProp(target, 'CSSPositionValue', CSSPositionValue)
        defineProp(target, 'CSSTransformValue', CSSTransformValue)
        defineProp(target, 'CSSTranslate', CSSTranslate)
        defineProp(target, 'CSSRotate', CSSRotate)
        defineProp(target, 'CSSScale', CSSScale)
        defineProp(target, 'CSSTransformComponent', CSSTransformComponent)

        // attributeStyleMap
        if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.hasOwnProperty('attributeStyleMap')) {
            const cache = new WeakMap()
            Object.defineProperty(HTMLElement.prototype, 'attributeStyleMap', {
                configurable: true, enumerable: true, get() {
                    if (!cache.has(this)) cache.set(this, new StylePropertyMap(this))
                    return cache.get(this)
                }, set() {
                    throw new Error("Cannot set read-only property 'attributeStyleMap'.")
                }
            })
            console.log('Polyfilled HTMLElement.prototype.attributeStyleMap')
        }

        // CSS.* factories
        if (typeof target.CSS === 'undefined') target.CSS = {}
        const defineCssFactory = (name, func) => {
            if (typeof target.CSS[name] !== 'function') Object.defineProperty(target.CSS, name, { value: func, writable: true, enumerable: true, configurable: true })
        }
        defineCssFactory('number', v => {
            if (typeof v !== 'number' || !isFinite(v)) throw new TypeError('CSS.number needs finite number')
            return new CSSNumericValue(v, NUMBER_UNIT_TYPE)
        })
        ALL_UNITS.forEach(unit => {
            let name = unit.toLowerCase()
            if (name === '%') name = 'percent'
            if (!/^[a-z]/.test(name)) return
            defineCssFactory(name, v => {
                if (typeof v !== 'number' || !isFinite(v)) throw new TypeError(`CSS.${name} needs finite number`)
                return new CSSUnitValue(v, unit)
            })
        })
        console.log('Polyfilled CSS.* factory functions')

        console.log('CSS Typed OM Polyfill: Finished initialization.')
    } else {
        console.warn('CSS Typed OM Polyfill: Not running in a browser environment.')
    }

})()
