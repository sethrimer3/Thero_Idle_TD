# Tower Equation Guidelines

## Master Equation

- Each tower has a **Master Equation** that multiplies the results of its primary sub-equations.
- Primary sub-equations are the variables that directly dictate the tower's behavior (e.g., \(\text{Atk}\), \(\text{Spd}\), \(\text{Rng}\), \(\text{Prc}\)).
- Variables referenced **inside** a sub-equation (such as `totalTowers` in \(\text{Spd} = 10 \times \text{totalTowers}\)) do **not** appear in the Master Equation—only the sub-equation's named result does.
- Example: the alpha tower follows \(\alpha = \text{Atk} \times \text{Spd}\); beta appends range for \(\beta = \text{Atk} \times \text{Spd} \times \text{Rng}\).

## Sub-Equation Naming

- Variables that feed the Master Equation are called **sub-equations**.
- Sub-equation headings use the three-letter abbreviation of the variable that they resolve (e.g., "Atk", "Spd").
- Expressions and explanatory text should reference the abbreviation to reinforce the connection between the sub-equation and the Master Equation term.

## Variable Indicators

- Display indicators for sub-equations use the three-letter abbreviations:
  - **Atk** – Attack
  - **Spd** – Attack Speed
  - **Rng** – Range
  - **Prc** – Pierce
- These indicators appear in the yellow icon for the sub-equation card and wherever the variable name is shown in UI callouts.
- Glyph labels (e.g., \(\aleph_1\), \(\aleph_2\)) remain unchanged and are shown inside the sub-equation expressions.

## Implementation Notes

- When updating additional towers, follow the same product-based Master Equation structure.
- Keep the Master Equation label text in UI references synchronized with these guidelines.
- The blueprint data in `assets/towerEquations/` should express each Master Equation using the 3-letter abbreviations.
