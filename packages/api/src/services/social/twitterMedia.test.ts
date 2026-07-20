import { describe, expect, it, } from 'vitest';
import { chunkCount, mediaCategory, needsChunkedUpload, } from './twitterMedia';

describe('mediaCategory', () => {
    it('maps MIME to X media_category', () => {
        expect(mediaCategory('image/jpeg',),).toBe('tweet_image',);
        expect(mediaCategory('image/png',),).toBe('tweet_image',);
        expect(mediaCategory('image/gif',),).toBe('tweet_gif',);
        expect(mediaCategory('video/mp4',),).toBe('tweet_video',);
    },);
},);

describe('needsChunkedUpload', () => {
    it('small images upload simple; gifs/videos/large go chunked', () => {
        expect(needsChunkedUpload('image/jpeg', 1_000_000,),).toBe(false,);
        expect(needsChunkedUpload('image/jpeg', 6 * 1024 * 1024,),).toBe(true,); // >5MB
        expect(needsChunkedUpload('image/gif', 100,),).toBe(true,);
        expect(needsChunkedUpload('video/mp4', 100,),).toBe(true,);
    },);
},);

describe('chunkCount', () => {
    it('splits into 4MB segments, minimum one', () => {
        expect(chunkCount(0,),).toBe(1,);
        expect(chunkCount(1024,),).toBe(1,);
        expect(chunkCount(4 * 1024 * 1024,),).toBe(1,);
        expect(chunkCount(4 * 1024 * 1024 + 1,),).toBe(2,);
        expect(chunkCount(10 * 1024 * 1024,),).toBe(3,);
    },);
},);
