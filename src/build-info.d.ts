declare module '../build-info.json' {
  interface BuildInfo {
    version: string;
    buildDate: string;
    buildTimestamp: number;
    git: {
      hash: string;
      shortHash: string;
      branch: string;
      tag: string | null;
      isDirty: boolean;
    };
    environment: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  }

  const buildInfo: BuildInfo;
  export default buildInfo;
}
