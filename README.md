# ALFA Compiler

A Node.js-based compiler for ALFA (Abbreviated Language for Authorization) policy files. This compiler leverages the ALFA language server packaged with the VS Code extension to provide accurate parsing, validation, and compilation of ALFA policies.

Two REST endpoints are provided by the language server:

- `/compile` - Compiles one ALFA file into XACML. This takes a single ALFA file provided as text/plain content in the request body and returns the compiled XACML as text/xml.
- `/compile-multiple` - Compiles multiple ALFA files into XACML. This takes a JSON array of ALFA files provided as application/json content in the request body and returns the compiled XACML as text/xml. The JSON array should contain objects with `fileName` and `content` properties.

For examples refer to the `test/server.test.ts` file. Sample ALFA policies are available in the `test/resources/policies` folder.

# High level description of implementation

Axiomatics provides a [VS Code extension](https://marketplace.visualstudio.com/items?itemName=Axiomatics.alfa) for ALFA. This extension includes an ALFA language server implemented in Java as a JAR file. That JAR file is stored in this repository under `server/alfa-language-server.jar`.

This package starts the language server as a child process and uses the language server protocol to communicate with it.

The two main components in this package are:

- A rest server exposed in `src/index.ts` that exposes the two endpoints `/compile` and `/compile-multiple`.
- A compiler client exposed in `src/compiler.ts` that communicates with the language server using the language server protocol. This interaction is implemented in `language-server-client.ts`.

## Installation

```bash
npm run global-install
```

## Starting the Compiler Server

```bash
alfa-compiler
```

You should see the following output when the server is running:

```
2025-11-11 09:36:47 [info] [AlfaCompiler]: ALFA compiler ready!
2025-11-11 09:36:47 [info] [index.ts]: Server running on http://localhost:3000
```

## Development

This project uses TypeScript and ES modules. To get started:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with debug output
npm run test:debug
```
