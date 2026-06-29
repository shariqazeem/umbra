Plan to Win the “Stellar Hacks: Real‑World ZK” Hackathon

1 Goal and Strategy

The hackathon’s purpose is to showcase real‑world zero‑knowledge (ZK) applications on Stellar.  Projects must deploy proofs on‐chain and demonstrate an end‑to‑end system (code + video).
Our project, Umbra, already provides a ZK‑based privacy pool with shielding, unshielding and private sends on Stellar testnet.  To maximise our chances of winning, we should deliver a polished, trustworthy product that solves a real problem, addresses the judges’ criteria (impact, technical depth, design and openness) and demonstrates leadership in the emerging ZK design space on Stellar.

STKR20 on Starknet shows how to productise a privacy pool: users can shield assets in a wallet, use private swaps and transfers, and unshield with one‑click flows .  The system stores notes on‑chain, verifies proofs to ensure notes exist, belong to the spender and are unspent , supports multiple token types  and includes an encrypted viewing‑key for optional disclosure .  STRK20 also emphasises wallet integration (Ready/Xverse) and a beautiful brand.  We can emulate this approach on Stellar by extending Umbra beyond a demo and polishing the UX.

2 Analysis of Current State

Technical strengths:  The core cryptography is real and live.  Umbra verifies Groth16 proofs using BLS12‑381 host functions on Soroban; the circuits (shield/withdraw), Merkle tree, nullifier set and on‑chain pool contract all work and have been tested.  A dark, cinematic wallet UI exists with shield, send, unshield and pay‑link flows.

Limitations:

* Only shield (deposit) and unshield (withdraw to a public address) are implemented.  There is no shielded‑to‑shielded transfer or join‑split.
* The pool supports only a single asset (XLM).
* There is no compliance path; Umbra does not offer viewing keys or selective disclosure.
* The proof generation and trusted setup are demo‑grade (depth‑8 Merkle tree, single‑contributor ceremony).
* The SDK is unpublished, wallet integration is limited to testnet keys/Freighter, and the design and narrative could be refined.

Given the short timeframe (deadline 29 June) and unlimited access to Claude Opus 4.8 for coding, we should prioritise features that deliver clear value and are implementable quickly while showcasing zero‑knowledge.  The strongest impact comes from enabling private P2P transfers, multi‑asset support, selective disclosure, and a polished UX integrated with a mainstream wallet.

3 Proposed Feature Enhancements

3.1 Implement shielded‑to‑shielded transfers (join‑split)

A key differentiator of STRK20 is that users can move funds privately within the pool via private transfers .  To match this:

* Add a join‑split circuit in Circom/Noir that proves that two input notes exist, are unspent, and the sum of their amounts equals the sum of the output notes.  The circuit should calculate new nullifiers for inputs and commitments for outputs.
* Extend the Merkle tree depth (e.g., 16 or 20) so the pool can scale beyond 256 notes.
* Create a transfer method in the pool contract: it verifies the join‑split proof, checks nullifiers/root, inserts new commitments and emits an event.
* Update the wallet: add a “Private Transfer” action where a user can select recipients by address or payment link and send shielded notes.

This will allow participants to move within the privacy pool without unshielding, unlocking true private P2P flows.

3.2 Support multiple assets and stablecoins

STRK20 supports multiple token types in one pool , making privacy available to any ERC‑20 asset.  On Stellar, the hackathon encourages real‑world use cases such as stablecoins and cross‑border payments.  We should:

* Generalise notes to include an asset_id (e.g., SEP‑41 token address).
* Modify circuits to treat amount and asset_id as public inputs and enforce conservation across inputs and outputs.
* Update the pool contract so a single pool contract can hold different assets; the Merkle tree does not need to change, but the contract must transfer tokens appropriately when shielding/unshielding.
* Demonstrate with a stablecoin (e.g., testnet USDC or a token minted via Stellar testnet).  Show shielding USDC, transferring privately and unshielding to a public address.

This addresses the hackathon’s focus on real‑world payment primitives and differentiates the project.

3.3 Add selective disclosure via viewing keys

Privacy pools should coexist with compliance requirements.  STRK20 introduces a viewing‑key framework that allows third parties to audit transactions when required .  To incorporate this:

* Implement encrypted viewing keys: when generating a note, encrypt the note’s secret and details under a user‑controlled public key (e.g., using Elliptic Curve Diffie‑Hellman and symmetric encryption).
* Add a function to decrypt and produce a proof that reveals a note’s metadata (amount, asset, sender) without exposing other notes.  This can be used to comply with a legitimate audit request.
* Provide UI controls to export or revoke viewing keys.

This feature demonstrates responsible privacy and may impress judges with regulatory awareness.

3.4 Publish and document the SDK

Our hackathon entry will be more impactful if other developers can build on it.

* Polish and publish @umbra/sdk (rename if needed) with functions to create notes, generate proofs, interact with the pool contract and encode payment links.
* Provide clear examples of integrating the SDK into an existing Stellar dApp (e.g., a donation platform) to show ease of adoption.

3.5 Refine the UX and narrative

The hackathon emphasises that projects should have a clear README, a demo video and a well‑framed story.  We can draw inspiration from STRK20’s narrative:

* Emulate a cinematic, premium design with dark themes, motion and a 3D pool scene, but tailor it to the Stellar brand colours.
* Craft a compelling story: “Private money on Stellar for real‑world assets”—illustrate how a freelancer in Pakistan receives USDC privately, pays suppliers and then unshields to their bank.
* Use Ali Abdaal’s script structure (hook–intro–value–end screen) to write the 2‑3 minute demo video:
    * Hook: emphasise that users can send money privately like using cash and keep their business confidential.
    * Intro: present yourself as the team behind Umbra, mention the successful on‑chain proofs and prior hackathon wins.
    * Value: showcase shielding USDC, private transfer and selective disclosure; highlight multi‑asset and P2P features; reference the underlying ZK cryptography.
    * End screen: invite viewers to explore the repo and suggest building with the SDK.

3.6 Integration with wallets

For adoption, Umbra should work seamlessly with mainstream Stellar wallets (e.g., Freighter, Xverse).

* Implement wallet connectors for Xverse (which already supports STRK20 shielding ) and Freighter.
* Provide fallback testnet keys for the demo.

3.7 Testing, documentation and deployment

* Write unit and integration tests for circuits and contracts.
* Benchmark transaction costs to stay within Soroban’s instruction limits.
* Deploy the updated pool and verifier to the testnet; document contract IDs and provide instructions for verifying transactions on Stellar Explorer.
* Prepare the repo: include a clear README, license, build instructions, and known limitations.

4 Prompts for Claude Opus 4.8

Below are example prompts to delegate tasks to Claude.  Each prompt is designed to leverage Claude’s coding and reasoning capabilities.  You can adapt them as needed.  Keep the conversation with Claude focused and iterative, and ensure you review and test the generated output.

1. Create join‑split circuit
    You are a senior zero‑knowledge engineer.  Write a Circom circuit (transfer.circom) for a shielded‑to‑shielded transfer in a privacy pool.  The circuit should accept public inputs: Merkle root, list of input nullifiers, list of new commitments, recipient’s public key(s) and total input & output amounts.  Private inputs: secrets for two existing notes (secret, amount, asset_id, leafIndex), sibling paths for inclusion proof and new secrets for output notes.  The circuit must enforce: (i) each input note is on the Merkle tree at the given root; (ii) each nullifier = Poseidon(secret, leafIndex) and is unique; (iii) the sum of input amounts equals the sum of output amounts; (iv) each new commitment = Poseidon(newSecret, amount, asset_id).  Use Poseidon hash and field BN254.  Output the circuit code and a brief explanation of the constraints.
2. Update pool contract
    You are an expert Rust and Soroban developer.  Modify our existing umbra-pool contract to support a new transfer() method that verifies a Groth16 proof for the join‑split circuit, checks that input nullifiers have not been spent, validates the Merkle root, inserts new commitments into the Merkle tree and transfers no tokens (because assets remain in the pool).  Also modify shield() and withdraw() methods to accept an asset_id and transfer the specified asset.  Ensure the contract maintains a map of recent Merkle roots and handles multiple assets securely.
3. Selective disclosure framework
    Design and implement a selective disclosure mechanism for Umbra.  When generating a note, encrypt the note’s secret, amount and asset_id using a user‑supplied public key (e.g., secp256r1).  Provide functions to decrypt the note with the corresponding private key and to generate a proof that reveals only the requested fields.  Produce TypeScript code for the client (encryption/decryption) and sketch the Rust functions needed to handle viewing key storage in the contract.  Explain the cryptographic choices and how this satisfies compliance.
4. Multi‑asset circuit and tests
    Extend the Circom shield and withdraw circuits to include asset_id as a public input.  Modify the constraints so that each note commitment includes the asset_id.  Write unit tests using snarkjs to prove and verify a shield and withdraw proof for a USDC‑like asset.  Provide the test code and discuss any field‑size considerations.
5. SDK publishing and documentation
    Generate a complete README for the @umbra/sdk package.  The README should describe installation, supported functions (makeNote, commitment, nullifier, buildShieldInput, buildWithdrawInput, buildTransferInput, etc.), example code for creating a private payment link and performing a transfer, and notes on security and limitations.  Also generate package.json settings for publishing to npm.  Ensure the README is polished and comprehensible to developers new to ZK.
6. Ali Abdaal‑style demo script
    Write a 2.5‑minute video script for Umbra’s hackathon demo.  Use Ali Abdaal’s script writing strategy (Hook, Intro, Value, End screen).  The hook should promise private, compliant payments on Stellar.  The intro should establish credibility by mentioning that the core cryptography is live on Stellar testnet.  The value section should show shielding USDC, transferring privately, selective disclosure, and multi‑asset support.  The end screen should encourage builders to explore the repo and build with the SDK.  Write the script conversationally, with natural transitions and a call‑to‑action.
7. UX improvements
    You are a front‑end engineer and designer.  Produce a React component (TypeScript) using Tailwind CSS and Three.js to render a dark, cinematic landing page similar to STRK20.  The page should have a hero section saying “Private Money on Stellar,” animated smooth scroll, a 3D pool scene with tokens falling in, and sections for problem → solution → build with us.  Provide the code and instructions on integrating it into a Next.js app.
8. Wallet integration
    Develop connectors for Xverse and Freighter wallets in our Next.js app.  Write TypeScript hooks (useXverseWallet, useFreighterWallet) that handle connecting, signing transactions and retrieving the user’s public key.  Demonstrate how to use these hooks in the shield, transfer and unshield flows.  Provide UI components for a “Connect Wallet” button and error handling.

    6 Conclusion

The goal is to transform Umbra from a strong proof‑of‑concept into a complete privacy layer for Stellar that rivals STRK20 in functionality and polish.  By implementing shielded transfers, multi‑asset support, compliance‑friendly selective disclosure, publishing a usable SDK and refining the user experience, we address real‑world needs and demonstrate leadership in the emerging ZK ecosystem.  With unlimited access to Claude Opus 4.8, we can accelerate the development of circuits, contracts, UI components and documentation.  A compelling demo and narrative inspired by STRK20’s launch will make the project stand out and maximise our chances of winning the Stellar Hacks: Real‑World ZK hackathon.