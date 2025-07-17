require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require('stripe');
const { MongoClient, ServerApiVersion } = require("mongodb");


const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
     return res.status(401).send({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.user = decoded;
    next();
  })
}

async function run() {
  try {
    await client.connect();
    const db = client.db("NewDB");
    const ArticleCollection = db.collection("article");
    const userCollection = db.collection("users");

// user section 
     app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
     });
    
    
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        await userCollection.updateOne(
          { email },
          {
            $set: {
              lastLogin: new Date().toISOString(),
            },
          }
        );
        return res.status(200).json({
          message: "User already exists",
          user: { ...userExists, lastLogin: new Date() },
          inserted: false,
        });
      }
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });


    // article section
    app.get("/article", async (req, res) => {
      try {
        const result = await ArticleCollection.find(
          {
            status: "pending"  //after create admin role -- status "accepted"
          }
        ).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
    });

    app.get("/article/my-article",verifyJWT, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
         return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await ArticleCollection.find(
        {
          authorEmail: email
        }
      ).toArray();
      res.send(result)
    })

  
    app.post("/article",verifyJWT, async (req, res) => {
      const articleData = req.body;
      const result = await ArticleCollection.insertOne(articleData);
      res.send(result);
    });

    // jwt section

    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      })
      res.send({token})
    })
    
    // payment section 
    app.post("/payment/create-payment-intent",async (req, res) => {
      const { price } = res.body;
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: price * 100,
          currency: "usd",
          payment_method_types: ["card"]
        }
      )
      res.send({clientSecret: paymentIntent.client_secret})
    })



   

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("the daily bulletin server is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
