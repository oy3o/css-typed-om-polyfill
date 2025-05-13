# CSS Typed OM Polyfill

A JavaScript polyfill for the [CSS Typed Object Model (OM) Level 1](https://www.w3.org/TR/css-typed-om/) specification. This polyfill aims to provide a functional subset of the CSS Typed OM API for browsers that do not natively support it, allowing developers to interact with CSS values as typed JavaScript objects.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Supported CSS Typed OM Interfaces](#supported-css-typed-om-interfaces)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage & Notes](#advanced-usage--notes)
  - [Parsing CSS Values](#parsing-css-values)
  - [`calc()` and Math Functions](#calc-and-math-functions)
  - [Arithmetic Operations](#arithmetic-operations)
  - [`var()` (CSS Variables)](#var-css-variables)
- [Limitations & To-Do](#limitations--to-do)
- [Development](#development)
- [License](#license)

## Introduction

The CSS Typed Object Model provides a way to manipulate CSS values in JavaScript with type awareness, rather than just dealing with strings. This can lead to more robust and performant code. This polyfill brings some of that power to environments lacking native support.

It focuses on parsing CSS strings into typed objects, performing arithmetic on numeric values, and providing the `element.attributeStyleMap` interface for getting and setting styles in a typed manner.

## Features

*   **`HTMLElement.prototype.attributeStyleMap`:** Access and modify inline styles using a `StylePropertyMap`.
*   **CSS Value Parsing:**
    *   `CSSStyleValue.parse(property, cssText)`: Parses a single CSS value string.
    *   `CSSStyleValue.parseAll(property, cssText)`: Parses a comma-separated list of CSS values.
*   **Numeric Values:**
    *   `CSSNumericValue` (base class for numbers and units).
    *   `CSSUnitValue` (e.g., `10px`, `50%`, `3.14rad`).
    *   `CSS.*` factory functions (e.g., `CSS.px(10)`, `CSS.percent(50)`, `CSS.number(5)`).
    *   Arithmetic operations: `.add()`, `.sub()`, `.mul()`, `.div()`, `.negate()`, `.invert()`.
    *   Unit conversion: `.to('targetUnit')` for compatible types (e.g., `s` to `ms`).
    *   Type checking for math operations (e.g., `length + angle` is invalid).
*   **Mathematical Expressions:**
    *   `CSSMathSum`, `CSSMathProduct`, `CSSMathNegate`, `CSSMathInvert`.
    *   `CSSMathMin`, `CSSMathMax`.
    *   Recursive parsing of `calc()`, `min()`, `max()` expressions, including nested functions and `var()`.
*   **Other CSS Values:**
    *   `CSSKeywordValue` (e.g., `auto`, `inherit`, `initial`).
    *   `CSSVariableReferenceValue` (for `var(--custom-property)`).
    *   `CSSUnparsedValue` (for values not fully parsed or unsupported).
*   **Stubbed/Partial Implementations:**
    *   `CSSImageValue` (basic stub, returns `url(...)` as string).
    *   `CSSPositionValue` (basic stub).
    *   `CSSTransformValue` and its components (`CSSTranslate`, `CSSRotate`, `CSSScale`) (basic stubs with constructors and `toString()`).

## Supported CSS Typed OM Interfaces

**Core Classes:**
*   `CSSStyleValue` (Abstract Base)
*   `CSSNumericValue` (Abstract Base for numeric types)
*   `CSSUnitValue`
*   `CSSKeywordValue`
*   `CSSUnparsedValue`
*   `CSSVariableReferenceValue`

**Math Classes (subclass `CSSNumericValue`):**
*   `CSSMathValue` (Abstract Base)
*   `CSSMathSum`
*   `CSSMathProduct`
*   `CSSMathNegate`
*   `CSSMathInvert`
*   `CSSMathMin`
*   `CSSMathMax`

**Other (Stubbed/Partial):**
*   `CSSImageValue`
*   `CSSPositionValue`
*   `CSSTransformValue`
*   `CSSTransformComponent` (Abstract Base)
*   `CSSTranslate`
*   `CSSRotate`
*   `CSSScale`

**Interfaces:**
*   `StylePropertyMap` (via `element.attributeStyleMap`)

## Installation

Simply include the polyfill script in your HTML file before any scripts that use the CSS Typed OM API:

```html
<script src="css-typed-om-polyfill.js"></script>
<script>
  // Your code using Typed OM
  const el = document.getElementById('myElement');
  if (el && el.attributeStyleMap) {
    el.attributeStyleMap.set('width', CSS.px(100));
    console.log(el.attributeStyleMap.get('width').toString()); // "100px"
  }
</script>
```

The polyfill will automatically initialize and attach necessary properties to the global scope (`window`) and `HTMLElement.prototype`.

## Basic Usage

### Accessing `attributeStyleMap`

```javascript
const element = document.createElement('div');
document.body.appendChild(element);

// Set a style
element.attributeStyleMap.set('width', CSS.px(200));
element.attributeStyleMap.set('opacity', CSS.number(0.5));
element.attributeStyleMap.set('margin-top', CSS.em(1.5));

// Get a style
const width = element.attributeStyleMap.get('width'); // CSSUnitValue { value: 200, unit: "px" }
console.log(width.value); // 200
console.log(width.unit); // "px"
console.log(width.toString()); // "200px"

const opacity = element.attributeStyleMap.get('opacity'); // CSSNumericValue { _value: 0.5, _unitType: "number" }
console.log(opacity.toString()); // "0.5"
```

### Using `CSS.*` Factory Functions

```javascript
const length = CSS.px(100);
const percentage = CSS.percent(50);
const duration = CSS.s(2.5);
const angle = CSS.deg(90);
const number = CSS.number(10);

console.log(length.add(CSS.vw(10)).toString()); // "calc(100px + 10vw)"
```

## Advanced Usage & Notes

### Parsing CSS Values

```javascript
// Parse a single value
const parsedWidth = CSSStyleValue.parse('width', 'calc(100% - 20px)');
console.log(parsedWidth.toString()); // "calc(100% - 20px)"
if (parsedWidth instanceof CSSMathSum) {
  console.log(parsedWidth.operator); // "sum"
  console.log(parsedWidth.values[0].toString()); // "100%"
  console.log(parsedWidth.values[1].toString()); // "calc(-1 * 20px)" (negated second term)
}

const keyword = CSSStyleValue.parse('display', 'block');
console.log(keyword.value); // "block"

// Parse a list of values (e.g., for font-family)
const fontFamilies = CSSStyleValue.parseAll('font-family', '"Arial", sans-serif');
fontFamilies.forEach(font => console.log(font.toString()));
// Output:
// "Arial" (CSSUnparsedValue for the string)
// "sans-serif" (CSSKeywordValue)
```

### `calc()` and Math Functions

The polyfill includes a robust parser for `calc()`, `min()`, and `max()` expressions, respecting operator precedence and parentheses.

```javascript
const complexCalc = CSSStyleValue.parse('width', 'calc( (var(--A) + 2 * ( 5vw - var(--B) )) / 3 )');
console.log(complexCalc.toString()); // "calc((var(--A) + 2 * (5vw - var(--B))) / 3)"
// The internal structure will be a tree of CSSMathProduct, CSSMathSum, etc.
```

### Arithmetic Operations

`CSSNumericValue` and its subclasses support arithmetic. Operations involving different compatible units or `var()` will result in `CSSMathSum` or `CSSMathProduct` objects.

```javascript
const val1 = CSS.px(10);
const val2 = CSS.em(2);
const val3 = CSS.percent(50);
const num = CSS.number(5);

// Addition
console.log(val1.add(val2).toString());         // "calc(10px + 2em)"
console.log(val1.add(CSS.px(5)).toString());   // "15px" (same unit)

// Subtraction
console.log(val3.sub(CSS.px(10)).toString());   // "calc(50% - 10px)"

// Multiplication
console.log(val1.mul(num).toString());          // "50px" (length * number = length)
console.log(val1.mul(CSS.percent(200)).toString()); // "calc(10px * 200%)" (length * percent)

// Division
console.log(val1.div(num).toString());          // "2px"
console.log(val1.div(CSS.px(2)).toString());    // "5" (length / length = number)
```

### `var()` (CSS Variables)

`var()` expressions are parsed into `CSSVariableReferenceValue` objects. They can be used within math functions and arithmetic operations, remaining unresolved.

```javascript
const myVar = CSSStyleValue.parse('width', 'var(--my-width, 100px)');
console.log(myVar.variable); // "--my-width"
console.log(myVar.fallback.toString()); // "100px"

const calcWithVar = CSS.px(10).add(myVar);
console.log(calcWithVar.toString()); // "calc(10px + var(--my-width, 100px))"
```

## Limitations & To-Do

This polyfill is a work in progress and does not cover the entire CSS Typed OM specification. Key limitations include:

*   **`clamp()`:** Not currently supported in the math expression parser (will parse as `CSSUnparsedValue` if top-level, or throw error if inside `calc`).
*   **Color Values:** Complex color functions (e.g., `rgb()`, `hsl()`, `color()`) are generally parsed as `CSSUnparsedValue`. Basic named colors might parse as `CSSKeywordValue`.
*   **Detailed Transform Parsing:** While `CSSTransformValue` and component classes (`CSSTranslate`, `CSSRotate`, `CSSScale`) exist with constructors, the main `CSSStyleValue.parse` will return `CSSUnparsedValue` for transform function strings. You'd need to construct them manually.
*   **`CSSNumericValue.equals()`:** Provides a simplified structural check, primarily via `toString()` comparison, which may not be robust for all mathematically equivalent but structurally different expressions.
*   **Type System Nuances:** The `type()` method on math values attempts to determine the resulting type (e.g., `length`, `angle`, `percent`), but complex interactions, especially with `var()`, can lead to indeterminate types.
*   **No Actual Value Computation:** The polyfill parses and represents CSS values and expressions. It does **not** compute the final used value of expressions (e.g., it won't resolve `calc(10px + 5%)` to a single pixel value, as that requires layout context).
*   **Shorthand Properties:** `StylePropertyMap.get()` might return `null` or an unparsed value for shorthands if the browser doesn't expand them into longhands in `element.style`. The polyfill relies on what `element.style.getPropertyValue()` returns.
*   **Limited Property-Specific Parsing:** `CSSStyleValue.parse(property, cssText)` does not currently use the `property` argument to guide parsing specific to that property's grammar (beyond basic distinctions).

**Future Enhancements (To-Do):**
*   Implement `clamp()`.
*   Improve parsing for color values.
*   Full parsing of transform functions into `CSSTransformValue`.
*   More robust `CSSNumericValue.equals()`.
*   Support for more `CSSStyleValue` subclasses (e.g., `CSSSkew`, `CSSPerspective`, `CSSMatrixComponent`).
*   Consider `CSSMathClamp`.

## Development

The code is contained within a single IIFE (Immediately Invoked Function Expression). The core parsing logic for math expressions is in `parseCssMathExpression`. `CSSStyleValue.parse` is the main entry point for parsing CSS text.

The script includes example usage code wrapped in a `setTimeout` at the end, which can be used for testing in a browser environment.

## License

[MIT](LICENSE)