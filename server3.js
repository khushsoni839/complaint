const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const NodeCache = require("node-cache");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(compression());

// ========================================
// 🧠 Cache
// ========================================
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
});

// ========================================
// 🔗 MongoDB Connection
// ========================================
// const mongoose = require("mongoose");

const MONGODB_URI =
  "mongodb+srv://oshan:oshan%40work1234@cluster0.2txxi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGODB_URI, {
    maxPoolSize: 10,
  })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// ========================================
// 📦 Task Schema
// ========================================
const taskSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      index: true,
    },

    name: String,
    email: String,
    phone: String,
    altPhone: String,

    state: String,
    city: String,
    pincode: String,

    location: String,
    landmark: String,

    product: String,

    selectedModel: {
      model: String,
      capacity: String,
      warranty: Number,
    },

    serialNumber: String,

    warrantyStatus: {
      status: String,
      expiryDate: String,
    },

    purchaseDate: String,
    installationDate: String,

    callType: String,
    condition: String,
    callSource: String,

    taskStatus: String,

    assignEngineer: String,
    contactNo: String,

    dealer: String,

    date: String,

    asp: String,
    aspName: String,

    actionTaken: String,
    customerFeedback: String,
    enginnerNotes: String,

    images: [String],

    status: String,

    complaintNotes: String,
    additionalStatus: String,

    generatedOtps: String,
  },
  {
    timestamps: true,
  }
);

// ========================================
// ⚡ Indexes
// ========================================

taskSchema.index({ complaintNumber: 1 });
taskSchema.index({ serialNumber: 1 });
taskSchema.index({ phone: 1 });
taskSchema.index({ assignEngineer: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ taskStatus: 1 });
taskSchema.index({ city: 1 });
taskSchema.index({ date: 1 });
taskSchema.index({ createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

// ========================================
// ➕ ADD TASK
// ========================================
app.post("/tasks", async (req, res) => {
  try {
    const data = req.body;

    let result;

    if (Array.isArray(data)) {
      result = await Task.insertMany(data, {
        ordered: false,
      });
    } else {
      const task = new Task(data);
      result = await task.save();
    }

    // Clear task cache
    cache.flushAll();

    res.status(201).json(result);
  } catch (err) {
    console.error("❌ Error saving task:", err);

    res.status(500).json({
      error: "Failed to save task.",
    });
  }
});

// ========================================
// 📋 GET TASKS
// ========================================
app.get("/tasks", async (req, res) => {
  try {
    const {
      complaintNumber,
      username,
      engineer,
      status,
      month,
    } = req.query;

    // ========================================
    // 🧠 Cache Key
    // ========================================

    const cacheKey = `tasks_${complaintNumber || "all"}_${
      username || "all"
    }_${engineer || "all"}_${status || "all"}_${month || "all"}`;

    // ========================================
    // ⚡ Cache Check
    // ========================================

    if (cache.has(cacheKey)) {
      console.log("⚡ Cache Hit");

      return res.json(cache.get(cacheKey));
    }

    console.log("🐢 Cache Miss - Fetching from DB");

    // ========================================
    // 🔎 Build Query
    // ========================================

    const query = {};

    if (complaintNumber) {
      query.complaintNumber = complaintNumber;
    }

    if (username) {
      query.name = {
        $regex: username,
        $options: "i",
      };
    }

    if (engineer) {
      query.assignEngineer = engineer;
    }

    if (status) {
      query.status = status;
    }

    // ========================================
    // 📅 Month Filter
    // ========================================

    if (month) {
      const start = new Date(`${month}-01T00:00:00Z`);

      const end = new Date(start);

      end.setUTCMonth(end.getUTCMonth() + 1);

      query.createdAt = {
        $gte: start,
        $lt: end,
      };
    }

    // ========================================
    // ⚡ FETCH
    // ========================================

    const data = await Task.find(query)
      .select(
        `
        complaintNumber
        name
        phone
        state
        city
        pincode
        location
        landmark
        product
        selectedModel
        serialNumber
        warrantyStatus
        purchaseDate
        installationDate
        callType
        condition
        callSource
        taskStatus
        assignEngineer
        contactNo
        dealer
        date
        asp
        aspName
        status
        additionalStatus
        createdAt
        updatedAt
        `
      )
      .sort({
        createdAt: -1,
      })
      .lean();

    // ========================================
    // 🧠 Save in Cache
    // ========================================

    cache.set(cacheKey, data);

    console.log(`✅ Returned ${data.length} tasks`);

    res.json(data);
  } catch (err) {
    console.error("❌ Fetch error:", err);

    res.status(500).json({
      error: "Failed to fetch tasks.",
    });
  }
});

// ========================================
// 🔍 GET SINGLE TASK
// ========================================
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json(task);
  } catch (err) {
    console.error("❌ Fetch task error:", err);

    res.status(500).json({
      error: "Failed to fetch task",
    });
  }
});

// ========================================
// ✏️ UPDATE TASK
// ========================================
app.put("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    // Clear cache
    cache.flushAll();

    res.json(task);
  } catch (err) {
    console.error("❌ Update error:", err);

    res.status(500).json({
      error: "Failed to update task.",
    });
  }
});

// ========================================
// 🗑️ DELETE TASK
// ========================================
app.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    // Clear cache
    cache.flushAll();

    res.json({
      message: "Deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete error:", err);

    res.status(500).json({
      error: "Failed to delete task.",
    });
  }
});

// ========================================
// 🌍 START SERVER
// ========================================
const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
