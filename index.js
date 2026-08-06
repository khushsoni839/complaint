const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(express.json());

/* ================== MongoDB Connection ================== */
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    isConnected = conn.connections[0].readyState === 1;

    console.log("✅ MongoDB Atlas Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    throw err;
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

/* ================== Schema ================== */
const roundSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["Assigned", "Pending", "Resolved"],
      default: "Assigned",
    },

    additionalStatus: {
      type: String,
      default: "Action Required",
    },

    additionalOptions: {
      type: [String],
      default: [
        "Action Required",
        "Forward",
        "Specialist Assignment",
        "Investigation",
      ],
    },

    from: { type: String, default: "" },
    to: { type: String, default: "" },
    timeIn: { type: String, default: "" },
    timeOut: { type: String, default: "" },
    mode: { type: String, default: "" },

    km: { type: String, default: "" },
    amount: { type: String, default: "" },

    problem: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    serial: { type: String, default: "" },
    otp: { type: String, default: "" },
    dop: { type: String, default: "" },
    invoice: { type: String, default: "" },

    time: {
      type: String,
      default: () => new Date().toLocaleString(),
    },

    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },

    complaintNumber: String,
    assignEngineer: String,
    taskStatus: String,
    additionalStatus: String,
    date: String,
    name: String,
    phone: String,
    state: String,
    product: String,

    selectedModel: {
      model: String,
    },

    rounds: [roundSchema],
  },
  { timestamps: true }
);

const Task =
  mongoose.models.Task || mongoose.model("Task", taskSchema);

/* ================== ROUTES ================== */

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Running Successfully 🚀",
  });
});

// Get All Tasks
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Get Single Task
app.get("/tasks/:taskId", async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Create Task
app.post("/tasks", async (req, res) => {
  try {
    const task = new Task(req.body);
    const saved = await task.save();

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Add Round
app.post("/tasks/:taskId/round", async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.taskId,
      {
        $push: {
          rounds: req.body,
        },
      },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Delete Task
app.delete("/tasks/:taskId", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.taskId);

    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = app;

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const compression = require("compression");

// const app = express();

// /* ================= MIDDLEWARE ================= */
// app.use(cors({ origin: "*" }));
// app.use(express.json());
// app.use(compression());

// /* ================= MONGO CONNECTION (CACHED) ================= */
// let isConnected = false;

// const connectDB = async () => {
//   if (isConnected) return;

//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     isConnected = true;
//     console.log("MongoDB connected");
//   } catch (err) {
//     console.error("MongoDB connection failed", err);
//   }
// };

// /* ================= SCHEMA ================= */
// const taskSchema = new mongoose.Schema({
//   name: String,
//   email: String,
//   phone: String,
//   altPhone: String,
//   state: String,
//   city: String,
//   pincode: String,
//   location: String,
//   landmark: String,
//   product: String,
//   selectedModel: Object,
//   serialNumber: String,
//   warrantyStatus: Object,
//   purchaseDate: String,
//   installationDate: String,
//   status: String,
//   complaintNumber: String,
//   callType: String,
//   additionalStatus: String,
//   callSource: String,
//   taskStatus: String,
//   assignEngineer: String,
//   contactNo: String,
//   dealer: String,
//   complaintNotes: String,
//   enginnerNotes: String,
//   customerFeedback: String,
//   asp: String,
//   aspName: String,
//   actionTaken: String,
//   date: String,
//   images: [String],
// });

// const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

// /* ================= ROUTES ================= */

// // ADD TASK
// app.post("/api/tasks", async (req, res) => {
//   await connectDB();
//   const task = await Task.create(req.body);
//   res.status(201).json(task);
// });

// // GET TASKS (pagination)
// app.get("/api/tasks", async (req, res) => {
//   await connectDB();

//   const page = Number(req.query.page) || 1;
//   const limit = Number(req.query.limit) || 20;
//   const skip = (page - 1) * limit;

//   const totalTasks = await Task.countDocuments();
//   const tasks = await Task.find().skip(skip).limit(limit).lean();

//   res.json({
//     tasks,
//     totalTasks,
//     currentPage: page,
//     totalPages: Math.ceil(totalTasks / limit),
//   });
// });

// // UPDATE TASK
// app.put("/api/tasks/:id", async (req, res) => {
//   await connectDB();

//   const task = await Task.findByIdAndUpdate(
//     req.params.id,
//     req.body,
//     { new: true }
//   );

//   if (!task) return res.status(404).json({ error: "Task not found" });
//   res.json(task);
// });

// // DELETE TASK
// app.delete("/api/tasks/:id", async (req, res) => {
//   await connectDB();

//   const task = await Task.findByIdAndDelete(req.params.id);
//   if (!task) return res.status(404).json({ error: "Task not found" });

//   res.json({ message: "Task deleted" });
// });

// /* ================= EXPORT ================= */
// module.exports = app;
