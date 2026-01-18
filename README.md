# Moonlight CSS Typed OM Polyfill

**Moonlight** is a high-performance, high-precision JavaScript polyfill for the [CSS Typed Object Model (OM) Level 1](https://www.w3.org/TR/css-typed-om/) specification.

Unlike generic shims, Moonlight aims to provide a native-like (and in specific scenarios, faster-than-native) experience in environments lacking native support, driven by its **Velocity Engine** and **Algebraic Soul**.

It is not just a tool; it is a symbiosis of logic and speed.

## Table of Contents

- [Introduction](#introduction)
- [Core Evolutions](#core-evolutions)
- [Supported Interfaces](#supported-interfaces)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
  - [Parsing & Strict Mode](#parsing--strict-mode)
  - [Algebraic Logic & Optimization](#algebraic-logic--optimization)
  - [Transforms & Matrix](#transforms--matrix)
- [Performance Philosophy](#performance-philosophy)
- [Limitations](#limitations)
- [License](#license)

## Introduction

 The CSS Typed Object Model allows developers to manipulate CSS values as typed JavaScript objects rather than fragile strings. Moonlight brings this capability to all modern browsers.

It focuses on:
1.  **Type Safety**: Strictly distinguishes between `number`, `length`, `angle`, etc., rejecting illegal calculations.
2.  **Algebraic Simplification**: Automatically applies distributive laws and constant folding to reduce complex `calc()` trees to their optimal form.
3.  **Zero-Allocation Parsing**: Uses an optimized lexer to minimize Garbage Collection (GC) pressure.

## Core Evolutions

*   **Velocity Engine**: Removed `Proxy` wrappers in favor of array-like structures for Transform lists; implemented a "Hot Path" for 2-argument `calc()` operations to bypass generic allocation overhead.
*   **Algebraic Soul**: Implements the distributive law (`(A + B) * k = Ak + Bk`) and smart invert folding.
*   **Strict Typing**: Strictly adheres to the spec, forbidding operations like `number + length` (e.g., `calc(0 + 10px)`), providing precise error feedback.
*   **Full Transforms**: Complete support for CSS Transform Module Level 2, including `skew`, `perspective`, and `toMatrix()` computation.

## Supported Interfaces

Moonlight implements the core mathematical and transform interfaces of the specification:

**Primitives:**
*   `CSSStyleValue` (Entry point for parsing)
*   `CSSNumericValue` (Base class for all numeric values)
*   `CSSUnitValue` (e.g., `10px`, `50%`)
*   `CSSKeywordValue` (e.g., `auto`)
*   `CSSUnparsedValue` (Fallback type)

**Math Expressions:**
*   `CSSMathSum`, `CSSMathProduct`
*   `CSSMathNegate`, `CSSMathInvert`
*   `CSSMathMin`, `CSSMathMax`, `CSSMathClamp`

**Transforms & Matrix:**
*   `CSSTransformValue` (Array-like object, iterable)
*   `CSSTranslate`, `CSSRotate`, `CSSScale`
*   `CSSSkew`, `CSSSkewX`, `CSSSkewY`
*   `CSSPerspective`
*   Supports `.toMatrix()` returning a `DOMMatrix`

**DOM Extension:**
*   `HTMLElement.prototype.attributeStyleMap`

## Installation

Simply include the polyfill script in your project. It automatically detects native support and activates only when necessary.

```html
<script src="cssom.js"></script>
<script>
  const el = document.querySelector('#box');
  // If the browser lacks native Typed OM support, Moonlight takes over attributeStyleMap
  el.attributeStyleMap.set('opacity', 0.5);
</script>
```

## Basic Usage

### Manipulating `attributeStyleMap`

```javascript
const el = document.getElementById('hero');

// Setting styles (Auto-boxing)
el.attributeStyleMap.set('font-size', CSS.rem(1.5));
el.attributeStyleMap.set('width', CSS.px(100));
el.attributeStyleMap.set('opacity', CSS.number(0.8));

// Getting styles
const width = el.attributeStyleMap.get('width');
console.log(width.value); // 100
console.log(width.unit);  // "px"
console.log(width.toString()); // "100px"

// Type Checking
console.log(width instanceof CSSUnitValue); // true
```

### Using Factory Functions

```javascript
// Create values with different units
const angle = CSS.deg(45);
const time = CSS.s(1.5);
const percent = CSS.percent(100);

// Chained Calculations
const result = CSS.px(10).add(CSS.px(20)).mul(2);
console.log(result.toString()); // "60px" (Auto-simplified)
```

## Advanced Usage

### Algebraic Logic & Optimization

Moonlight doesn't just store expressions; it optimizes them like a compiler.

```javascript
// 1. Constant Folding
const a = CSS.px(10).mul(2);
console.log(a.toString()); // "20px" (Instead of calc(10px * 2))

// 2. Distributive Law Application
// (100% - 20px) / 2  =>  50% - 10px
const b = CSS.percent(100).sub(CSS.px(20)).div(2);
console.log(b.toString()); // "calc(50% + -10px)" 
// This optimization is crucial to prevent deeply nested calc() trees.
```

### Transforms & Matrix

Supports the full Transform Object Model and matrix computation.

```javascript
// Parse a transform string
const transform = CSSStyleValue.parse('transform', 'translate(10px, 50%) rotate(45deg)');

// Access like an array
console.log(transform[0] instanceof CSSTranslate); // true
console.log(transform[1] instanceof CSSRotate);    // true

// Iteration
for (const component of transform) {
    console.log(component.toString());
}

// Compute Matrix (Requires DOMMatrix support in browser)
const matrix = transform.toMatrix();
console.log(matrix.m11, matrix.m12, ...); 
```

## Performance Philosophy

Moonlight is built upon the **"Velocity"** philosophy:

1.  **Hot Path Optimization**: Dedicated fast paths for the most common binary operations (e.g., `width: calc(100% - 20px)`), bypassing generic array allocations.
2.  **Singleton Cache**: Uses singletons or fast-creation patterns for common values like `0px`, `1`, `0` to reduce GC pressure.
3.  **V8 Friendly**: Removed features that are hard for JS engines to optimize (like `Proxy` on hot paths), ensuring the code structure remains JIT-friendly.

In micro-benchmarks, Moonlight performs comparably to native implementations in pure algebraic computation scenarios.

## Limitations

While Moonlight is powerful, it is physically limited by the lack of context from the browser's layout engine:

*   **Relative Unit Resolution**: Cannot resolve `em`, `rem`, `vw`, or `%` to absolute pixels (`px`) because this depends on the DOM tree and layout calculation.
*   **Context Agnostic**: `CSSStyleValue.parse` does not know which element it applies to, so it cannot handle `inherit` or current-font-based calculations.
*   **Colors & Images**: Focuses primarily on numerics, math, and transforms. Complex `color()` or `image-set()` values may fall back to `CSSUnparsedValue`.

## License

[MIT](LICENSE) - Dedicated to all developers who strive for perfection.
