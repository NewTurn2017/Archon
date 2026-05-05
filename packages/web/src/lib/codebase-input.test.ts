import { describe, expect, test } from 'bun:test';
import { getCodebaseInput } from '@/lib/codebase-input';

describe('getCodebaseInput', () => {
  test('treats GitHub repository inputs as urls', () => {
    expect(getCodebaseInput('https://github.com/coleam00/HarneesLab')).toEqual({
      url: 'https://github.com/coleam00/HarneesLab',
    });
  });

  test('treats SSH git@ shorthand as urls', () => {
    expect(getCodebaseInput('git@github.com:coleam00/HarneesLab.git')).toEqual({
      url: 'git@github.com:coleam00/HarneesLab.git',
    });
  });

  test('treats ssh:// URLs as urls', () => {
    expect(getCodebaseInput('ssh://git@github.com/coleam00/HarneesLab.git')).toEqual({
      url: 'ssh://git@github.com/coleam00/HarneesLab.git',
    });
  });

  test('treats git:// URLs as urls', () => {
    expect(getCodebaseInput('git://github.com/coleam00/HarneesLab.git')).toEqual({
      url: 'git://github.com/coleam00/HarneesLab.git',
    });
  });

  test('trims surrounding whitespace before classifying', () => {
    expect(getCodebaseInput('  https://github.com/a/b  ')).toEqual({
      url: 'https://github.com/a/b',
    });
  });

  test('treats relative local paths as paths', () => {
    expect(getCodebaseInput('./repo')).toEqual({ path: './repo' });
    expect(getCodebaseInput('../repo')).toEqual({ path: '../repo' });
    expect(getCodebaseInput('repo')).toEqual({ path: 'repo' });
  });

  test('treats unix local paths as paths', () => {
    expect(getCodebaseInput('/path/to/repository')).toEqual({
      path: '/path/to/repository',
    });
  });

  test('treats home-relative paths as paths', () => {
    expect(getCodebaseInput('~/src/harneeslab')).toEqual({
      path: '~/src/harneeslab',
    });
  });

  test('treats windows local paths as paths', () => {
    expect(getCodebaseInput('C:\\repo\\harneeslab')).toEqual({
      path: 'C:\\repo\\harneeslab',
    });
  });

  test('treats windows UNC paths as paths', () => {
    expect(getCodebaseInput('\\\\server\\share\\harneeslab')).toEqual({
      path: '\\\\server\\share\\harneeslab',
    });
  });
});
