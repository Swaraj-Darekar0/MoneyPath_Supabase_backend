require('dotenv').config();

const express = require('express');
const authRoutes = require('./routes/authRoutes');

const dashboardRoutes = require('./routes/dashboardRoutes');

const goalRoutes = require('./routes/goalRoutes');

const categoryRoutes = require('./routes/categoryRoutes');

const transactionRoutes = require('./routes/transactionRoutes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
