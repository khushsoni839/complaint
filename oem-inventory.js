const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- MongoDB Connection ----------
const MONGO_URI =
  process.env.MONGO_URI ||
  // 'mongodb+srv://oshan:oshan%40work1234@cluster0.2txxi.mongodb.net/oemInventory?retryWrites=true&w=majority&appName=Cluster0';
  'mongodb+srv://jayantsoni4382:js%40workdb@cluster0.jjjc03f.mongodb.net/attendanceDB?retryWrites=true&w=majority';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err.message));

// ==========================================================
//                       SCHEMAS
// ==========================================================

// Inward - Item sub-schema
const itemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    receiveQty: { type: Number, required: true, default: 0 },
    dispatchQty: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

// Inward - Main schema
const inwardSchema = new mongoose.Schema(
  {
    challanNumber: { type: String, required: true, unique: true },
    partyName: { type: String, required: true },
    location: { type: String, required: true },
    docket: { type: String, required: true },
    courierName: { type: String, required: true },
    remarks: { type: String, default: '' },
    items: { type: [itemSchema], required: true },
  },
  { timestamps: true }
);

// Outward - Item sub-schema
const outwardItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    receiveQty: { type: Number, default: 0 },
    dispatchQty: { type: Number, default: 0 },
  },
  { _id: false }
);

// Outward - Main schema (challanNumber is NOT unique — multiple dispatches per challan allowed)
const outwardSchema = new mongoose.Schema(
  {
    outwardChallanNumber: { type: String, required: true, unique: true },
    challanNumber: { type: String, required: true },
    partyName: { type: String, required: true },
    location: { type: String, required: true },
    dispatchQty: { type: Number, required: true, default: 0 },
    receiveQty: { type: Number, default: 0 },
    docketNo: { type: String, required: true },
    courier: { type: String, required: true },
    remarks: { type: String, default: '' },
    items: { type: [outwardItemSchema], default: [] },
  },
  { timestamps: true }
);

const Inward = mongoose.model('Inward', inwardSchema);
const Outward = mongoose.model('Outward', outwardSchema);

// ==========================================================
//                    HELPER FUNCTIONS
// ==========================================================

// Generate next inward challan number like OEM-001, OEM-002 ...
const generateChallanNumber = async () => {
  const last = await Inward.findOne().sort({ createdAt: -1 });
  if (!last) return 'OEM-001';
  const match = last.challanNumber.match(/OEM-(\d+)/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `OEM-${String(num).padStart(3, '0')}`;
};

// Generate next outward challan number like OUT-001, OUT-002 ...
const generateOutwardChallanNumber = async () => {
  const last = await Outward.findOne().sort({ createdAt: -1 });
  if (!last || !last.outwardChallanNumber) return 'OUT-001';
  const match = last.outwardChallanNumber.match(/OUT-(\d+)/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `OUT-${String(num).padStart(3, '0')}`;
};

// ==========================================================
//                    ROUTES: INWARD
// ==========================================================

// GET all inward records
app.get('/api/inward', async (req, res) => {
  try {
    const records = await Inward.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single inward by challan number
app.get('/api/inward/challan/:challanNumber', async (req, res) => {
  try {
    const record = await Inward.findOne({ challanNumber: req.params.challanNumber });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE inward
app.post('/api/inward', async (req, res) => {
  try {
    const challanNumber = await generateChallanNumber();

    // Force dispatchQty to 0 on creation
    const safeItems = (req.body.items || []).map((it) => ({
      itemName: it.itemName,
      receiveQty: Number(it.receiveQty) || 0,
      dispatchQty: 0,
    }));

    const record = new Inward({
      ...req.body,
      items: safeItems,
      challanNumber,
    });
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE inward — preserves dispatchQty
app.put('/api/inward/:id', async (req, res) => {
  try {
    const existing = await Inward.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Inward not found' });

    const updatedItems = (req.body.items || []).map((newItem) => {
      const existingItem = existing.items.find(
        (it) => it.itemName === newItem.itemName
      );
      return {
        itemName: newItem.itemName,
        receiveQty: Number(newItem.receiveQty) || 0,
        dispatchQty: existingItem ? existingItem.dispatchQty : 0,
      };
    });

    const updated = await Inward.findByIdAndUpdate(
      req.params.id,
      {
        partyName: req.body.partyName,
        location: req.body.location,
        docket: req.body.docket,
        courierName: req.body.courierName,
        remarks: req.body.remarks,
        items: updatedItems,
      },
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE inward
app.delete('/api/inward/:id', async (req, res) => {
  try {
    await Inward.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
//                    ROUTES: OUTWARD
// ==========================================================

// GET all outward records
app.get('/api/outward', async (req, res) => {
  try {
    const records = await Outward.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET outward records by inward challan number (all dispatches for a challan)
app.get('/api/outward/challan/:challanNumber', async (req, res) => {
  try {
    const records = await Outward.find({
      challanNumber: req.params.challanNumber,
    }).sort({ createdAt: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE outward — always creates a NEW entry (partial dispatch allowed)
app.post('/api/outward', async (req, res) => {
  try {
    // 1. Validate challan exists in inward
    const inward = await Inward.findOne({ challanNumber: req.body.challanNumber });
    if (!inward) {
      return res.status(400).json({ error: 'Challan number not found in inward records' });
    }

    // 2. Prevent over-dispatch
    const totalReceived = inward.items.reduce(
      (sum, it) => sum + (it.receiveQty || 0),
      0
    );
    const alreadyDispatched = await Outward.aggregate([
      { $match: { challanNumber: req.body.challanNumber } },
      { $group: { _id: null, total: { $sum: '$dispatchQty' } } },
    ]);
    const dispatchedSoFar = alreadyDispatched[0]?.total || 0;
    const remaining = totalReceived - dispatchedSoFar;

    if ((req.body.dispatchQty || 0) > remaining) {
      return res.status(400).json({
        error: `Dispatch qty (${req.body.dispatchQty}) exceeds remaining pending qty (${remaining})`,
      });
    }

    // 3. Auto-generate outward challan number
    const outwardChallanNumber = await generateOutwardChallanNumber();

    const record = new Outward({ ...req.body, outwardChallanNumber });
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE outward — updates metadata + dispatch quantities
app.put('/api/outward/:id', async (req, res) => {
  try {
    const updated = await Outward.findByIdAndUpdate(
      req.params.id,
      {
        // challanNumber and outwardChallanNumber are NOT updated
        partyName: req.body.partyName,
        location: req.body.location,
        dispatchQty: req.body.dispatchQty,
        receiveQty: req.body.receiveQty,
        docketNo: req.body.docketNo,
        courier: req.body.courier,
        remarks: req.body.remarks,
        items: req.body.items || [],
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Outward record not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE outward
app.delete('/api/outward/:id', async (req, res) => {
  try {
    await Outward.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
//               SUMMARY: Inward - Outward Pending
// ==========================================================
app.get('/api/summary', async (req, res) => {
  try {
    const inwards = await Inward.find();
    const outwards = await Outward.find();

    const summary = inwards.map((inw) => {
      const totalReceive = inw.items.reduce(
        (sum, it) => sum + (it.receiveQty || 0),
        0
      );
      const outwardDispatch = outwards
        .filter((o) => o.challanNumber === inw.challanNumber)
        .reduce((sum, o) => sum + (o.dispatchQty || 0), 0);
      const pending = totalReceive - outwardDispatch;

      return {
        challanNumber: inw.challanNumber,
        partyName: inw.partyName,
        location: inw.location,
        totalReceive,
        totalDispatched: outwardDispatch,
        pending,
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
//                    START SERVER
// ==========================================================
app.get('/', (req, res) => {
  res.json({ status: 'OEM Inventory API running ✅' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
