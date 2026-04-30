# BRUT-V Web Static

This repository contains a minimal environment for reading, writing and running sketches composed with **BRUT-V**, a creative coding framework in **RISC-V assembly**.

It includes:

- a browser-based code editor
- a JavaScript assembler
- a small RISC-V virtual machine
- the BRUT-V macro framework
- a set of example sketches

## What BRUT-V Is

**BRUT-V** is a minimal creative coding framework built on a restrained **RV32I-inspired** assembly model, close in spirit to **RARS**. Its goal is to make image-making emerge from a sparse, explicit, low-level writing practice shaped by asceticism and a search for austere beauty.

At its core, BRUT-V tries to transpose ideas from **Code Art Brutalism** as formulated by **Simon Yuill** into a sketching environment:

- rejection of ornament
- structural legibility
- material austerity
- pragmatic realism
- schematic, elementary construction

The project draws a parallel between **Brutalist architecture** and **assembly language**:

- exposed structure instead of concealed mechanism
- direct construction instead of decorative abstraction
- limited means used deliberately
- beauty sought through rigor, constraint and reduction

BRUT-V is organized around a compact toolchain:

- a **RISC-V assembler** in JavaScript
- a **minimal VM**, primarily centered on **RV32I**, with additional support used by the framework
- a **macro layer** providing the equivalent of elementary **Processing-like** features

These macros implement the basic vocabulary needed to write sketches:

- canvas setup
- pixels and primitives
- stroke and fill
- transforms
- text
- noise
- animation
- utility math helpers
