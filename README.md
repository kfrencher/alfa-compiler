# ALFA Compiler

A Node.js-based compiler for ALFA (Abbreviated Language for Authorization) policy files.

## Installation

```bash
npm install
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

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Usage

### Command Line

The compiler requires and always uses the ALFA language server for compilation:

```bash
# Compile an ALFA file using the language server
npm start examples/sample-policy.alfa

# Compile and save to output file
npm start examples/sample-policy.alfa -- -o output/compiled.js

# Use custom Java path (if java is not in PATH)
npm start examples/sample-policy.alfa -- --java /path/to/java

# Use custom language server command
npm start examples/sample-policy.alfa -- --lsp custom-command --lsp-args arg1,arg2

# Show help
npm start -- --help
```

### Direct Usage (after building)

```bash
# Compile an ALFA file (always uses language server)
node dist/index.js examples/sample-policy.alfa

# Compile and save to output file
node dist/index.js examples/sample-policy.alfa -o output/compiled.js

# Use custom Java executable
node dist/index.js examples/sample-policy.alfa --java /path/to/java
```

### Programmatic Usage

```javascript
const AlfaCompiler = require("./src/compiler");

const compiler = new AlfaCompiler();
compiler.compile("input.alfa", "output.js");
```

## Project Structure

```
├── index.js          # CLI entry point
├── src/
│   └── compiler.js   # Main compiler logic
├── test/             # Test files
├── examples/         # Example ALFA files
└── package.json      # Project configuration
```

## Development

This is a barebones project structure. The actual ALFA compilation logic needs to be implemented in `src/compiler.js`.

### Language Server Integration

The compiler automatically uses the ALFA language server (`server/alfa-language-server.jar`) which provides:

- ✅ Accurate ALFA syntax parsing and validation
- ✅ Real-time diagnostics and error reporting
- ✅ Language-aware compilation
- ✅ Hover information and completions
- ✅ Symbol definitions and references

### Requirements

- **Java Runtime Environment (JRE)** - Required to run the ALFA language server
- **Node.js 16+** - For running the TypeScript compiler

### TODO

- [x] Implement ALFA language server integration
- [x] Add comprehensive error handling
- [x] Add unit tests with Vitest
- [x] Add example ALFA files
- [x] Add TypeScript support with ES modules
- [ ] Add more comprehensive ALFA examples
- [ ] Add configuration file support
- [ ] Add batch compilation support

## License

ISC
