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
const MONGODB_URI =
  "mongodb+srv://oshan:oshan%40work1234@cluster0.2txxi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGODB_URI, { maxPoolSize: 10 })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ========================================
// 📦 Task Schema
// ========================================
const taskSchema = new mongoose.Schema(
  {
    complaintNumber: { type: String, index: true },
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
    actionTaken: String,        // ✅ final close date
    customerFeedback: String,
    enginnerNotes: String,
    images: [String],
    status: String,
    complaintNotes: String,
    additionalStatus: String,
    generatedOtps: String,
  },
  { timestamps: true }
);

// Indexes
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
      result = await Task.insertMany(data, { ordered: false });
    } else {
      const task = new Task(data);
      result = await task.save();
    }

    cache.flushAll();
    res.status(201).json(result);
  } catch (err) {
    console.error("❌ Error saving task:", err);
    res.status(500).json({ error: "Failed to save task." });
  }
});

// ========================================
// 📋 GET TASKS (with Month filter + Pagination)
// ========================================
app.get("/tasks", async (req, res) => {
  try {
    const {
      complaintNumber,
      username,
      engineer,
      status,
      month,   // format: "YYYY-MM"
      state,
      product,
      callType,
      callSource,
      taskStatus,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 500);

    // Cache key
    const cacheKey = `tasks_${JSON.stringify(req.query)}`;

    if (cache.has(cacheKey)) {
      console.log("⚡ Cache Hit");
      return res.json(cache.get(cacheKey));
    }

    console.log("🐢 Cache Miss - Fetching from DB");

    // ========================================
    // 🔎 Build Query
    // ========================================
    const query = {};

    if (complaintNumber) query.complaintNumber = complaintNumber;
    if (username) query.name = { $regex: username, $options: "i" };
    if (engineer) query.assignEngineer = engineer;
    if (status) query.status = status;
    if (state) query.state = state;
    if (product) query.product = product;
    if (callType) query.callType = callType;
    if (callSource) query.callSource = callSource;

    // Support Assigned/Pending combined filter
    if (taskStatus) {
      if (taskStatus === "Assigned/Pending") {
        query.taskStatus = { $in: ["Assigned", "Pending"] };
      } else {
        query.taskStatus = taskStatus;
      }
    }

    // ========================================
    // 📅 Month Filter — matches `date` field (string "YYYY-MM-DD")
    //     falls back to createdAt
    // ========================================
    if (month) {
      // month is "YYYY-MM"
      const [yearStr, monthStr] = month.split("-");
      const start = new Date(Date.UTC(+yearStr, +monthStr - 1, 1));
      const end = new Date(Date.UTC(+yearStr, +monthStr, 1));

      // Tasks whose `date` string starts with "YYYY-MM"
      // date is stored as string; use regex for string field
      const monthRegex = new RegExp(`^${month}-`);

      query.$or = [
        { date: { $regex: monthRegex } },
        {
          $and: [
            { $or: [{ date: { $exists: false } }, { date: "" }, { date: null }] },
            { createdAt: { $gte: start, $lt: end } },
          ],
        },
      ];
    }

    // ========================================
    // ⚡ FETCH with pagination
    // ========================================
    const total = await Task.countDocuments(query);

    const data = await Task.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const payload = {
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };

    cache.set(cacheKey, payload);

    console.log(`✅ Returned ${data.length} of ${total} tasks (page ${pageNum})`);
    res.json(payload);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch tasks." });
  }
});

// ========================================
// 🔍 GET SINGLE TASK
// ========================================
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    console.error("❌ Fetch task error:", err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// ========================================
// ✏️ UPDATE TASK
// ========================================
app.put("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!task) return res.status(404).json({ error: "Task not found" });

    cache.flushAll();
    res.json(task);
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ error: "Failed to update task." });
  }
});

// ========================================
// 🗑️ DELETE TASK
// ========================================
app.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    cache.flushAll();
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: "Failed to delete task." });
  }
});

// ========================================
// 🌍 START SERVER
// ========================================
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
