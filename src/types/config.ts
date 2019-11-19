import * as t from 'io-ts';

export const Config = t.partial({
    template: t.string,
    dataDir: t.string,
    outDir: t.string,
    dateFormat: t.string,
}, 'Config');

export type Config = t.TypeOf<typeof Config>