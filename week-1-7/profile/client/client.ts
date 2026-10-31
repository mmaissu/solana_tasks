import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import type { Profile } from "../target/types/profile";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Profile as anchor.Program<Profile>;


const [profilePda, bump] = web3.PublicKey.findProgramAddressSync(
  [Buffer.from("profile"), program.provider.publicKey.toBuffer()],
  program.programId
);
console.log("Wallet:", program.provider.publicKey.toString());
console.log("Profile PDA:", profilePda.toString(), "bump:", bump);


const existing = await program.provider.connection.getAccountInfo(profilePda);
if (!existing) {
  const tx1 = await program.methods
    .createProfile("Maira", "Student, learning Solana")
    .accounts({
      profile: profilePda,
      user: program.provider.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  console.log("create_profile tx:", tx1);
  await program.provider.connection.confirmTransaction(tx1);
} else {
  console.log("Profile already exists");
}


let profile = await program.account.profile.fetch(profilePda);
console.log("Name:", profile.name);
console.log("Bio:", profile.bio);
console.log("Authority:", profile.authority.toString());


const tx2 = await program.methods
  .updateProfile("Maira S.", "Blockchain developer in progress")
  .accounts({
    profile: profilePda,
    authority: program.provider.publicKey,
  })
  .rpc();
console.log("update_profile tx:", tx2);
await program.provider.connection.confirmTransaction(tx2);


profile = await program.account.profile.fetch(profilePda);
console.log("Updated name:", profile.name);
console.log("Updated bio:", profile.bio);