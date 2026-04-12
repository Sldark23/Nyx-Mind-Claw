import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillLoader } from '../loader';
import { SkillExecutor } from '../executor';

describe('SkillLoader trigger validation', () => {
  it('warns and drops invalid trigger regex at load time', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxmind-skill-loader-'));
    const skillDir = path.join(tmpDir, 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: test-skill
description: Test skill
trigger: "[invalid"
---
body
`);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const loader = new SkillLoader(tmpDir);
      const [skill] = loader.loadAll();
      expect(skill?.trigger).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Invalid trigger regex for skill "test-skill"'));
    } finally {
      warn.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SkillExecutor file read errors', () => {
  it('returns a helpful error when the skill file disappears before execution', async () => {
    const fakeLoop = { run: jest.fn() } as any;
    const executor = new SkillExecutor(fakeLoop);

    await expect(executor.execute({
      name: 'brain-sync',
      description: 'desc',
      path: '/tmp/definitely-missing-skill.md',
    }, 'hello')).rejects.toThrow('Skill "brain-sync" is missing');
  });
});
