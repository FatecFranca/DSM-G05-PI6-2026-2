import assert from 'node:assert/strict';
import { it } from 'node:test';
import { PasswordHasher, hashToken, newToken } from '../src/infrastructure/security/password-hasher.js';

it('protege senhas com Argon2id, salt único e verificação da senha original', async () => {
  const hasher = new PasswordHasher();
  const password = 'uma frase longa de teste!';
  const first = await hasher.hash(password);
  const second = await hasher.hash(password);
  assert.match(first, /^\$argon2id\$/);
  assert.notEqual(first, second);
  assert.equal(await hasher.verify(first, password), true);
  assert.equal(await hasher.verify(first, 'senha incorreta'), false);
  assert.equal(await hasher.verify('hash inválido', password), false);
});

it('gera tokens imprevisíveis e armazena apenas sua impressão SHA-256', () => {
  const token = newToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(newToken(), token);
  assert.match(hashToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashToken(token), token);
});
