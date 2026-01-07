
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const NodeCache = require('node-cache');

// Initialize Express app
const app = express();
const cache = new NodeCache({ stdTTL: 36000 }); // Cache for 60 seconds

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(compression()); // Compress all responses

// MongoDB Connection
const dbURI = 'mongodb+srv://oshan:oshan%40work1234@cluster0.2txxi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Schema & Indexing for faster query performance
const taskSchema = new mongoose.Schema({
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
    warranty: Number
  },
  serialNumber: String,
  warrantyStatus: {
    status: String,
    expiryDate: String
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
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);



// ✅ Add new task
app.post('/tasks', async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();

    // Invalidate cache after adding new data
    cache.del('allTasks');

    res.status(201).json(task);
  } catch (err) {
    console.error('Error saving task:', err);
    res.status(500).json({ error: 'Failed to save task.' });
  }
});



// ✅ Get all tasks (with caching + lean for speed)
// Get all tasks with pagination
app.get('/tasks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // current page
    const limit = parseInt(req.query.limit) || 20; // items per page
    const skip = (page - 1) * limit;

    const totalTasks = await Task.countDocuments();
    const tasks = await Task.find().skip(skip).limit(limit).lean();

    res.status(200).json({
      tasks,
      totalTasks,
      currentPage: page,
      totalPages: Math.ceil(totalTasks / limit),
    });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks. Please try again." });
  }
});




// ✅ Update task
app.put('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Invalidate cache after update
    cache.del('allTasks');

    res.status(200).json(task);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});



// ✅ Delete task
app.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Invalidate cache
    cache.del('allTasks');

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});



// Start Server
const port = process.env.PORT || 5002;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

