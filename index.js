const express = require("express");
const app = express();
const cors = require("cors");

require("dotenv").config();

const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1maxaaz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const classesCollection = client.db("sportscampDB").collection("classes");
    const bookedClassCollection = client
      .db("sportscampDB")
      .collection("booked-classes");
    const usersCollection = client.db("sportscampDB").collection("users");
    const paymentCollection = client.db("sportscampDB").collection("payments");

    // jwt apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });

      res.send({ token });
    });

    // vereify admin function

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // verify Instructor function

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/all-classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/popular-classes", async (req, res) => {
      const result = await classesCollection
        .find({ status: "approved" })
        .sort({ student: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/pending-classes", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/my-classes", async (req, res) => {
      const query = { email: req.query.email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/all-classes", verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem);
      res.send(result);
    });

    app.patch("/all-classes/approved/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/all-classes/deny/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // users related apis
    app.get(
      "/users",
      verifyJWT,
      verifyAdmin,

      async (req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await usersCollection.insertOne(user);
      return res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      return res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      return res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // cart Collection apis

    app.get("/booked-classes", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }
      const query = { email: email };
      const result = await bookedClassCollection.find(query).toArray();
      return res.send(result);
    });
    app.get("/booked-classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedClassCollection.findOne(query);
      res.send(result);
    });

    app.delete("/booked-classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookedClassCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/booked-classes", async (req, res) => {
      const item = req.body;


      const existingCart = await bookedClassCollection.findOne({
        selectClassId: item.selectClassId,
        email: item.email
      })

      if (existingCart) {
        return res.send({ message: "already select that class" });
      }

      const result = await bookedClassCollection.insertOne(item);
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;


      const id = payment.id;


      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: new ObjectId(id),
      };
      const deleteResult = await bookedClassCollection.deleteOne(query);

      return res.send({ insertResult, deleteResult });
    });

    app.patch("/all-classes/seats/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateClass = await classesCollection.findOne(filter);
      if (!updateClass) {
        // Handle case when the seat is not found
        console.log("Seat not found");
        return;
      }
      const updateEnrollStudent = updateClass.student + 1;
      const updatedAvailableSeats = updateClass.seats - 1;
      const update = {
        $set: {
          seats: updatedAvailableSeats,
          student: updateEnrollStudent,
        },
      };
      const result = await classesCollection.updateOne(filter, update);
      res.send(result);
    });
    app.patch("/update-classes/:id", async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      console.log(body);
      const price = parseFloat(body.price);
      const seats = parseFloat(body.seats);
      const update = {
        $set: {
          seats: seats,
          price: price,
        },
      };

      const result = await classesCollection.updateOne(filter, update);
      res.send(result);
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.get("/enroll-classes", async (req, res) => {
      const email = req.query.email;

      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();

      const allClass = await classesCollection.find().toArray();
      const id = result.map((item) => item.selectClassId);

      const enrollClass = id.map((i) => allClass.find((item) => item._id == i));

      return res.send({ enrollClass, result });
    });

    app.patch("/update-feedback/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      console.log(body);

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: body.feedback,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // dashboard home
    app.get("/admin-stats", async (req, res) => {
      const studentquery = { role: "student" };
      const instructorquery = { role: "instructor" };
      const student = await usersCollection.countDocuments(studentquery);

      const instructor = await usersCollection.countDocuments(instructorquery);
      const classes = await classesCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);

      res.send({
        revenue,
        student,
        instructor,
        classes,
        orders,
      });
    });

    app.get("/instructor-stat", async (req, res) => {
      const email = req.query.email;
      const emailQuery = { email: email, status: "approved" };
      const instructorQuery = { instructorEmail: email };
      const classes = await classesCollection.countDocuments(emailQuery);
      const students = await paymentCollection.countDocuments(instructorQuery);
      const payments = await paymentCollection.find(instructorQuery).toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);

      const student = await classesCollection.find(emailQuery).toArray();
      const totalStudent = student.reduce((sum, student) => sum + student.student, 0);




      res.send({
        classes,
        students,
        revenue,
        totalStudent,
        payments,
      });
    });

    app.get("/student-stat", async (req, res) => {
      const email = req.query.email;
      const emailQuery = { email: email };

      const bookedClasses = await bookedClassCollection.countDocuments(
        emailQuery
      );
      const enrollClasses = await paymentCollection.countDocuments(emailQuery);
      const payments = await paymentCollection.find(emailQuery).toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);

      res.send({
        bookedClasses,
        enrollClasses,

        revenue,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Sports server running");
});

app.listen(port, () => {
  console.log(`Server is running port ${port}`);
});
