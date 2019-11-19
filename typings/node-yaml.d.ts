declare module "node-yaml" {
  function readSync(path: string | number, options?: { encoding?: 'utf-8'; flag?: string; } | null): object
}
