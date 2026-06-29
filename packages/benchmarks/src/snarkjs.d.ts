// Minimal ambient typing for snarkjs (an optional dependency that ships no types).
// Only the surface the benchmarks use is declared.
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: object; publicSignals: string[] }>;
    verify(vkey: object, publicSignals: string[], proof: object): Promise<boolean>;
  };
}
