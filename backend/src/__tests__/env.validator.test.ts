import { EnvValidator, EnvVarCategory } from '../config/envValidator';

describe('EnvValidator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validate', () => {
    it('returns valid when all critical vars are present', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.JWT_SECRET = 'a-32-char-secret-for-testing-purposes!';
      process.env.AMANA_ESCROW_CONTRACT_ID = 'C1234567890';
      process.env.USDC_CONTRACT_ID = 'C0987654321';
      process.env.STELLAR_NETWORK = 'testnet';
      process.env.TRADE_NOTES_ENCRYPTION_KEY = 'test-trade-notes-encryption-key-base64-32chr';

      const result = EnvValidator.validate();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });

    it('reports missing critical vars', () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.AMANA_ESCROW_CONTRACT_ID;
      delete process.env.USDC_CONTRACT_ID;
      delete process.env.TRADE_NOTES_ENCRYPTION_KEY;

      const result = EnvValidator.validate();
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('DATABASE_URL');
      expect(result.missing).toContain('JWT_SECRET');
      expect(result.missing).toContain('AMANA_ESCROW_CONTRACT_ID');
      expect(result.missing).toContain('USDC_CONTRACT_ID');
      expect(result.missing).toContain('TRADE_NOTES_ENCRYPTION_KEY');
    });

    it('reports invalid JWT_SECRET (too short)', () => {
      process.env.JWT_SECRET = 'short';

      const result = EnvValidator.validate();
      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('JWT_SECRET');
    });

    it('reports invalid STELLAR_NETWORK value', () => {
      process.env.STELLAR_NETWORK = 'invalid-net';

      const result = EnvValidator.validate();
      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('STELLAR_NETWORK');
    });

    it('does not report missing optional vars', () => {
      delete process.env.PINATA_API_KEY;
      delete process.env.SUPABASE_URL;

      const result = EnvValidator.validate();
      expect(result.missing).not.toContain('PINATA_API_KEY');
      expect(result.missing).not.toContain('SUPABASE_URL');
    });
  });

  describe('validateOrFail', () => {
    it('throws when critical vars are missing', () => {
      delete process.env.DATABASE_URL;

      expect(() => EnvValidator.validateOrFail()).toThrow(
        'Environment validation failed',
      );
    });

    it('does not throw when all critical vars are present', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.JWT_SECRET = 'a-32-char-secret-for-testing-purposes!';
      process.env.AMANA_ESCROW_CONTRACT_ID = 'C1234567890';
      process.env.USDC_CONTRACT_ID = 'C0987654321';
      process.env.STELLAR_NETWORK = 'testnet';
      process.env.TRADE_NOTES_ENCRYPTION_KEY = 'test-trade-notes-encryption-key-base64-32chr';

      expect(() => EnvValidator.validateOrFail()).not.toThrow();
    });
  });

  describe('validateVar', () => {
    it('returns valid for present critical var', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      const result = EnvValidator.validateVar('DATABASE_URL');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for missing critical var', () => {
      delete process.env.DATABASE_URL;
      const result = EnvValidator.validateVar('DATABASE_URL');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DATABASE_URL');
    });

    it('returns valid for unknown vars', () => {
      const result = EnvValidator.validateVar('UNKNOWN_VAR');
      expect(result.valid).toBe(true);
    });
  });

  describe('getDefinitions', () => {
    it('returns all definitions', () => {
      const defs = EnvValidator.getDefinitions();
      expect(defs.length).toBeGreaterThan(0);
      expect(defs.some((d) => d.name === 'DATABASE_URL')).toBe(true);
      expect(defs.some((d) => d.name === 'JWT_SECRET')).toBe(true);
    });
  });

  describe('getConfigSummary', () => {
    it('returns a summary with masked secrets', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.JWT_SECRET = 'super-secret-value';
      process.env.TRADE_NOTES_ENCRYPTION_KEY = 'test-key-for-encryption-purposes-12345';

      const summary = EnvValidator.getConfigSummary();
      expect(summary.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(summary.JWT_SECRET).toBe('***MASKED***');
    });
  });
});
