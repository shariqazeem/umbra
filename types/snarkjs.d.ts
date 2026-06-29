// Minimal ambient typing for snarkjs (ships no types).
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(vkey: object, publicSignals: string[], proof: object): Promise<boolean>;
  };
}
