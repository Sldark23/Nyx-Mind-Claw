import { validateBootstrapAnswer, validateBootstrapProfile } from '../bootstrap';

describe('bootstrap validation', () => {
  it('accepts valid names, roles and timezones', () => {
    expect(validateBootstrapAnswer('userName', 'Ana Maria')).toBeUndefined();
    expect(validateBootstrapAnswer('agentName', 'Nyx-01')).toBeUndefined();
    expect(validateBootstrapAnswer('userRole', 'Senior Developer / Founder')).toBeUndefined();
    expect(validateBootstrapAnswer('userTimezone', 'America/Sao_Paulo')).toBeUndefined();
  });

  it('rejects unsupported characters in names', () => {
    expect(validateBootstrapAnswer('userName', 'Ana<script>')).toBe('User name contains unsupported characters');
    expect(validateBootstrapAnswer('agentName', '🤖Nyx')).toBe('Agent name contains unsupported characters');
  });

  it('rejects invalid role and timezone values with field-specific errors', () => {
    expect(validateBootstrapAnswer('userRole', 'x')).toBe('Role must be at least 2 characters');
    expect(validateBootstrapAnswer('userTimezone', 'Mars/Olympus')).toBe('Invalid timezone (e.g. America/Sao_Paulo, UTC)');
  });

  it('returns structured field errors for profile validation', () => {
    expect(validateBootstrapProfile({
      userName: 'A!',
      userRole: 'x',
      userTimezone: 'Nope/Zone',
    })).toEqual({
      userName: 'User name contains unsupported characters',
      userRole: 'Role must be at least 2 characters',
      userTimezone: 'Invalid timezone (e.g. America/Sao_Paulo, UTC)',
    });
  });
});
