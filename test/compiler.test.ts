// @ts-ignore
import path from 'path';
import { describe, beforeEach, beforeAll, test, expect } from 'vitest';
import { AlfaCompiler } from '../src/compiler';

describe('AlfaCompiler', () => {
  let compiler: AlfaCompiler;
  const policyDir = path.join(__dirname, 'resources', 'policies');

  beforeAll(async () => {
    compiler = new AlfaCompiler();
    await compiler.initialize();
  });

  test('should compile ALFA content', async () => {
    const testPolicyPath = path.join(policyDir, 'valid-policy.alfa');
    const compiledResult = await compiler.compile(testPolicyPath);

    expect(compiledResult.length).toBeGreaterThan(0);
    expect(compiledResult).toBeDefined();

    const firstResult = compiledResult[0];
    const content = firstResult.content;
    const fileName = firstResult.fileName;


    expect(fileName).toBe('test.validPolicy.xml');
    expect(content).toContain('xacml3:Policy');
    expect(content).toContain('xacml3:Target');
    expect(content).toContain('xacml3:Rule');
    expect(content).toContain('http://axiomatics.com/alfa/identifier/test.validPolicy');
  });

  test('should provide meaningful error for non-existent file', async () => {
    const invalidPath = path.join(policyDir, 'nonexistent.alfa');
    await expect(compiler.compile(invalidPath)).rejects.toThrow(/no such file/);
  });

  test('should provide validation error for invalid ALFA syntax', async () => {
    const invalidSyntaxPath = path.join(policyDir, 'invalid-policy.alfa');
    await expect(compiler.compile(invalidSyntaxPath)).rejects.toThrow(/compilation failed/i);
  });
});
