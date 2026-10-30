import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { Counter } from "../target/types/counter";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Counter as anchor.Program<Counter>;

const counter = web3.Keypair.generate();
console.log("Counter account:", counter.publicKey.toString());


const tx1 = await program.methods
  .initialize()
  .accounts({
    counter: counter.publicKey,
    user: program.provider.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .signers([counter])
  .rpc();
console.log("initialize tx:", tx1);
await program.provider.connection.confirmTransaction(tx1);


const tx2 = await program.methods
  .increment()
  .accounts({ counter: counter.publicKey })
  .rpc();
console.log("increment tx:", tx2);
await program.provider.connection.confirmTransaction(tx2);


const data = await program.account.counter.fetch(counter.publicKey);
console.log("Count:", data.count.toString());