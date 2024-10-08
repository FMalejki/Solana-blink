import { Connection,Keypair,PublicKey,SystemProgram,Transaction,clusterApiUrl,LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createPostResponse, actionCorsMiddleware } from "@solana/actions";
import express from "express";


//setting up express environment 
const app = express();
app.use(express.json());
app.use(actionCorsMiddleware());
const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

//setting up solana connection
const DEFAULT_SOL_ADDRESS = Keypair.generate().publicKey;
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
        description: "Create Account for your wallet for your TIGA (or TIGAS) and buy one doggy for yourself!",
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
    try {
      const { amount, toPubkey } = validatedQueryParams(req.query);
      //const toPubkey = "EhAe53YAbJMXCA2PVHVmhMrtihBnZof2UVoKDt1bUJdD"
      const { account } = req.body;
  
      if (!account) {
        throw new Error('Invalid "account" provided');
      }
  
      const fromPubkey = new PublicKey(account);
      const minimumBalance = await connection.getMinimumBalanceForRentExemption(
        0,
      );
  
      if (amount * LAMPORTS_PER_SOL < minimumBalance) {
        throw new Error(`Account may not be rent exempt: ${toPubkey.toBase58()}`);
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
          message: `Send ${amount} SOL to ${toPubkey.toBase58()}`,
        },
      });
  
      res.json(payload);
    } catch (err) {
      res.status(400).json({ error: err.message || "An unknown error occurred" });
    }
  }
  
  function validatedQueryParams(query) {
    let toPubkey = new PublicKey("EhAe53YAbJMXCA2PVHVmhMrtihBnZof2UVoKDt1bUJdD");
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
  
  // Start server
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });