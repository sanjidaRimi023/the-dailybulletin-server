require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
app.use(cors());

// app.use(cors({
//   origin: ["http://localhost:5173"],
//   credentials: true,
// }));

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
    const articleCollection = db.collection("article");
    const userCollection = db.collection("users");
    const publisherCollection = db.collection("publisher");
    const paymentCollection = db.collection("payments");

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

    //  verify admin section
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
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
    // get user role by email
    app.get("/user/role", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const user = await userCollection.findOne({ email });
      res.send({
        email: user.email,
        role: user.role,
      });
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (user) {
        return res.send(user);
      } else {
        return res.status(404).send({ message: "User not found" });
      }
    });

    app.get("/article/user-stats/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.user.email;

      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      try {
        const total = await articleCollection.countDocuments({
          authorEmail: email,
        });
        const approved = await articleCollection.countDocuments({
          authorEmail: email,
          status: "approved",
        });
        const pending = await articleCollection.countDocuments({
          authorEmail: email,
          status: "pending",
        });
        const rejected = await articleCollection.countDocuments({
          authorEmail: email,
          status: "rejected",
        });

        const totalViewsData = await articleCollection.aggregate([
          { $match: { authorEmail: email } },
          { $group: { _id: null, views: { $sum: "$views" } } },
        ]);

        const totalViews = totalViewsData[0]?.views || 0;

        res.send({ total, approved, pending, rejected, totalViews });
      } catch (err) {
        console.error("Error fetching user stats:", err);
        res.status(500).send({ error: "Failed to fetch stats" });
      }
    });

    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        await userCollection.updateOne(
          { email },
          { $set: { lastLogin: new Date() } }
        );
        return res.status(200).json({
          message: "User already exists",
          user: { ...userExists, lastLogin: new Date() },
          inserted: false,
        });
      }
      const newUser = { ...req.body, createdAt: new Date() };
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.delete("/users/:id", verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    app.patch("/users/subscribe", verifyJWT, async (req, res) => {
      try {
        const userEmail = req.user.email;
        const { durationMinutes, planName, price, transactionId } = req.body;

        console.log("Attempting to subscribe user with email:", userEmail);

        if (!userEmail || !durationMinutes) {
          return res
            .status(400)
            .json({ message: "User email and duration are required." });
        }

        const premiumExpiresAt = new Date(
          Date.now() + durationMinutes * 60 * 1000
        );

        const filter = { email: userEmail };
        const updateDoc = {
          $set: {
            isPremium: true,
            premiumTakenAt: new Date(),
            premiumExpiresAt: premiumExpiresAt,
            currentPlan: planName,
          },
        };

        const result = await userCollection.updateOne(filter, updateDoc);

        console.log("MongoDB update result:", result);

        if (result.modifiedCount === 0) {
          console.error(
            `User with email '${userEmail}' not found in database or no update was needed.`
          );
          return res
            .status(404)
            .json({ message: "User not found or could not be updated." });
        }

        const paymentRecord = {
          email: userEmail,
          price,
          transactionId,
          planName,
          paymentDate: new Date(),
        };
        await paymentCollection.insertOne(paymentRecord);

        res.status(200).json({
          success: true,
          message: "Subscription updated successfully!",
        });
      } catch (error) {
        console.error("Subscription update server error:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    });
    app.patch("/users/:id", async (req, res) => {
      try {
        const userEmail = req.params.id;
        const { displayName, bio, photoURL } = req.body;
        const updateDoc = {
          ...(displayName && { displayName }),
          ...(bio && { bio }),
          ...(photoURL && { photoURL }),
          last_login: new Date().toISOString(),
        };

        const result = await userCollection.findOneAndUpdate(
          { email: userEmail },
          { $set: updateDoc },
          { returnDocument: "after" }
        );

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: "User not found" });
        }

        res.send({
          success: true,
          message: "Profile updated successfully",
          updatedUser: result,
        });
      } catch (err) {
        console.error("Profile update failed:", err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // article section
    app.get("/article", async (req, res) => {
      try {
        const result = await articleCollection
          .find({
            status: "pending",
          })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res.status(500).send({ error: "Failed to fetch publishers" });
      }
    });
    app.get("/article/approved", async (req, res) => {
      try {
        const result = await articleCollection
          .find({ status: "approved" })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching approved articles:", err);
        res.status(500).send({ error: "Failed to fetch approved articles" });
      }
    });

    app.get("/article/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await articleCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Article not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching article:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });


    app.get("/article/my-article", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.user.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await articleCollection
        .find({
          authorEmail: email,
        })
        .toArray();
      res.send(result);
    });

    app.post("/article", async (req, res) => {
      const articleData = req.body;
      if (!articleData.status) {
        articleData.status = "pending";
      }
      const result = await articleCollection.insertOne(articleData);
      res.send(result);
    });

    app.patch("/article/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status, rejectionReasion } = req.body;
      try {
        const updateDoc = { status };
        if (status === "rejected" && rejectionReasion) {
          updateDoc.rejectionReasion = rejectionReasion;
        }

        const result = await articleCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: updateDoc,
          }
        );
        res.send(result);
      } catch {
        res.status(500).send({ error: "Failed to update article status" });
      }
    });

    app.put("/article/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      const result = await articleCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      res.send(result);
    });

    app.delete("/article/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await articleCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // publisher
    app.post("/publishers", verifyAdmin, async (req, res) => {
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
        res.send(result);
      } catch (err) {
        console.error("Error adding publisher:", err);
        res.status(500).send({ message: "Failed to add publisher" });
      }
    });
    app.get("/publishers", async (req, res) => {
      try {
        const publisherInfo = await publisherCollection.find().toArray();
        res.send(publisherInfo);
      } catch (err) {
        console.error("Error fetching publishers:", err);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch publishers" });
      }
    });

    app.delete("/publishers/:id", verifyAdmin, verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await publisherCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.put("/publishers/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await publisherCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );
      res.send(result);
    });

    // payment section
    app.post("/payment/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      if (!price || price <= 0) {
        return res.status(400).send({ error: "Invalid price" });
      }
      const amountInCents = Math.round(price * 100);

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
    // update user premium

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
