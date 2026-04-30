# BRUT-V Web Static

Static browser build of BRUT-V: a RISC-V sketch environment with:

- a JavaScript assembler
- a RV32I+M+F simulator
- an embedded drawing framework
- embedded example sketches

This repository is intended to be published with GitHub Pages so the site is publicly accessible for free.

## Local preview

From the repository root:

```powershell
python -m http.server 8000
```

Then open:

`http://localhost:8000/`

## GitHub Pages

If this repository is pushed to GitHub under the `op-rt` account, the site can be published with GitHub Pages from the `main` branch, root folder.

Expected public URL:

`https://op-rt.github.io/<repo-name>/`
