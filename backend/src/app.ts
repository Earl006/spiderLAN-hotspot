import express from 'express';
import authRoutes from './routes/auth.routes';
import buildingRoutes from './routes/building.routes';

const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth/', authRoutes);
app.use('/api/building/', buildingRoutes);


export default app;