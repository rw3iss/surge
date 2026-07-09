import { describe, expect, it, } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateTokens, } from './auth';

function decode(token: string,): { exp: number; remember?: boolean; } {
    return jwt.decode(token,) as { exp: number; remember?: boolean; };
}

describe('generateTokens — remember me', () => {
    it('remembered sessions get a ~30-day refresh token', () => {
        const { refreshToken, } = generateTokens('u1', 'admin', true,);
        const days = (decode(refreshToken,).exp * 1000 - Date.now()) / 86_400_000;
        expect(days,).toBeGreaterThan(29,);
        expect(days,).toBeLessThan(31,);
    },);

    it('encodes the remember flag so refresh can preserve the window', () => {
        expect(decode(generateTokens('u1', 'member', true,).refreshToken,).remember,).toBe(true,);
        expect(decode(generateTokens('u1', 'member', false,).refreshToken,).remember,).toBe(false,);
    },);

    it('normal sessions get a shorter refresh token than remembered ones', () => {
        const normal = decode(generateTokens('u1', 'admin', false,).refreshToken,).exp;
        const remembered = decode(generateTokens('u1', 'admin', true,).refreshToken,).exp;
        expect(remembered,).toBeGreaterThan(normal,);
    },);
},);
