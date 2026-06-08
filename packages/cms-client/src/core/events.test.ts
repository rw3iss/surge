import { describe, expect, it, vi, } from 'vitest';
import { Emitter, } from './events';

describe('Emitter', () => {
    it('subscribes and emits typed events', () => {
        const em = new Emitter<{ ping: number }>();
        const cb = vi.fn();
        em.on('ping', cb,);
        em.emit('ping', 42,);
        expect(cb,).toHaveBeenCalledWith(42,);
    },);
    it('unsubscribe stops delivery', () => {
        const em = new Emitter<{ ping: number }>();
        const cb = vi.fn();
        const off = em.on('ping', cb,);
        off();
        em.emit('ping', 1,);
        expect(cb,).not.toHaveBeenCalled();
    },);
    it('once fires a single time', () => {
        const em = new Emitter<{ ping: number }>();
        const cb = vi.fn();
        em.once('ping', cb,);
        em.emit('ping', 1,); em.emit('ping', 2,);
        expect(cb,).toHaveBeenCalledTimes(1,);
    },);
    it('a throwing handler does not break other handlers', () => {
        const em = new Emitter<{ ping: number }>();
        const good = vi.fn();
        em.on('ping', () => { throw new Error('boom',); },);
        em.on('ping', good,);
        expect(() => em.emit('ping', 1,),).not.toThrow();
        expect(good,).toHaveBeenCalled();
    },);
},);
