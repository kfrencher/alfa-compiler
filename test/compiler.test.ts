// @ts-ignore
import path from 'path';
import { describe, beforeEach, test, expect } from 'vitest';
import { AlfaCompiler } from '../src/compiler';

describe('AlfaCompiler', () => {
  let compiler: AlfaCompiler;

  beforeEach(() => {
    compiler = new AlfaCompiler();
  });

  test('should compile ALFA content', async () => {
    const sampleFilePath = path.join(__dirname, 'server', 'policies', 'placeholder.alfa');
    const compiledResult = await compiler.compile(sampleFilePath);

    expect(compiledResult.length).toBeGreaterThan(0);
    expect(compiledResult).toBeDefined();

    var firstResult = compiledResult[0];

    expect(firstResult).toContain('xacml3:Policy'); 
    expect(firstResult).toContain('xacml3:Target'); 
    expect(firstResult).toContain('xacml3:Rule'); 
    expect(firstResult).toContain('http://axiomatics.com/alfa/identifier/example.simplepolicy'); 
  }, 8000);
});