require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
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
  });
};

async function run() {
  try {
    await client.connect();
    const db = client.db("NewDB");
    const ArticleCollection = db.collection("article");
    const userCollection = db.collection("users");
    const publisherCollection = db.collection("publisher");

    // users section
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (user) {
        return res.send({
          role: user.role,
          userType: user.userType,
        });
      } else {
        return res.status(404).send({ message: "User not found" });
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
        const result = await ArticleCollection.find({
          status: "pending", //after create admin role -- status "accepted"
        }).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
    });

    // app.get("/article", async (req, res) => {
    //   try {
    //     const articles = await ArticleCollection.aggregate([
    //       {
    //         $sort: { createdAt: -1 }, // latest first
    //       },
    //       {
    //         $group: {
    //           _id: "$category",
    //           latestArticle: { $first: "$$ROOT" },
    //         },
    //       },
    //       {
    //         $replaceRoot: { newRoot: "$latestArticle" },
    //       },
    //       {
    //         $limit: 6,
    //       },
    //     ]);

    //     res.status(200).json(articles);
    //   } catch (err) {
    //     res.status(500).json({ message: "Error fetching articles" });
    //   }
    // });

    app.get("/article/my-article", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await ArticleCollection.find({
        authorEmail: email,
      }).toArray();
      res.send(result);
    });

    app.post("/article", verifyJWT, async (req, res) => {
      const articleData = req.body;
      if (!articleData.status) {
        articleData.status = "pending";
      }
      const result = await ArticleCollection.insertOne(articleData);
      res.send(result);
    });

    // publisher
    app.post("/publishers", async (req, res) => {
      try {
        const { name, image } = req.body;

        if (!name || !image) {
          return res
            .status(400)
            .send({ message: "Name and image are required" });
        }

        const newPublisher = {
          name,
          image,
          createdAt: new Date(),
        };

        const result = await publisherCollection.insertOne(newPublisher);
       res.send(result)
      } catch (err) {
        console.error("Error adding publisher:", err);
        res.status(500).send({ message: "Failed to add publisher" });
      }
    });
    app.get("/publishers", async (req, res) => {
      try {
        const publisherInfo = await publisherCollection.find().toArray();
        res.status(200).send({
          success: true,
          data: publisherInfo,
        });
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch publishers" });
      }
    });
    // jwt section
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // payment section
    app.post("/payment/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
    // update user premium
    app.patch("/users/subscribe/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.updateOne(
        { email },
        { $set: { role: "premium" } }
      );
      res.send(result);
    });

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
