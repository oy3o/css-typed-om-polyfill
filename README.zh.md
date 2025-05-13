# CSS Typed OM Polyfill

一个针对 [CSS Typed Object Model (OM) Level 1](https://www.w3.org/TR/css-typed-om/) 规范的 JavaScript polyfill。此 polyfill 旨在为那些本身不支持 CSS Typed OM API 的浏览器提供一个功能子集，使开发者能够以类型化 JavaScript 对象的方式与 CSS 值进行交互。

## 目录

- [简介](#简介)
- [特性](#特性)
- [支持的 CSS Typed OM 接口](#支持的-css-typed-om-接口)
- [安装](#安装)
- [基本用法](#基本用法)
- [高级用法与注意事项](#高级用法与注意事项)
  - [解析 CSS 值](#解析-css-值)
  - [`calc()` 与数学函数](#calc-与数学函数)
  - [算术运算](#算术运算)
  - [`var()` (CSS 变量)](#var-css-变量)
- [局限性与待办事项](#局限性与待办事项)
- [开发](#开发)
- [许可证](#许可证)

## 简介

CSS Typed Object Model 提供了一种在 JavaScript 中以类型感知的方式操作 CSS 值的方法，而不是仅仅处理字符串。这可以带来更健壮和更高性能的代码。此 polyfill 将这种能力的一部分带到了缺乏原生支持的环境中。

它专注于将 CSS 字符串解析为类型化对象，对数值执行算术运算，并提供 `element.attributeStyleMap` 接口以便以类型化的方式获取和设置样式。

## 特性

*   **`HTMLElement.prototype.attributeStyleMap`**: 使用 `StylePropertyMap` 访问和修改内联样式。
*   **CSS 值解析**:
    *   `CSSStyleValue.parse(property, cssText)`: 解析单个 CSS 值字符串。
    *   `CSSStyleValue.parseAll(property, cssText)`: 解析逗号分隔的 CSS 值列表。
*   **数值**:
    *   `CSSNumericValue` (数字和单位的基类)。
    *   `CSSUnitValue` (例如, `10px`, `50%`, `3.14rad`)。
    *   `CSS.*` 工厂函数 (例如, `CSS.px(10)`, `CSS.percent(50)`, `CSS.number(5)`)。
    *   算术运算: `.add()`, `.sub()`, `.mul()`, `.div()`, `.negate()`, `.invert()`。
    *   单位转换: `.to('targetUnit')` 用于兼容类型 (例如, `s` 转 `ms`)。
    *   数学运算的类型检查 (例如, `length + angle` 是无效的)。
*   **数学表达式**:
    *   `CSSMathSum`, `CSSMathProduct`, `CSSMathNegate`, `CSSMathInvert`。
    *   `CSSMathMin`, `CSSMathMax`。
    *   递归解析 `calc()`、`min()`、`max()` 表达式，包括嵌套函数和 `var()`。
*   **其他 CSS 值**:
    *   `CSSKeywordValue` (例如, `auto`, `inherit`, `initial`)。
    *   `CSSVariableReferenceValue` (用于 `var(--custom-property)`)。
    *   `CSSUnparsedValue` (用于未完全解析或不支持的值)。
*   **桩实现/部分实现**:
    *   `CSSImageValue` (基础桩实现, 将 `url(...)` 作为字符串返回)。
    *   `CSSPositionValue` (基础桩实现)。
    *   `CSSTransformValue` 及其组件 (`CSSTranslate`, `CSSRotate`, `CSSScale`) (带有构造函数和 `toString()` 的基础桩实现)。

## 支持的 CSS Typed OM 接口

**核心类:**
*   `CSSStyleValue` (抽象基类)
*   `CSSNumericValue` (数值类型的抽象基类)
*   `CSSUnitValue`
*   `CSSKeywordValue`
*   `CSSUnparsedValue`
*   `CSSVariableReferenceValue`

**数学类 (继承自 `CSSNumericValue`):**
*   `CSSMathValue` (抽象基类)
*   `CSSMathSum`
*   `CSSMathProduct`
*   `CSSMathNegate`
*   `CSSMathInvert`
*   `CSSMathMin`
*   `CSSMathMax`

**其他 (桩实现/部分实现):**
*   `CSSImageValue`
*   `CSSPositionValue`
*   `CSSTransformValue`
*   `CSSTransformComponent` (抽象基类)
*   `CSSTranslate`
*   `CSSRotate`
*   `CSSScale`

**接口:**
*   `StylePropertyMap` (通过 `element.attributeStyleMap` 提供)

## 安装

只需在您的 HTML 文件中，在使用 CSS Typed OM API 的任何脚本之前引入 polyfill 脚本即可：

```html
<script src="path/to/css-typed-om-polyfill.js"></script>
<script>
  // 您使用 Typed OM 的代码
  const el = document.getElementById('myElement');
  if (el && el.attributeStyleMap) {
    el.attributeStyleMap.set('width', CSS.px(100));
    console.log(el.attributeStyleMap.get('width').toString()); // "100px"
  }
</script>
```

polyfill 将自动初始化并将必要的属性附加到全局作用域 (`window`) 和 `HTMLElement.prototype`。

## 基本用法

### 访问 `attributeStyleMap`

```javascript
const element = document.createElement('div');
document.body.appendChild(element);

// 设置样式
element.attributeStyleMap.set('width', CSS.px(200));
element.attributeStyleMap.set('opacity', CSS.number(0.5));
element.attributeStyleMap.set('margin-top', CSS.em(1.5));

// 获取样式
const width = element.attributeStyleMap.get('width'); // CSSUnitValue { value: 200, unit: "px" }
console.log(width.value); // 200
console.log(width.unit);  // "px"
console.log(width.toString()); // "200px"

const opacity = element.attributeStyleMap.get('opacity'); // CSSNumericValue { _value: 0.5, _unitType: "number" }
console.log(opacity.toString()); // "0.5"
```

### 使用 `CSS.*` 工厂函数

```javascript
const length = CSS.px(100);
const percentage = CSS.percent(50);
const duration = CSS.s(2.5);
const angle = CSS.deg(90);
const number = CSS.number(10);

console.log(length.add(CSS.vw(10)).toString()); // "calc(100px + 10vw)"
```

## 高级用法与注意事项

### 解析 CSS 值

```javascript
// 解析单个值
const parsedWidth = CSSStyleValue.parse('width', 'calc(100% - 20px)');
console.log(parsedWidth.toString()); // "calc(100% - 20px)"
if (parsedWidth instanceof CSSMathSum) {
  console.log(parsedWidth.operator); // "sum"
  console.log(parsedWidth.values[0].toString()); // "100%"
  console.log(parsedWidth.values[1].toString()); // "calc(-1 * 20px)" (第二项被取反)
}

const keyword = CSSStyleValue.parse('display', 'block');
console.log(keyword.value); // "block"

// 解析值列表 (例如, 用于 font-family)
const fontFamilies = CSSStyleValue.parseAll('font-family', '"Arial", sans-serif');
fontFamilies.forEach(font => console.log(font.toString()));
// 输出:
// "Arial" (字符串的 CSSUnparsedValue)
// "sans-serif" (CSSKeywordValue)
```

### `calc()` 与数学函数

此 polyfill 包含一个针对 `calc()`、`min()` 和 `max()` 表达式的健壮解析器，它遵循运算符优先级和括号规则。

```javascript
const complexCalc = CSSStyleValue.parse('width', 'calc( (var(--A) + 2 * ( 5vw - var(--B) )) / 3 )');
console.log(complexCalc.toString()); // "calc((var(--A) + 2 * (5vw - var(--B))) / 3)"
// 内部结构将是一个由 CSSMathProduct, CSSMathSum 等组成的树
```

### 算术运算

`CSSNumericValue` 及其子类支持算术运算。涉及不同兼容单位或 `var()` 的运算将产生 `CSSMathSum` 或 `CSSMathProduct` 对象。

```javascript
const val1 = CSS.px(10);
const val2 = CSS.em(2);
const val3 = CSS.percent(50);
const num = CSS.number(5);

// 加法
console.log(val1.add(val2).toString());         // "calc(10px + 2em)"
console.log(val1.add(CSS.px(5)).toString());   // "15px" (相同单位)

// 减法
console.log(val3.sub(CSS.px(10)).toString());   // "calc(50% - 10px)"

// 乘法
console.log(val1.mul(num).toString());          // "50px" (长度 * 数字 = 长度)
console.log(val1.mul(CSS.percent(200)).toString()); // "calc(10px * 200%)" (长度 * 百分比)

// 除法
console.log(val1.div(num).toString());          // "2px"
console.log(val1.div(CSS.px(2)).toString());    // "5" (长度 / 长度 = 数字)
```

### `var()` (CSS 变量)

`var()` 表达式被解析为 `CSSVariableReferenceValue` 对象。它们可以在数学函数和算术运算中使用，并保持未解析状态。

```javascript
const myVar = CSSStyleValue.parse('width', 'var(--my-width, 100px)');
console.log(myVar.variable); // "--my-width"
console.log(myVar.fallback.toString()); // "100px"

const calcWithVar = CSS.px(10).add(myVar);
console.log(calcWithVar.toString()); // "calc(10px + var(--my-width, 100px))"
```

## 局限性与待办事项

此 polyfill 尚在开发中，并未覆盖整个 CSS Typed OM 规范。主要局限性包括：

*   **`clamp()`**: 目前在数学表达式解析器中不支持（如果位于顶层，将解析为 `CSSUnparsedValue`；如果在 `calc()` 内部，则会抛出错误）。
*   **颜色值**: 复杂的颜色函数 (例如, `rgb()`, `hsl()`, `color()`) 通常被解析为 `CSSUnparsedValue`。基本的命名颜色可能解析为 `CSSKeywordValue`。
*   **详细的 Transform 解析**: 虽然存在带有构造函数的 `CSSTransformValue` 及其组件类 (`CSSTranslate`, `CSSRotate`, `CSSScale`)，但主要的 `CSSStyleValue.parse` 会对 transform 函数字符串返回 `CSSUnparsedValue`。您需要手动构造它们。
*   **`CSSNumericValue.equals()`**: 提供简化的结构检查，主要通过 `toString()` 比较，对于所有数学上等价但结构不同的表达式可能不够健壮。
*   **类型系统细微之处**: 数学值上的 `type()` 方法尝试确定结果类型 (例如, `length`, `angle`, `percent`)，但复杂的交互，特别是与 `var()` 的交互，可能导致类型不确定。
*   **无实际值计算**: polyfill 解析并表示 CSS 值和表达式。它**不会**计算表达式的最终使用值 (例如, 它不会将 `calc(10px + 5%)` 解析为单个像素值，因为这需要布局上下文)。
*   **简写属性**: 如果浏览器在 `element.style` 中没有将简写属性展开为完整属性，`StylePropertyMap.get()` 可能会对简写属性返回 `null` 或未解析的值。polyfill 依赖于 `element.style.getPropertyValue()` 的返回值。
*   **有限的特定属性解析**: `CSSStyleValue.parse(property, cssText)` 目前不使用 `property` 参数来指导特定于该属性语法的解析（超出基本区分）。

**未来增强 (待办事项):**
*   实现 `clamp()`。
*   改进颜色值的解析。
*   将 transform 函数完整解析为 `CSSTransformValue`。
*   更健壮的 `CSSNumericValue.equals()`。
*   支持更多 `CSSStyleValue` 子类 (例如, `CSSSkew`, `CSSPerspective`, `CSSMatrixComponent`)。
*   考虑 `CSSMathClamp`。

## 开发

代码包含在一个 IIFE (立即调用函数表达式) 中。数学表达式的核心解析逻辑位于 `parseCssMathExpression` 中。`CSSStyleValue.parse` 是解析 CSS 文本的主要入口点。

脚本末尾包含一个用 `setTimeout` 包装的示例用法代码，可在浏览器环境中用于测试。

## 许可证

[MIT](LICENSE)