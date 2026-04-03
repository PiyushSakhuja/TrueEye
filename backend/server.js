const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// DB connect
mongoose.connect("mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
  .then(() => console.log("DB connected"))
  .catch(err => console.log(err));

// Routes
const routes = require("./routes");
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("TrustEye running");
});

app.listen(3000, () => console.log("Server running on 3000"));