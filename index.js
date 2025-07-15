require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("NewDB");
    const ArticleCollection = db.collection("article");
    const userCollection = db.collection("users");

    app.get("/article", async (req, res) => {
      try {
        const result = await ArticleCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
    });

    app.post("/article", async (req, res) => {
        const articleData = req.body;
        const result = await ArticleCollection.insertOne(articleData)
      res.send(result);
    
    })

    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        return res.status(200).json(
          {
            message: "User already exists",
            user: existingUser,
            inserted: false,
          }
        )
      }
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser)
      res.send(result);
    })
    app.get("/users", async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
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
