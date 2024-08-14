import express from 'express';
import authRoutes from './routes/auth.routes';
import buildingRoutes from './routes/building.routes';
import userRoutes from './routes/user.routes';

const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth/', authRoutes);
app.use('/api/building/', buildingRoutes);
app.use('/api/user/', userRoutes);


export default app;