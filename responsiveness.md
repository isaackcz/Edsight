# ✅ **FULL RESPONSIVENESS RULEBOOK (BOOTSTRAP)**

### 📌 *Copy this. Follow this. Your site will be fully responsive.*

---

# 🔵 **1. Page structure (Form Management)**

- Root wrapper uses `.dashboard-container` with Bootstrapped main content.
- Deadline modal uses a `row g-3` split into `col-12 col-xl-5` (list) and `col-12 col-xl-7` (form).
- Keep new sections inside `.container`/`.row` grids to match the updated layout.

---

# 🔵 **2. Always start with a container**

Use one of the following:

```html
<div class="container">
<div class="container-fluid">
<div class="container-xl">
```

**Rule:** Never put columns (`col-*`) directly inside the body.
Always inside a `.container` → `.row` → `.col`.

---

# 🔵 **3. Use the grid properly (most important)**

Correct structure:

```html
<div class="container">
  <div class="row">
    <div class="col"></div>
    <div class="col"></div>
  </div>
</div>
```

**MUST follow rules:**

* A `.row` must wrap your `.col-*` elements.
* Never put padding on `.row`; Bootstrap uses negative margins.
* Use `.col-12` on mobile by default.
* Control layout using breakpoints.

---

# 🔵 **4. Apply responsive column breakpoints**

Use the correct size for each screen.

| Screen                   | Class      |
| ------------------------ | ---------- |
| Phones (0–575px)         | `col-`     |
| Small tablets (≥576px)   | `col-sm-`  |
| Tablets (≥768px)         | `col-md-`  |
| Laptops (≥992px)         | `col-lg-`  |
| Large monitors (≥1200px) | `col-xl-`  |
| Ultra wide (≥1400px)     | `col-xxl-` |

**Example (perfect responsive layout):**

```html
<div class="col-12 col-sm-6 col-lg-4 col-xl-3">
```

---

# 🔵 **5. Control spacing with responsive margin & padding**

Format:

```
m / p  + side + breakpoint + size
```

### Sides:

`t` top
`b` bottom
`s` start (left)
`e` end (right)
`x` left + right
`y` top + bottom

### Sizes:

`0` = 0px
`1` = 4px
`2` = 8px
`3` = 16px
`4` = 24px
`5` = 48px

### **Examples (must learn):**

```html
p-3               <!-- padding all around -->
p-md-4            <!-- padding 24px on md+ -->
px-lg-5           <!-- big horizontal padding on desktop -->
mt-2 mt-lg-4      <!-- bigger top margin on desktop -->
mx-auto           <!-- center block -->
ms-auto           <!-- push element to the right -->
```

### 📐 *Containers on `/form/`:*
- The main deadline columns already rely on Bootstrap’s `p-3` and `g-3`; don’t add extra padding on nested wrappers.
- Use `py-*` and `px-*` utilities instead of inline `style="padding:..."`.
- When you need responsive padding like the deadline list, favor `clamp()` in CSS variables or Bootstrap utilities (`p-3 p-lg-4`) to keep mobile spacing tight and desktop spacing roomy.

---

# 🔵 **6. Never use fixed widths**

❌ `width: 300px;`
❌ `<img width="500">`
❌ `style="height: 400px;"`

These break mobile screens.

Use:

✔ `w-100`
✔ `img-fluid`
✔ responsive columns instead of fixed widths

---

# 🔵 **7. Make all media responsive**

### Images:

```html
<img src="..." class="img-fluid">
```

### Tables:

```html
<div class="table-responsive">
  <table class="table">...</table>
</div>
```

### Videos:

```html
<iframe class="w-100" style="aspect-ratio: 16 / 9;"></iframe>
```

---

# 🔵 **8. Use Bootstrap utility classes instead of custom CSS**

Avoid:

❌ manual px values
❌ inline CSS
❌ custom media queries unless absolutely needed

Better:

```html
< div class="d-flex justify-content-between align-items-center flex-column flex-md-row">
```

---

# 🔵 **9. Use flexbox utilities for alignment**

Examples:

```html
d-flex
flex-column
flex-md-row
align-items-center
justify-content-between
gap-3
```

**Rule:** For horizontal layouts on large screens and stacked layouts on phones:

```html
<div class="d-flex flex-column flex-md-row">
```

---

# 🔵 **10. Use display utilities to hide/show elements per device**

```html
d-none d-md-block     <!-- hide on mobile -->
d-block d-md-none     <!-- show only on mobile -->
```

---

# 🔵 **11. Always test on these breakpoints**

Before finalizing your layout, shrink your browser to these sizes:

* **320px – small phones**
* **375px – normal phones**
* **768px – tablets**
* **992px – small laptops**
* **1200px – desktops**
* **1400px – large monitors**

If your layout holds across these → it’s fully responsive.

---

# 🔵 **12. Avoid overflowing content**

Things that usually break mobile screens:

❌ long words without wrapping
❌ large images
❌ long numbers
❌ tables without wrapper
❌ text-wrap: nowrap

Fix words with:

```css
word-break: break-word;
```

---

# 🔵 **13. Navbar must use Bootstrap’s responsive classes**

Must follow structure:

```html
<nav class="navbar navbar-expand-lg navbar-light bg-light">
```

Important:

* `navbar-expand-lg` = expands at 992px+

---

# 🔵 **14. Cards: always use `h-100` when needed**

So heights equalize:

```html
<div class="card h-100">
```

---

# 🔵 **15. Use `gap-` utilities correctly**

```html
gap-2
gap-lg-4
```

Perfect for grid-like spacing without margins.

---

# 🔵 **16. Keep components inside grid columns**

Don’t place big components outside columns:
❌ FULL width uncontrolled
✔ inside `col-*`

---

# 📌 **FINAL MASTER TIP**

If your whole layout looks bad on mobile, wrap elements in:

```html
<div class="row g-3">
```

This adds equal spacing and prevents content from sticking together.

---

# ⭐ If you want, I can review your layout and adjust spacing + grid breakpoints for perfect responsiveness.
