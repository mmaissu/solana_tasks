import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import fs from "node:fs";

const connection = new Connection(process.env.RPC_URL ?? clusterApiUrl("devnet"), "confirmed");
const owner = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(process.env.KEYPAIR!, "utf8")))
);

(async () => {
  for (const name of ["TOKEN_A", "TOKEN_B"]) {
    const mint = await createMint(connection, owner, owner.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(connection, owner, mint, owner.publicKey);
    await mintTo(connection, owner, mint, ata.address, owner, 1_000_000n * 10n ** 6n);
    console.log(name, "mint:", mint.toBase58(), "account:", ata.address.toBase58());
  }
})();
