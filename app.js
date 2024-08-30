import { Connection,Keypair,PublicKey,SystemProgram,Transaction,clusterApiUrl,LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createPostResponse, actionCorsMiddleware } from "@solana/actions";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getExplorerLink,getKeypairFromEnvironment } from "@solana-developers/helpers";
import express from "express";
import "dotenv/config";
import { TokenBurnFailedError } from "@metaplex-foundation/mpl-token-metadata";
import { isConstructorDeclaration } from "typescript";


//setting up express environment 
const app = express();
app.use(express.json());
app.use(actionCorsMiddleware());
const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

//setting up solana connection
const DEFAULT_SOL_ADDRESS = new PublicKey("EhAe53YAbJMXCA2PVHVmhMrtihBnZof2UVoKDt1bUJdD");
const DEFAULT_SOL_AMOUNT = 1;
const connection = new Connection(clusterApiUrl("devnet"));

//setting up routes
app.get("/actions.json", getActionsJson);
app.get("/api/actions/transfer-sol", getTransferSol);
app.post("/api/actions/transfer-sol", postTransferSol);

//route handlers
function getActionsJson(req, res) {
    const payload = {
      rules: [
        { pathPattern: "/*", apiPath: "/api/actions/*" },
        { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
      ],
    };
    res.json(payload);
  }
  
  async function getTransferSol(req, res) {
    try {
      const { toPubkey } = validatedQueryParams(req.query);
      const baseHref = `${BASE_URL}/api/actions/transfer-sol?to=${toPubkey.toBase58()}`;
  
      const payload = {
        type: "action",
        title: "Do you want to buy some TIGAS?",
        icon: "https://crimson-legislative-pigeon-962.mypinata.cloud/ipfs/QmdHLynShvCjVitoPxxG7ob8YxbbVuSAgQ3bAscj4XnfHb",
        description: "Create Account for your wallet for your TIGA (or TIGAS) and buy one doggy for yourself! 1 TIGA IS EQUAL TO 1 SOL!",
        links: {
          actions: [
            { label: "Buy 1 TIGA", href: `${baseHref}&amount=1` },
            { label: "Buy 5 TIGAS", href: `${baseHref}&amount=5` },
            { label: "BUY 10 TIGAS", href: `${baseHref}&amount=10` },
            {
              label: "buy TIGAS",
              href: `${baseHref}&amount={amount}`,
              parameters: [
                {
                  name: "amount",
                  label: "Enter the amount of TIGAS to buy",
                  required: true,
                },
              ],
            },
          ],
        },
      };
  
      res.json(payload);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err?.message || err });
    }
  }
  
  async function postTransferSol(req, res) {
    const { amount, toPubkey } = validatedQueryParams(req.query);
    const { account } = req.body;
    const fromPubkey = new PublicKey(account);

    try {
      //const { amount, toPubkey } = validatedQueryParams(req.query);
      //const { account } = req.body;
  
      if (!account) {
        throw new Error('Invalid "account" provided');
      }
  
      //const fromPubkey = new PublicKey(account);
      const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        0,
      );
  
      if (amount * LAMPORTS_PER_SOL < minimumBalance) {
        throw new Error(`Account may not be rent exempt: ${toPubkey.toBase58()}`);
      }


      if (amount < 0.01){
        throw new Error("Number cannot be smaller than 0.01!");
      }

      //amount = amountRework(amount);
      if( Math.floor(amount * 100) / 100 !== amount){
        throw new Error("Bad data format");
      }
    
      // create an instruction to transfer native SOL from one wallet to another
      const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: fromPubkey,
        toPubkey: toPubkey,
        lamports: amount * LAMPORTS_PER_SOL,
      });

  
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

  
      // create a transaction
      const transaction = new Transaction({
        feePayer: fromPubkey,
        blockhash,
        lastValidBlockHeight,
      }).add(transferSolInstruction);

      const payload = await createPostResponse({
        fields: {
          transaction,
          message: `${amount} SOL was send to ${toPubkey.toBase58()} in exchange for ${amount} of TIGAS!`,
        },
      });

      mintTigaTokens(amount,fromPubkey)

      res.json(payload);
    } catch (err) {
      res.status(400).json({ error: err.message || "An unknown error occurred" });
    }
  }
  
  function validatedQueryParams(query) {
    let toPubkey = DEFAULT_SOL_ADDRESS;
    let amount = DEFAULT_SOL_AMOUNT;
  
    if (query.to) {
      try {
        toPubkey = new PublicKey(query.to);
      } catch (err) {
        throw new Error("Invalid input query parameter: to");
      }
    }
  
    try {
      if (query.amount) {
        amount = parseFloat(query.amount);
      }
      if (amount <= 0) throw new Error("amount is too small");
    } catch (err) {
      throw new Error("Invalid input query parameter: amount");
    }
  
    return { amount, toPubkey };
  }

  async function mintTigaTokens(amount,fromPubkey){
    try{
    //for TIGAS (the smallest unit is 0.01 TIGA)
    const user = getKeypairFromEnvironment("SECRET_KEY");
    const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10,2);
    const tokenMintAccount = new PublicKey(
        "3NFm3ZyqBPtyuUpoKuoTWb43Ms9g8JvwN5QtMoA5kFuA"
    );
    
    const recipentAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        tokenMintAccount,
        fromPubkey
    )
    
    const transactionSignature = await mintTo(
        connection,
        user,
        tokenMintAccount,
        recipentAssociatedTokenAccount.address,
        user,
        amount*100
    );

    const link = getExplorerLink("transaction", transactionSignature, "devnet");

    console.log(`Token został wymintowany na konto link: ${link}`);

    }
    catch(err){
        console.log(err);
        throw new Error("Minting process failed!");
    }
}

  // Start server
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });