# Moonlight CSS Typed OM Polyfill

**Moonlight** 是一个高性能、高精度的 [CSS Typed Object Model (OM) Level 1](https://www.w3.org/TR/css-typed-om/) 规范 JavaScript polyfill。

不同于普通的垫片库，Moonlight 旨在通过 **微架构优化 (Velocity Engine)** 和 **代数逻辑引擎 (Algebraic Soul)**，在不支持原生 API 的环境中提供接近甚至在某些特定场景下超越原生的性能体验。

它不仅是一个工具，更是逻辑与速度的共生体。

## 目录

- [简介](#简介)
- [核心进化](#核心进化)
- [支持的接口](#支持的接口)
- [安装](#安装)
- [基本用法](#基本用法)
- [高级用法](#高级用法)
  - [解析与严格模式](#解析与严格模式)
  - [代数运算与优化](#代数运算与优化)
  - [变换与矩阵 (Transforms)](#变换与矩阵-transforms)
- [性能哲学](#性能哲学)
- [局限性](#局限性)
- [许可证](#许可证)

## 简介

CSS Typed Object Model 允许开发者以对象的形式操作 CSS 值，而不是脆弱的字符串拼接。Moonlight 将这种能力带到了所有现代浏览器中。

它专注于：
1.  **类型安全**：严格区分 `number`、`length`、`angle` 等类型，拒绝非法计算。
2.  **数学化简**：自动应用分配律、常量折叠，将复杂的 `calc()` 树化简为最优形式。
3.  **零分配解析**：使用优化的词法分析器，最小化垃圾回收 (GC) 压力。

## 核心进化

*   **Velocity Engine (极速引擎)**: 采用类数组结构处理变换列表；针对 2 参数 `calc()` 运算提供极速“热路径 (Hot Path)”。
*   **Algebraic Soul (代数灵魂)**: 实现了数学分配律 (`(A + B) * k = Ak + Bk`) 和智能倒数折叠。
*   **Strict Typing (严苛类型)**: 严格遵循规范，禁止 `number + length` (如 `calc(0 + 10px)`)，并提供精准的错误提示。
*   **Full Transforms**: 完整支持 CSS Transform Module Level 2，包括 `skew`, `perspective` 及 `toMatrix()` 计算。

## 支持的接口

Moonlight 实现了规范中的核心数学和变换接口：

**基础值:**
*   `CSSStyleValue` (解析入口)
*   `CSSNumericValue` (所有数值基类)
*   `CSSUnitValue` (例如: `10px`, `50%`)
*   `CSSKeywordValue` (例如: `auto`)
*   `CSSUnparsedValue` (兜底类型)

**数学表达式:**
*   `CSSMathSum`, `CSSMathProduct`
*   `CSSMathNegate`, `CSSMathInvert`
*   `CSSMathMin`, `CSSMathMax`, `CSSMathClamp`

**变换与矩阵:**
*   `CSSTransformValue` (类数组对象，支持迭代)
*   `CSSTranslate`, `CSSRotate`, `CSSScale`
*   `CSSSkew`, `CSSSkewX`, `CSSSkewY`
*   `CSSPerspective`
*   支持 `.toMatrix()` 返回 `DOMMatrix`

**DOM 扩展:**
*   `HTMLElement.prototype.attributeStyleMap`

## 安装

直接在项目中引入 polyfill 脚本。它会自动检测原生支持，仅在必要时激活。

```html
<script src="cssom.js"></script>
<script>
  const el = document.querySelector('#box');
  // 如果浏览器不支持原生 Typed OM，Moonlight 将接管 attributeStyleMap
  el.attributeStyleMap.set('opacity', 0.5);
</script>
```

## 基本用法

### 操作 `attributeStyleMap`

```javascript
const el = document.getElementById('hero');

// 设置样式 (自动装箱)
el.attributeStyleMap.set('font-size', CSS.rem(1.5));
el.attributeStyleMap.set('width', CSS.px(100));
el.attributeStyleMap.set('opacity', CSS.number(0.8));

// 获取样式
const width = el.attributeStyleMap.get('width');
console.log(width.value); // 100
console.log(width.unit);  // "px"
console.log(width.toString()); // "100px"

// 类型检查
console.log(width instanceof CSSUnitValue); // true
```

### 使用工厂函数

```javascript
// 创建不同单位的值
const angle = CSS.deg(45);
const time = CSS.s(1.5);
const percent = CSS.percent(100);

// 链式计算
const result = CSS.px(10).add(CSS.px(20)).mul(2);
console.log(result.toString()); // "60px" (自动化简)
```

## 高级用法

### 代数运算与优化

Moonlight 不仅仅是存储表达式，它会像编译器一样优化它们。

```javascript
// 1. 常量折叠 (Constant Folding)
const a = CSS.px(10).mul(2);
console.log(a.toString()); // "20px" (而不是 calc(10px * 2))

// 2. 分配律应用 (Distributive Law)
// (100% - 20px) / 2  =>  50% - 10px
const b = CSS.percent(100).sub(CSS.px(20)).div(2);
console.log(b.toString()); // "calc(50% + -10px)" 
// 这种优化对于避免深层嵌套的 calc() 树至关重要
```

### 变换与矩阵 (Transforms)

支持完整的变换对象模型和矩阵计算。

```javascript
// 解析变换字符串
const transform = CSSStyleValue.parse('transform', 'translate(10px, 50%) rotate(45deg)');

// 像数组一样访问
console.log(transform[0] instanceof CSSTranslate); // true
console.log(transform[1] instanceof CSSRotate);    // true

// 迭代
for (const component of transform) {
    console.log(component.toString());
}

// 计算矩阵 (需要 DOMMatrix 支持)
const matrix = transform.toMatrix();
console.log(matrix.m11, matrix.m12, ...); 
```

## 性能哲学

Moonlight 的设计遵循 **"Velocity" (极速)** 哲学：

1.  **Hot Path Optimization**: 针对 CSS中最常见的二元运算（如 `width: calc(100% - 20px)`）编写了专门的快速路径，绕过通用的数组分配。
2.  **Singleton Cache**: 对常用的 `0px`, `1`, `0` 等值使用单例或快速创建模式，减少 GC 压力。

在微基准测试中，Moonlight 在纯代数计算场景下性能可与原生实现媲美。

## 局限性

尽管 Moonlight 非常强大，但由于缺乏浏览器的布局引擎上下文，仍存在物理局限：

*   **相对单位解析**: 无法将 `em`, `rem`, `vw`, `%` 解析为绝对像素 (`px`)，因为这依赖于 DOM 树和布局计算。
*   **上下文无关**: `CSSStyleValue.parse` 不知道它被用于哪个元素，因此无法处理 `inherit` 或基于当前字体的计算。
*   **颜色与图像**: 目前主要关注数值、数学和变换。复杂的 `color()` 或 `image-set()` 可能会回退为 `CSSUnparsedValue`。

## 许可证

[MIT](LICENSE) - 献给所有追求极致的开发者。
