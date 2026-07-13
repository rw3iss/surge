// Minimal ambient types for adm-zip (only the surface we use).
declare module 'adm-zip' {
    interface AdmZipEntry {
        entryName: string;
        isDirectory: boolean;
    }
    class AdmZip {
        constructor(input?: string | Buffer);
        getEntries(): AdmZipEntry[];
        extractAllTo(targetPath: string, overwrite?: boolean): void;
    }
    export = AdmZip;
}
